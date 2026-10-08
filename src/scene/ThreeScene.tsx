import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ProjectDocument, ComponentInstance, Connection, Vector3D, BoardDefinition } from '../domain/project/types';
import { COMPONENT_DEFINITION_MAP } from '../domain/components/definitions';
import { SceneMaterialRegistry } from './materials';
import { createComponentMesh } from './proceduralModels';
import { createWireMesh, createPreviewWireMesh } from './wires';
import { Minibot3D, MinibotState } from './minibot3D';
import { snapToGrid, calculatePinWorldPosition } from '../domain/project/coordinates';
import { SimulationResult } from '../domain/simulation/types';
import { useI18n } from '../i18n/context';
import {
  getBoardPerimeter,
  getClosestPointOnPerimeter,
  isPointInsideBoard,
  areAllComponentsContained,
} from '../domain/project/boardGeometry';

export interface ThreeSceneProps {
  document: ProjectDocument;
  selectedComponentId: string | null;
  selectedConnectionId: string | null;
  onSelectComponent: (id: string | null) => void;
  onSelectConnection: (id: string | null) => void;
  onMoveComponent: (id: string, oldPos: Vector3D, newPos: Vector3D) => void;
  onConnectPins: (fromCompId: string, fromPinId: string, toCompId: string, toPinId: string) => void;
  onToggleSwitch?: (instanceId: string) => void;
  isWiringMode: boolean;
  wiringStartPin: { componentId: string; pinId: string; worldPos: Vector3D } | null;
  onStartWiring?: (startPin: { componentId: string; pinId: string; worldPos: Vector3D }) => void;
  onCancelWiring: () => void;
  isCutMode?: boolean;
  onCutPathComplete?: (cutPath: { x: number; z: number }[]) => void;
  onCancelCutMode?: () => void;
  onResizeBoard?: (oldBoard: BoardDefinition, newBoard: BoardDefinition) => void;
  simulationResult: SimulationResult | null;
  switchStates: Record<string, boolean>;
  isPresentationMode?: boolean;
  isExplodedView?: boolean;
  minibotTargetCompId?: string | null;
  minibotState?: MinibotState;
  qualityPreset?: 'low' | 'balanced' | 'high';
  showGrid?: boolean;
  activeWireColor?: string;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({
  document,
  selectedComponentId,
  selectedConnectionId,
  onSelectComponent,
  onSelectConnection,
  onMoveComponent,
  onConnectPins,
  onToggleSwitch,
  isWiringMode,
  wiringStartPin,
  onStartWiring,
  onCancelWiring,
  isCutMode = false,
  onCutPathComplete,
  onCancelCutMode,
  onResizeBoard,
  simulationResult,
  switchStates,
  isPresentationMode = false,
  isExplodedView = false,
  minibotTargetCompId,
  minibotState = 'idle',
  qualityPreset = 'balanced',
  showGrid = true,
  activeWireColor = '#06b6d4',
}) => {
  const { effectiveTheme, language } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js instances ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const minibotRef = useRef<Minibot3D | null>(null);

  // Interactive groups
  const boardGroupRef = useRef<THREE.Group>(new THREE.Group());
  const resizeHandlesGroupRef = useRef<THREE.Group>(new THREE.Group());
  const componentsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const wiresGroupRef = useRef<THREE.Group>(new THREE.Group());
  const previewWireRef = useRef<THREE.Mesh | null>(null);
  const selectionOutlineRef = useRef<THREE.BoxHelper | null>(null);

  // Board resize interaction state
  const isResizingBoardRef = useRef(false);
  const resizeCornerRef = useRef<number>(0);
  const originalBoardRef = useRef<BoardDefinition | null>(null);
  const currentResizedBoardRef = useRef<BoardDefinition | null>(null);

  // Cut tool interaction state
  const cutPointsRef = useRef<{ x: number; z: number }[]>([]);
  const [cutPointsState, setCutPointsState] = useState<{ x: number; z: number }[]>([]);
  const cutLineMeshRef = useRef<THREE.Line | null>(null);

  // Interaction tracking state
  const isDraggingRef = useRef(false);
  const draggedCompIdRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<Vector3D | null>(null);
  const currentDragPosRef = useRef<Vector3D | null>(null);
  const dragOffsetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Camera orbit state
  const isOrbitingRef = useRef(false);
  const isPanningRef = useRef(false);
  const mousePrevRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraRadiusRef = useRef<number>(140);
  const cameraThetaRef = useRef<number>(Math.PI / 4); // Horizontal angle
  const cameraPhiRef = useRef<number>(Math.PI / 3); // Vertical angle

  // Raycaster & Plane
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseCoordsRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const groundPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  // Exploded view animation value (0 = normal, 1 = exploded)
  const explodedProgressRef = useRef<number>(0);

  // Tooltip UI state
  const [hoveredPinInfo, setHoveredPinInfo] = useState<{ name: string; x: number; y: number } | null>(null);

  // Update Camera from spherical coordinates
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const r = cameraRadiusRef.current;
    const phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraPhiRef.current));
    const theta = cameraThetaRef.current;
    const target = cameraTargetRef.current;

    const x = target.x + r * Math.sin(phi) * Math.sin(theta);
    const y = target.y + r * Math.cos(phi);
    const z = target.z + r * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
  }, []);

  // Set standard views
  const setView = useCallback(
    (mode: 'top' | 'perspective' | 'isometric' | 'reset') => {
      cameraTargetRef.current.set(0, 0, 0);
      if (mode === 'top') {
        cameraRadiusRef.current = 150;
        cameraThetaRef.current = 0;
        cameraPhiRef.current = 0.08;
      } else if (mode === 'perspective') {
        cameraRadiusRef.current = 145;
        cameraThetaRef.current = Math.PI / 4;
        cameraPhiRef.current = Math.PI / 3.2;
      } else if (mode === 'isometric') {
        cameraRadiusRef.current = 160;
        cameraThetaRef.current = Math.PI / 4;
        cameraPhiRef.current = Math.atan(1 / Math.SQRT2); // 35.264°
      } else if (mode === 'reset') {
        cameraRadiusRef.current = 140;
        cameraThetaRef.current = Math.PI / 4;
        cameraPhiRef.current = Math.PI / 3;
      }
      updateCameraPosition();
    },
    [updateCameraPosition]
  );

  // Initialize Scene, Camera, Renderer, Lights, Board
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const bgHex = effectiveTheme === 'light'
      ? (isPresentationMode ? 0xf8fafc : 0xf1f5f9)
      : (isPresentationMode ? 0x111827 : 0x090d16);
    scene.background = new THREE.Color(bgHex);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: qualityPreset !== 'low',
      alpha: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    const maxRatio = qualityPreset === 'low' ? 1 : qualityPreset === 'balanced' ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    renderer.shadowMap.enabled = qualityPreset !== 'low';
    renderer.shadowMap.type = qualityPreset === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, isPresentationMode ? 0.9 : 0.7);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainLight.position.set(60, 110, 50);
    mainLight.castShadow = qualityPreset !== 'low';
    if (mainLight.shadow) {
      mainLight.shadow.mapSize.width = 1024;
      mainLight.shadow.mapSize.height = 1024;
      mainLight.shadow.camera.near = 10;
      mainLight.shadow.camera.far = 300;
      const d = 90;
      mainLight.shadow.camera.left = -d;
      mainLight.shadow.camera.right = d;
      mainLight.shadow.camera.top = d;
      mainLight.shadow.camera.bottom = -d;
      mainLight.shadow.bias = -0.0005;
    }
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4); // Subtle cyan fill
    fillLight.position.set(-60, 40, -50);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, -30, -60);
    scene.add(rimLight);

    // 5. Add Group Hierarchies
    scene.add(boardGroupRef.current);
    scene.add(resizeHandlesGroupRef.current);
    scene.add(componentsGroupRef.current);
    scene.add(wiresGroupRef.current);

    // 6. Minibot Assistant Entity
    const minibot = new Minibot3D();
    minibotRef.current = minibot;
    scene.add(minibot.group);

    // 7. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 8. RAF Animation Loop
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Presentation Mode Turntable auto-orbit
      if (isPresentationMode && !isOrbitingRef.current && !isPanningRef.current && !isDraggingRef.current) {
        cameraThetaRef.current += delta * 0.22;
        updateCameraPosition();
      }

      // Smooth Exploded View transition
      const targetExploded = isExplodedView ? 1 : 0;
      explodedProgressRef.current = THREE.MathUtils.lerp(explodedProgressRef.current, targetExploded, delta * 5);

      // Apply vertical elevation to components based on deterministic layer logic
      componentsGroupRef.current.children.forEach((child, index) => {
        const baseInstance = document.components.find((c) => `comp-${c.instanceId}` === child.name);
        if (baseInstance) {
          const def = COMPONENT_DEFINITION_MAP.get(baseInstance.definitionId);
          const layerOffset = (def?.category === 'power' ? 24 : def?.category === 'passives' ? 14 : 32) + (index % 5) * 2;
          const explodedY = layerOffset * explodedProgressRef.current;
          child.position.y = baseInstance.position.y + explodedY;
        }
      });

      // Update Minibot bobbing & hover
      if (minibotRef.current) {
        minibotRef.current.update(delta);
      }

      // Update selection bounding box
      if (selectionOutlineRef.current) {
        selectionOutlineRef.current.update();
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, [isPresentationMode, qualityPreset]);

  // Reactively update scene background without re-creating scene or resetting camera
  useEffect(() => {
    if (!sceneRef.current) return;
    const bgHex = effectiveTheme === 'light'
      ? (isPresentationMode ? 0xf8fafc : 0xf1f5f9)
      : (isPresentationMode ? 0x111827 : 0x090d16);
    sceneRef.current.background = new THREE.Color(bgHex);
  }, [effectiveTheme, isPresentationMode]);

  // Build / Update Board PCB Mesh
  useEffect(() => {
    const boardGroup = boardGroupRef.current;
    while (boardGroup.children.length > 0) {
      boardGroup.remove(boardGroup.children[0]);
    }

    const { width, depth, thickness, solderMaskColor, shape = 'rectangle' } = document.board;
    const mats = SceneMaterialRegistry.getInstance();
    const topMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(solderMaskColor),
      roughness: 0.35,
      metalness: 0.08,
    });

    if (shape === 'circle') {
      const radius = document.board.radius || width / 2;
      const cylGeom = new THREE.CylinderGeometry(radius, radius, thickness, 48);
      const cylMesh = new THREE.Mesh(cylGeom, mats.pcbEdgeMaterial);
      cylMesh.position.set(0, -thickness / 2, 0);
      cylMesh.receiveShadow = true;
      boardGroup.add(cylMesh);

      const topGeom = new THREE.CircleGeometry(radius, 48);
      topGeom.rotateX(-Math.PI / 2);
      const topMesh = new THREE.Mesh(topGeom, topMat);
      topMesh.position.set(0, 0.02, 0);
      topMesh.receiveShadow = true;
      boardGroup.add(topMesh);

      const ringGeom = new THREE.RingGeometry(radius - 1.8, radius - 1.0, 48);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeom, mats.pcbSilkscreenMaterial);
      ringMesh.position.set(0, 0.04, 0);
      boardGroup.add(ringMesh);
    } else if (shape === 'triangle' || shape === 'polygon') {
      const pts = getBoardPerimeter(document.board);
      const shape2D = new THREE.Shape();
      shape2D.moveTo(pts[0].x, pts[0].z);
      for (let i = 1; i < pts.length; i++) {
        shape2D.lineTo(pts[i].x, pts[i].z);
      }
      shape2D.closePath();

      const extrudeGeom = new THREE.ExtrudeGeometry(shape2D, {
        depth: thickness,
        bevelEnabled: false,
      });
      extrudeGeom.rotateX(Math.PI / 2);
      const extrudeMesh = new THREE.Mesh(extrudeGeom, mats.pcbEdgeMaterial);
      extrudeMesh.position.set(0, 0, 0);
      extrudeMesh.receiveShadow = true;
      boardGroup.add(extrudeMesh);

      const shapeGeom = new THREE.ShapeGeometry(shape2D);
      shapeGeom.rotateX(-Math.PI / 2);
      const topMesh = new THREE.Mesh(shapeGeom, topMat);
      topMesh.position.set(0, 0.02, 0);
      topMesh.receiveShadow = true;
      boardGroup.add(topMesh);

      const borderPoints = pts.map((p) => new THREE.Vector3(p.x, 0.06, p.z));
      borderPoints.push(new THREE.Vector3(pts[0].x, 0.06, pts[0].z));
      const borderGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
      const borderLine = new THREE.Line(borderGeom, mats.pcbSilkscreenMaterial);
      boardGroup.add(borderLine);
    } else {
      const w = shape === 'square' ? Math.max(width, depth) : width;
      const d = shape === 'square' ? Math.max(width, depth) : depth;

      // 1. PCB FR-4 Core Substrate Box
      const boardGeom = new THREE.BoxGeometry(w, thickness, d);
      const boardMat = mats.pcbEdgeMaterial;
      const boardMesh = new THREE.Mesh(boardGeom, boardMat);
      boardMesh.position.set(0, -thickness / 2, 0);
      boardMesh.receiveShadow = true;
      boardGroup.add(boardMesh);

      // 2. Top Solder Mask Layer
      const topGeom = new THREE.PlaneGeometry(w, d);
      topGeom.rotateX(-Math.PI / 2);
      const topMesh = new THREE.Mesh(topGeom, topMat);
      topMesh.position.set(0, 0.02, 0);
      topMesh.receiveShadow = true;
      boardGroup.add(topMesh);

      // 3. Silkscreen Border Lines
      const borderPoints = [
        new THREE.Vector3(-w / 2 + 2, 0.06, -d / 2 + 2),
        new THREE.Vector3(w / 2 - 2, 0.06, -d / 2 + 2),
        new THREE.Vector3(w / 2 - 2, 0.06, d / 2 - 2),
        new THREE.Vector3(-w / 2 + 2, 0.06, d / 2 - 2),
        new THREE.Vector3(-w / 2 + 2, 0.06, -d / 2 + 2),
      ];
      const borderGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
      const borderLine = new THREE.Line(borderGeom, mats.pcbSilkscreenMaterial);
      boardGroup.add(borderLine);
    }

    // 4. PCB Grid Dots / Metallic Pad Grid (2.54mm pitch)
    if (showGrid && shape !== 'circle' && shape !== 'triangle' && shape !== 'polygon') {
      const w = shape === 'square' ? Math.max(width, depth) : width;
      const d = shape === 'square' ? Math.max(width, depth) : depth;
      const padGeom = new THREE.CircleGeometry(0.5, 8);
      padGeom.rotateX(-Math.PI / 2);
      const padMat = mats.pcbPadMaterial;

      const halfW = w / 2 - 4;
      const halfD = d / 2 - 4;
      const step = document.board.gridSpacing || 2.54;

      const countX = Math.floor((halfW * 2) / step);
      const countZ = Math.floor((halfD * 2) / step);
      const totalPads = countX * countZ;

      if (totalPads < 3000) {
        const instancedPads = new THREE.InstancedMesh(padGeom, padMat, totalPads);
        instancedPads.position.set(0, 0.04, 0);

        const dummy = new THREE.Object3D();
        let idx = 0;
        for (let ix = 0; ix < countX; ix++) {
          const x = -halfW + ix * step;
          for (let iz = 0; iz < countZ; iz++) {
            const z = -halfD + iz * step;
            dummy.position.set(x, 0, z);
            dummy.updateMatrix();
            instancedPads.setMatrixAt(idx++, dummy.matrix);
          }
        }
        instancedPads.instanceMatrix.needsUpdate = true;
        boardGroup.add(instancedPads);
      }
    }
  }, [document.board, showGrid]);

  // Build / Update Board Resize Handles (Corner handles in Select Mode)
  useEffect(() => {
    const handlesGroup = resizeHandlesGroupRef.current;
    while (handlesGroup.children.length > 0) {
      handlesGroup.remove(handlesGroup.children[0]);
    }

    if (isWiringMode || isCutMode || isPresentationMode) {
      return;
    }

    const { width, depth, shape = 'rectangle' } = document.board;
    if (shape === 'polygon' || shape === 'triangle') {
      return;
    }

    const hw = (shape === 'square' ? Math.max(width, depth) : width) / 2;
    const hd = (shape === 'square' ? Math.max(width, depth) : depth) / 2;

    const corners = [
      { x: hw, z: -hd, cornerIndex: 0 },
      { x: hw, z: hd, cornerIndex: 1 },
      { x: -hw, z: hd, cornerIndex: 2 },
      { x: -hw, z: -hd, cornerIndex: 3 },
    ];

    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
    });

    corners.forEach((c) => {
      const handleGroup = new THREE.Group();
      handleGroup.position.set(c.x, 0.6, c.z);

      const sphereGeom = new THREE.SphereGeometry(2.2, 16, 16);
      const sphere = new THREE.Mesh(sphereGeom, handleMat);
      sphere.userData = { type: 'board-resize-handle', cornerIndex: c.cornerIndex };
      handleGroup.add(sphere);

      const ringGeom = new THREE.RingGeometry(2.4, 3.2, 16);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      handleGroup.add(ring);

      handlesGroup.add(handleGroup);
    });
  }, [document.board, isWiringMode, isCutMode, isPresentationMode]);

  // Cut Tool Preview Line in ThreeScene
  useEffect(() => {
    if (!sceneRef.current) return;
    if (cutLineMeshRef.current) {
      sceneRef.current.remove(cutLineMeshRef.current);
      cutLineMeshRef.current = null;
    }

    if (!isCutMode || cutPointsState.length < 1) {
      return;
    }

    const points = cutPointsState.map((p) => new THREE.Vector3(p.x, 0.5, p.z));
    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      linewidth: 3,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    cutLineMeshRef.current = line;
    sceneRef.current.add(line);

    return () => {
      if (cutLineMeshRef.current && sceneRef.current) {
        sceneRef.current.remove(cutLineMeshRef.current);
        cutLineMeshRef.current = null;
      }
    };
  }, [isCutMode, cutPointsState]);

  // Pin Halos in Wiring Mode
  useEffect(() => {
    componentsGroupRef.current.traverse((child) => {
      if (child.userData?.isPin) {
        let beacon = child.getObjectByName('pin-beacon') as THREE.Mesh;
        if (!beacon) {
          const ringGeom = new THREE.RingGeometry(1.6, 2.5, 16);
          ringGeom.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            side: THREE.DoubleSide,
          });
          beacon = new THREE.Mesh(ringGeom, ringMat);
          beacon.name = 'pin-beacon';
          beacon.position.set(0, 0.4, 0);
          child.add(beacon);
        }

        if (!isWiringMode) {
          beacon.visible = false;
        } else {
          beacon.visible = true;
          const { componentId, pinId } = child.userData;
          const isStartPin = wiringStartPin && wiringStartPin.componentId === componentId && wiringStartPin.pinId === pinId;
          const isHovered = hoveredPinInfo && hoveredPinInfo.name === child.userData.name;

          const mat = beacon.material as THREE.MeshStandardMaterial;
          if (isStartPin) {
            mat.color.setHex(0xf59e0b); // Pulsing Gold
            mat.emissive.setHex(0xf59e0b);
            mat.emissiveIntensity = 1.4;
            beacon.scale.set(1.4, 1.4, 1.4);
          } else if (isHovered) {
            mat.color.setHex(0x38bdf8); // Bright Cyan
            mat.emissive.setHex(0x38bdf8);
            mat.emissiveIntensity = 1.1;
            beacon.scale.set(1.25, 1.25, 1.25);
          } else {
            mat.color.setHex(0x06b6d4); // Light Teal
            mat.emissive.setHex(0x06b6d4);
            mat.emissiveIntensity = 0.6;
            beacon.scale.set(1.0, 1.0, 1.0);
          }
        }
      }
    });
  }, [isWiringMode, wiringStartPin, hoveredPinInfo, document.components]);

  // Build / Update Component Meshes
  useEffect(() => {
    const compGroup = componentsGroupRef.current;
    while (compGroup.children.length > 0) {
      compGroup.remove(compGroup.children[0]);
    }

    if (selectionOutlineRef.current && sceneRef.current) {
      sceneRef.current.remove(selectionOutlineRef.current);
      selectionOutlineRef.current = null;
    }

    for (const inst of document.components) {
      const def = COMPONENT_DEFINITION_MAP.get(inst.definitionId);
      if (!def) continue;

      const simState = simulationResult?.components?.[inst.instanceId];
      const isSwitchClosed = switchStates[inst.instanceId] ?? (inst.state?.open === false);

      const meshGroup = createComponentMesh(inst, def, {
        isSimulationOn: simState?.isOn || false,
        switchClosed: isSwitchClosed,
      });

      compGroup.add(meshGroup);

      // Add selection box helper if selected
      if (inst.instanceId === selectedComponentId && sceneRef.current) {
        const box = new THREE.BoxHelper(meshGroup, 0x38bdf8);
        box.name = 'selection-outline';
        selectionOutlineRef.current = box;
        sceneRef.current.add(box);
      }
    }
  }, [document.components, selectedComponentId, simulationResult, switchStates]);

  // Build / Update Wires
  useEffect(() => {
    const wiresGroup = wiresGroupRef.current;
    while (wiresGroup.children.length > 0) {
      wiresGroup.remove(wiresGroup.children[0]);
    }

    for (const conn of document.connections) {
      const isSelected = conn.id === selectedConnectionId;
      const wireMesh = createWireMesh(conn, document.components, isSelected);
      if (wireMesh) {
        wiresGroup.add(wireMesh);
      }
    }
  }, [document.connections, document.components, selectedConnectionId]);

  // Update Minibot target
  useEffect(() => {
    if (!minibotRef.current) return;

    if (minibotTargetCompId) {
      const targetComp = document.components.find((c) => c.instanceId === minibotTargetCompId);
      if (targetComp) {
        minibotRef.current.focusOn(
          new THREE.Vector3(targetComp.position.x, targetComp.position.y, targetComp.position.z),
          minibotState
        );
      }
    } else {
      minibotRef.current.setState(minibotState);
    }
  }, [minibotTargetCompId, minibotState, document.components]);

  // Interactive Pointer Events (Selection, Dragging, Wiring, Switch Toggling, Board Resize, Cut Tool)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      // Right click: Pan camera
      isPanningRef.current = true;
      mousePrevRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !cameraRef.current || !sceneRef.current) return;

    mouseCoordsRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseCoordsRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseCoordsRef.current, cameraRef.current);

    // 0. Check Cut Mode clicks
    if (isCutMode) {
      const intersectionPoint = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
        const perimeter = getBoardPerimeter(document.board);
        const hitPt = { x: intersectionPoint.x, z: intersectionPoint.z };
        if (cutPointsRef.current.length === 0) {
          const snap = getClosestPointOnPerimeter(hitPt, perimeter);
          cutPointsRef.current = [snap.point];
          setCutPointsState([snap.point]);
        } else {
          const snap = getClosestPointOnPerimeter(hitPt, perimeter);
          const startPt = cutPointsRef.current[0];
          const distFromStart = Math.hypot(hitPt.x - startPt.x, hitPt.z - startPt.z);
          if (snap.distance < 6.0 && distFromStart > 8.0) {
            const finalPath = [...cutPointsRef.current, snap.point];
            cutPointsRef.current = [];
            setCutPointsState([]);
            if (cutLineMeshRef.current && sceneRef.current) {
              sceneRef.current.remove(cutLineMeshRef.current);
              cutLineMeshRef.current = null;
            }
            if (onCutPathComplete) {
              onCutPathComplete(finalPath);
            }
          } else {
            const newPts = [...cutPointsRef.current, hitPt];
            cutPointsRef.current = newPts;
            setCutPointsState(newPts);
          }
        }
      }
      return;
    }

    // 0b. Check Board Resize Handle click (Only in Select Mode)
    if (!isWiringMode && !isCutMode && !isPresentationMode) {
      const handleIntersects = raycasterRef.current.intersectObjects(resizeHandlesGroupRef.current.children, true);
      if (handleIntersects.length > 0) {
        let handleObj: THREE.Object3D | null = handleIntersects[0].object;
        while (handleObj && handleObj.userData?.type !== 'board-resize-handle') {
          handleObj = handleObj.parent;
        }
        if (handleObj && handleObj.userData?.cornerIndex !== undefined) {
          isResizingBoardRef.current = true;
          resizeCornerRef.current = handleObj.userData.cornerIndex;
          originalBoardRef.current = { ...document.board };
          currentResizedBoardRef.current = { ...document.board };
          return;
        }
      }
    }

    // 1. Check Pin clicks (ONLY intercept in Wiring Mode so Select Mode can drag components freely)
    const pinIntersects = raycasterRef.current.intersectObjects(componentsGroupRef.current.children, true);
    const hitPin = pinIntersects.find((hit) => hit.object.userData?.isPin);

    if (isWiringMode && hitPin) {
      const { componentId, pinId } = hitPin.object.userData;

      const targetComp = document.components.find((c) => c.instanceId === componentId);
      const targetDef = targetComp ? COMPONENT_DEFINITION_MAP.get(targetComp.definitionId) : null;
      const targetPinDef = targetDef?.pins.find((p) => p.id === pinId);
      const worldPos: Vector3D = (targetComp && targetPinDef)
        ? calculatePinWorldPosition(targetComp, targetPinDef.localOffset)
        : { x: hitPin.point.x, y: hitPin.point.y, z: hitPin.point.z };

      if (wiringStartPin) {
        // Second pin clicked
        if (wiringStartPin.componentId === componentId && wiringStartPin.pinId === pinId) {
          onCancelWiring();
          return;
        }
        onConnectPins(wiringStartPin.componentId, wiringStartPin.pinId, componentId, pinId);
        return;
      } else {
        // First pin clicked in wiring mode
        if (onStartWiring) {
          onStartWiring({ componentId, pinId, worldPos });
        }
        return;
      }
    }

    // 2. Check Switch toggle click
    const hitSwitch = pinIntersects.find((hit) => hit.object.name === 'switch-toggle-knob');
    if (hitSwitch && onToggleSwitch) {
      const compId = hitSwitch.object.userData?.componentId;
      if (compId) {
        onToggleSwitch(compId);
        return;
      }
    }

    // 3. Check Component click for selection / drag (including if ray hit a pin child in Select Mode)
    const compHits = pinIntersects.filter((hit) => {
      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        if (cur.userData?.type === 'component' || cur.userData?.componentId) return true;
        cur = cur.parent;
      }
      return false;
    });

    if (compHits.length > 0) {
      let topComp: THREE.Object3D | null = compHits[0].object;
      let resolvedId: string | null = null;
      while (topComp) {
        if (topComp.userData?.type === 'component' && topComp.userData?.instanceId) {
          resolvedId = topComp.userData.instanceId;
          break;
        }
        if (!resolvedId && topComp.userData?.componentId) {
          resolvedId = topComp.userData.componentId;
        }
        topComp = topComp.parent;
      }

      if (resolvedId) {
        const id = resolvedId;
        onSelectComponent(id);
        onSelectConnection(null);

        // Start drag if not in wiring mode
        if (!isWiringMode && !isPresentationMode) {
          const comp = document.components.find((c) => c.instanceId === id);
          if (comp) {
            isDraggingRef.current = true;
            draggedCompIdRef.current = id;
            dragStartPosRef.current = { ...comp.position };
            currentDragPosRef.current = { ...comp.position };

            const hitGround = new THREE.Vector3();
            if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, hitGround)) {
              dragOffsetRef.current = {
                x: comp.position.x - hitGround.x,
                z: comp.position.z - hitGround.z,
              };
            } else {
              dragOffsetRef.current = { x: 0, z: 0 };
            }
          }
        }
        return;
      }
    }

    // 4. Check Wire click
    const wireIntersects = raycasterRef.current.intersectObjects(wiresGroupRef.current.children, true);
    if (wireIntersects.length > 0) {
      const wireId = wireIntersects[0].object.userData?.connectionId;
      if (wireId) {
        onSelectConnection(wireId);
        onSelectComponent(null);
        return;
      }
    }

    // 5. Board / empty space clicked -> Orbit Camera
    onSelectComponent(null);
    onSelectConnection(null);
    isOrbitingRef.current = true;
    mousePrevRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !cameraRef.current) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    // Handle Camera Orbit
    if (isOrbitingRef.current) {
      const dx = clientX - mousePrevRef.current.x;
      const dy = clientY - mousePrevRef.current.y;
      cameraThetaRef.current -= dx * 0.008;
      cameraPhiRef.current -= dy * 0.008;
      mousePrevRef.current = { x: clientX, y: clientY };
      updateCameraPosition();
      return;
    }

    // Handle Camera Pan
    if (isPanningRef.current) {
      const dx = clientX - mousePrevRef.current.x;
      const dy = clientY - mousePrevRef.current.y;
      const panSpeed = 0.2;
      const right = new THREE.Vector3();
      cameraRef.current.getWorldDirection(right);
      right.cross(cameraRef.current.up).normalize();

      cameraTargetRef.current.addScaledVector(right, -dx * panSpeed);
      cameraTargetRef.current.addScaledVector(cameraRef.current.up, dy * panSpeed);
      mousePrevRef.current = { x: clientX, y: clientY };
      updateCameraPosition();
      return;
    }

    mouseCoordsRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseCoordsRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseCoordsRef.current, cameraRef.current);

    // Handle Board Resize Dragging
    if (isResizingBoardRef.current && originalBoardRef.current) {
      const intersectionPoint = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
        const step = document.board.gridSpacing || 2.54;
        let candidateW = snapToGrid(Math.abs(intersectionPoint.x) * 2, step);
        let candidateD = snapToGrid(Math.abs(intersectionPoint.z) * 2, step);

        if (originalBoardRef.current.shape === 'square' || originalBoardRef.current.shape === 'circle') {
          const maxDim = Math.max(candidateW, candidateD);
          candidateW = maxDim;
          candidateD = maxDim;
        }

        // Safety containment constraint: components cannot be outside
        let minBoundX = 30;
        let minBoundZ = 30;
        for (const comp of document.components) {
          minBoundX = Math.max(minBoundX, Math.abs(comp.position.x) * 2 + 16);
          minBoundZ = Math.max(minBoundZ, Math.abs(comp.position.z) * 2 + 16);
        }

        candidateW = Math.max(minBoundX, Math.min(300, candidateW));
        candidateD = Math.max(minBoundZ, Math.min(300, candidateD));

        currentResizedBoardRef.current = {
          ...originalBoardRef.current,
          width: candidateW,
          depth: candidateD,
          radius: originalBoardRef.current.shape === 'circle' ? candidateW / 2 : originalBoardRef.current.radius,
        };

        const scaleX = candidateW / originalBoardRef.current.width;
        const scaleZ = candidateD / originalBoardRef.current.depth;
        boardGroupRef.current.scale.set(scaleX, 1, scaleZ);
      }
      return;
    }

    // Handle Cut Mode Live Line
    if (isCutMode && cutPointsRef.current.length > 0) {
      const intersectionPoint = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
        const livePts = [...cutPointsRef.current, { x: intersectionPoint.x, z: intersectionPoint.z }];
        setCutPointsState(livePts);
      }
      return;
    }

    // Handle Component Dragging
    if (isDraggingRef.current && draggedCompIdRef.current) {
      const intersectionPoint = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
        const rawX = intersectionPoint.x + dragOffsetRef.current.x;
        const rawZ = intersectionPoint.z + dragOffsetRef.current.z;
        const step = e.shiftKey ? 0.5 : (document.board.gridSpacing || 2.54);
        const snappedX = snapToGrid(rawX, step);
        const snappedZ = snapToGrid(rawZ, step);

        const halfW = document.board.width / 2 - 4;
        const halfD = document.board.depth / 2 - 4;
        const clampedX = Math.max(-halfW, Math.min(halfW, snappedX));
        const clampedZ = Math.max(-halfD, Math.min(halfD, snappedZ));

        currentDragPosRef.current = { x: clampedX, y: 0, z: clampedZ };

        const meshGroup = componentsGroupRef.current.children.find(
          (c) => c.name === `comp-${draggedCompIdRef.current}`
        );
        if (meshGroup) {
          meshGroup.position.x = clampedX;
          meshGroup.position.z = clampedZ;
        }
        if (selectionOutlineRef.current) {
          selectionOutlineRef.current.update();
        }

        // Dynamically update connected wires in real time while dragging
        const draggedId = draggedCompIdRef.current;
        const hasConnectedWires = document.connections.some(
          (conn) => conn.fromComponentId === draggedId || conn.toComponentId === draggedId
        );
        if (hasConnectedWires) {
          const tempComponents = document.components.map((c) =>
            c.instanceId === draggedId ? { ...c, position: { x: clampedX, y: 0, z: clampedZ } } : c
          );
          const wiresGroup = wiresGroupRef.current;
          while (wiresGroup.children.length > 0) {
            wiresGroup.remove(wiresGroup.children[0]);
          }
          for (const conn of document.connections) {
            const isSelected = conn.id === selectedConnectionId;
            const wireMesh = createWireMesh(conn, tempComponents, isSelected);
            if (wireMesh) {
              wiresGroup.add(wireMesh);
            }
          }
        }
      }
      return;
    }

    // Tooltip Pin Hover Check & Magnetic Pin Snapping
    const pinIntersects = raycasterRef.current.intersectObjects(componentsGroupRef.current.children, true);
    const hoveredPin = pinIntersects.find((hit) => hit.object.userData?.isPin);
    if (hoveredPin) {
      setHoveredPinInfo({
        name: hoveredPin.object.userData.name || 'Chân linh kiện',
        x: clientX - rect.left,
        y: clientY - rect.top - 24,
      });
    } else {
      setHoveredPinInfo(null);
    }

    // Handle Wiring Preview Wire
    if (isWiringMode && wiringStartPin) {
      let targetPos: Vector3D | null = null;

      if (
        hoveredPin &&
        (hoveredPin.object.userData?.componentId !== wiringStartPin.componentId ||
          hoveredPin.object.userData?.pinId !== wiringStartPin.pinId)
      ) {
        const hCompId = hoveredPin.object.userData.componentId;
        const hPinId = hoveredPin.object.userData.pinId;
        const hComp = document.components.find((c) => c.instanceId === hCompId);
        const hDef = hComp ? COMPONENT_DEFINITION_MAP.get(hComp.definitionId) : null;
        const hPinDef = hDef?.pins.find((p) => p.id === hPinId);
        if (hComp && hPinDef) {
          targetPos = calculatePinWorldPosition(hComp, hPinDef.localOffset);
        } else {
          targetPos = { x: hoveredPin.point.x, y: hoveredPin.point.y, z: hoveredPin.point.z };
        }
      } else {
        const intersectionPoint = new THREE.Vector3();
        if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
          targetPos = {
            x: intersectionPoint.x,
            y: intersectionPoint.y + 0.5,
            z: intersectionPoint.z,
          };
        }
      }

      if (targetPos) {
        if (previewWireRef.current && sceneRef.current) {
          sceneRef.current.remove(previewWireRef.current);
        }
        const parsedHex = activeWireColor ? parseInt(activeWireColor.replace('#', ''), 16) : 0x38bdf8;
        const pw = createPreviewWireMesh(
          wiringStartPin.worldPos,
          targetPos,
          Number.isNaN(parsedHex) ? 0x38bdf8 : parsedHex
        );
        previewWireRef.current = pw;
        sceneRef.current?.add(pw);
      }
    }
  };

  const handlePointerUp = () => {
    isOrbitingRef.current = false;
    isPanningRef.current = false;

    // Handle Board Resize Commit
    if (isResizingBoardRef.current && originalBoardRef.current && currentResizedBoardRef.current) {
      isResizingBoardRef.current = false;
      boardGroupRef.current.scale.set(1, 1, 1);
      const oldB = originalBoardRef.current;
      const newB = currentResizedBoardRef.current;
      originalBoardRef.current = null;
      currentResizedBoardRef.current = null;

      if (oldB.width !== newB.width || oldB.depth !== newB.depth) {
        if (onResizeBoard) {
          onResizeBoard(oldB, newB);
        }
      }
    }

    if (isDraggingRef.current && draggedCompIdRef.current && dragStartPosRef.current && currentDragPosRef.current) {
      const id = draggedCompIdRef.current;
      const oldPos = dragStartPosRef.current;
      const newPos = currentDragPosRef.current;

      isDraggingRef.current = false;
      draggedCompIdRef.current = null;
      dragStartPosRef.current = null;
      currentDragPosRef.current = null;

      if (oldPos.x !== newPos.x || oldPos.z !== newPos.z) {
        onMoveComponent(id, oldPos, newPos);
      }
    }

    if (previewWireRef.current && sceneRef.current && !isWiringMode) {
      sceneRef.current.remove(previewWireRef.current);
      previewWireRef.current = null;
    }
  };

  // Clean up preview wire when wiring mode exits
  useEffect(() => {
    if (!isWiringMode && previewWireRef.current && sceneRef.current) {
      sceneRef.current.remove(previewWireRef.current);
      previewWireRef.current = null;
    }
  }, [isWiringMode]);

  // Handle ESC key to cancel wiring, cut tool, or resizing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isResizingBoardRef.current) {
          isResizingBoardRef.current = false;
          boardGroupRef.current.scale.set(1, 1, 1);
          originalBoardRef.current = null;
          currentResizedBoardRef.current = null;
        }
        if (isCutMode) {
          cutPointsRef.current = [];
          setCutPointsState([]);
          if (cutLineMeshRef.current && sceneRef.current) {
            sceneRef.current.remove(cutLineMeshRef.current);
            cutLineMeshRef.current = null;
          }
          if (onCancelCutMode) onCancelCutMode();
        }
        if (isWiringMode) {
          if (previewWireRef.current && sceneRef.current) {
            sceneRef.current.remove(previewWireRef.current);
            previewWireRef.current = null;
          }
          onCancelWiring();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWiringMode, isCutMode, onCancelWiring, onCancelCutMode]);

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraRadiusRef.current = Math.max(35, Math.min(350, cameraRadiusRef.current * zoomFactor));
    updateCameraPosition();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden bg-slate-950"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* View Presets Quick Bar */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/85 dark:bg-slate-900/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-lg text-xs">
        <button
          onClick={() => setView('perspective')}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          title={language === 'vi' ? 'Góc nhìn phối cảnh 3D' : '3D Perspective view'}
        >
          {language === 'vi' ? 'Phối cảnh' : 'Perspective'}
        </button>
        <button
          onClick={() => setView('top')}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          title={language === 'vi' ? 'Nhìn thẳng từ trên xuống (2D PCB View)' : 'Top-down orthogonal view (2D PCB View)'}
        >
          {language === 'vi' ? 'Mặt trên' : 'Top View'}
        </button>
        <button
          onClick={() => setView('isometric')}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          title={language === 'vi' ? 'Góc nhìn trục lượng (Isometric)' : 'Isometric view'}
        >
          {language === 'vi' ? 'Trục lượng' : 'Isometric'}
        </button>
        <button
          onClick={() => setView('reset')}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
          title={language === 'vi' ? 'Đặt lại góc quay camera ban đầu' : 'Reset camera'}
        >
          {language === 'vi' ? 'Đặt lại' : 'Reset'}
        </button>
      </div>

      {/* Pin Hover Floating Tooltip */}
      {hoveredPinInfo && (
        <div
          className="pointer-events-none absolute z-20 px-2 py-1 bg-white/95 dark:bg-slate-900/90 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] rounded border border-cyan-300 dark:border-cyan-500/40 shadow-md backdrop-blur-sm -translate-x-1/2 -translate-y-full"
          style={{ left: hoveredPinInfo.x, top: hoveredPinInfo.y }}
        >
          {hoveredPinInfo.name}
        </div>
      )}

      {/* Cut tool indicator banner */}
      {isCutMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/90 border border-rose-300 dark:border-rose-500/80 text-rose-800 dark:text-rose-300 text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-rose-400"></span>
          {cutPointsState.length === 0
            ? (language === 'vi' ? 'Chế độ Cắt bo: Click một điểm trên viền bo mạch để bắt đầu' : 'Board Cut Mode: Click a point on board edge to start')
            : (language === 'vi' ? 'Đang cắt bo: Click điểm trên viền đối diện để hoàn tất (Nhấn ESC để hủy)' : 'Cutting: Click point on opposite edge to complete (Press ESC to cancel)')}
          <button
            onClick={() => {
              cutPointsRef.current = [];
              setCutPointsState([]);
              if (cutLineMeshRef.current && sceneRef.current) {
                sceneRef.current.remove(cutLineMeshRef.current);
                cutLineMeshRef.current = null;
              }
              if (onCancelCutMode) onCancelCutMode();
            }}
            className="ml-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px]"
          >
            {language === 'vi' ? 'Hủy (Esc)' : 'Cancel (Esc)'}
          </button>
        </div>
      )}

      {/* Wiring mode indicator banner */}
      {isWiringMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/90 border border-cyan-300 dark:border-cyan-500/80 text-cyan-800 dark:text-cyan-300 text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400"></span>
          {wiringStartPin
            ? (language === 'vi' ? 'Đang kéo dây: Click vào chân đích để hoàn tất kết nối (Nhấn ESC để hủy)' : 'Wiring: Click target pin to complete connection (Press ESC to cancel)')
            : (language === 'vi' ? 'Chế độ nối dây: Click vào một chân linh kiện để bắt đầu' : 'Wiring mode: Click a component pin to start')}
          <button
            onClick={onCancelWiring}
            className="ml-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px]"
          >
            {language === 'vi' ? 'Hủy (Esc)' : 'Cancel (Esc)'}
          </button>
        </div>
      )}
    </div>
  );
};
