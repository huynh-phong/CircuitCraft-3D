import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Eye,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Loader2,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { ProjectDocument, ComponentInstance, SimulationResult } from '../../types/circuit.ts';
import { useI18n } from '../../i18n/context';

function isWebGLSupported(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface CircuitCanvasProps {
  document: ProjectDocument;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  activePinWiring: { componentId: string; pinId: string } | null;
  simulationResult: SimulationResult;
  isSimulating: boolean;
  isLowGraphics?: boolean;
  onToggleLowGraphics?: () => void;
  onSelectComponent: (id: string | null) => void;
  onSelectWire: (id: string | null) => void;
  onStartWire: (componentId: string, pinId: string) => void;
  onFinishWire: (toComponentId: string, toPinId: string) => void;
  onCancelWire: () => void;
  onMoveComponent: (id: string, newPos: { x: number; y: number; z: number }) => void;
  onToggleSwitch: (componentId: string) => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  document: doc,
  selectedComponentId,
  selectedWireId,
  activePinWiring,
  simulationResult,
  isSimulating,
  isLowGraphics: propLowGraphics,
  onToggleLowGraphics,
  onSelectComponent,
  onSelectWire,
  onStartWire,
  onFinishWire,
  onCancelWire,
  onMoveComponent,
  onToggleSwitch,
}) => {
  const { language } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Board and Grid dynamic mesh refs
  const boardMeshRef = useRef<THREE.Mesh | null>(null);
  const gridMeshRef = useRef<THREE.GridHelper | null>(null);

  // Loading, error and capability states
  const [webglSupported] = useState<boolean>(() => isWebGLSupported());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [internalLowGraphics, setInternalLowGraphics] = useState<boolean>(false);
  const isLowGraphics = propLowGraphics ?? internalLowGraphics;

  const [hoveredPin, setHoveredPin] = useState<{ componentId: string; pinId: string } | null>(null);

  // Dragging state
  const isDraggingRef = useRef(false);
  const draggedCompIdRef = useRef<string | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const mousePlanePosRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // Orbit controls state
  const isOrbitingRef = useRef(false);
  const isPanningRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));

  // Objects references
  const componentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const wireMeshesRef = useRef<Map<string, THREE.Line | THREE.Mesh>>(new Map());
  const pinHitboxesRef = useRef<Array<{ mesh: THREE.Mesh; componentId: string; pinId: string }>>([]);
  const tempWireRef = useRef<THREE.Line | null>(null);

  // Initialize Scene
  useEffect(() => {
    if (!containerRef.current || !webglSupported) return;

    try {
      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 600;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0a0f18');
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
      camera.position.set(0, 140, 160);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        antialias: !isLowGraphics,
        alpha: true,
        powerPreference: isLowGraphics ? 'low-power' : 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(isLowGraphics ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isLowGraphics;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);

      // Context lost handler
      const canvasEl = renderer.domElement;
      const onContextLost = (e: Event) => {
        e.preventDefault();
        setSceneError('Ngữ cảnh đồ họa WebGL bị ngắt kết nối. Vui lòng tải lại trang.');
      };
      canvasEl.addEventListener('webglcontextlost', onContextLost);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, isLowGraphics ? 0.9 : 0.7);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(60, 120, 80);
      dirLight.castShadow = !isLowGraphics;
      dirLight.shadow.mapSize.width = isLowGraphics ? 512 : 1024;
      dirLight.shadow.mapSize.height = isLowGraphics ? 512 : 1024;
      scene.add(dirLight);
      dirLightRef.current = dirLight;

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
      fillLight.position.set(-60, 40, -60);
      scene.add(fillLight);

      // Initial Board PCB and Grid
      updateBoardMesh(scene, doc.board.width || 180, doc.board.depth || 120, doc.board.thickness || 4);

      // Render loop
      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();
      setIsLoading(false);

      const handleResize = () => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w === 0 || h === 0) return;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      };

      window.addEventListener('resize', handleResize);

      // ResizeObserver for robust layout resizing
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          handleResize();
        });
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        window.removeEventListener('resize', handleResize);
        if (resizeObserver) resizeObserver.disconnect();
        canvasEl.removeEventListener('webglcontextlost', onContextLost);
        renderer.dispose();
      };
    } catch (err: any) {
      console.error('Failed to initialize 3D scene:', err);
      setSceneError(`Không thể khởi tạo cảnh 3D: ${err.message}`);
      setIsLoading(false);
    }
  }, [webglSupported]);

  // Dynamic Board PCB & Grid updater when board dimensions in ProjectDocument change
  const updateBoardMesh = (
    scene: THREE.Scene,
    boardWidth: number,
    boardDepth: number,
    boardThickness: number
  ) => {
    // Remove old board
    if (boardMeshRef.current) {
      scene.remove(boardMeshRef.current);
      boardMeshRef.current.geometry.dispose();
      boardMeshRef.current = null;
    }
    // Remove old grid
    if (gridMeshRef.current) {
      scene.remove(gridMeshRef.current);
      gridMeshRef.current.geometry.dispose();
      gridMeshRef.current = null;
    }

    // Create new Board PCB Mesh
    const boardGeo = new THREE.BoxGeometry(boardWidth, boardThickness, boardDepth);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x0f2b20, // Classic solder-mask green
      roughness: 0.6,
      metalness: 0.2,
    });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.y = -boardThickness / 2;
    boardMesh.receiveShadow = !isLowGraphics;
    boardMesh.name = 'pcb_board';
    scene.add(boardMesh);
    boardMeshRef.current = boardMesh;

    // Create new Grid on board
    const gridDivisions = Math.max(10, Math.round(Math.max(boardWidth, boardDepth) / 10));
    const grid = new THREE.GridHelper(
      Math.max(boardWidth, boardDepth),
      gridDivisions,
      0x22c55e,
      0x164e32
    );
    grid.position.y = 0.1;
    scene.add(grid);
    gridMeshRef.current = grid;
  };

  // Re-run board updater whenever doc.board changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const w = doc.board.width || 180;
    const d = doc.board.depth || 120;
    const t = doc.board.thickness || 4;
    updateBoardMesh(scene, w, d, t);
  }, [doc.board.width, doc.board.depth, doc.board.thickness]);

  // Adjust graphics settings when isLowGraphics changes
  useEffect(() => {
    const renderer = rendererRef.current;
    const dirLight = dirLightRef.current;
    if (!renderer) return;

    renderer.shadowMap.enabled = !isLowGraphics;
    renderer.setPixelRatio(isLowGraphics ? 1 : Math.min(window.devicePixelRatio, 2));
    if (dirLight) {
      dirLight.castShadow = !isLowGraphics;
    }
    if (boardMeshRef.current) {
      boardMeshRef.current.receiveShadow = !isLowGraphics;
    }
  }, [isLowGraphics]);

  // Update Components in 3D Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old components
    componentMeshesRef.current.forEach((group) => scene.remove(group));
    componentMeshesRef.current.clear();
    pinHitboxesRef.current = [];

    doc.components.forEach((comp) => {
      const group = new THREE.Group();
      group.position.set(comp.position.x, comp.position.y, comp.position.z);
      group.rotation.y = (comp.rotation * Math.PI) / 180;
      group.name = `comp_${comp.id}`;

      const isSelected = selectedComponentId === comp.id;
      const simState = simulationResult.componentStates[comp.id];

      // Build component specific 3D model
      if (comp.type === 'dc_power_supply') {
        // Battery Supply block
        const bodyGeo = new THREE.BoxGeometry(32, 14, 22);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x2563eb : 0x1e293b,
          roughness: 0.4,
          metalness: 0.5,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 7;
        body.castShadow = true;
        group.add(body);

        // Terminals
        const termGeo = new THREE.CylinderGeometry(2, 2, 4, 16);
        const posMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 });
        const posTerm = new THREE.Mesh(termGeo, posMat);
        posTerm.position.set(-10, 15, 0);
        group.add(posTerm);

        const negMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
        const negTerm = new THREE.Mesh(termGeo, negMat);
        negTerm.position.set(10, 15, 0);
        group.add(negTerm);
      } else if (comp.type === 'resistor') {
        // Ceramic cylindrical body
        const bodyGeo = new THREE.CylinderGeometry(3.5, 3.5, 20, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x3b82f6 : 0xd4b483, // Tan ceramic
          roughness: 0.7,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        body.position.y = 5;
        body.castShadow = true;
        group.add(body);

        // Color bands (Brown, Black, Red, Gold for typical resistor)
        [-5, -1, 3, 7].forEach((xOffset, i) => {
          const bandGeo = new THREE.CylinderGeometry(3.6, 3.6, 1.2, 16);
          const bandColors = [0x991b1b, 0x991b1b, 0x854d0e, 0xeab308]; // 220 ohm colors
          const bandMat = new THREE.MeshStandardMaterial({ color: bandColors[i % 4] });
          const band = new THREE.Mesh(bandGeo, bandMat);
          band.rotation.z = Math.PI / 2;
          band.position.set(xOffset, 5, 0);
          group.add(band);
        });

        // Leads
        const leadGeo = new THREE.CylinderGeometry(0.8, 0.8, 12, 8);
        const leadMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
        const lead1 = new THREE.Mesh(leadGeo, leadMat);
        lead1.rotation.z = Math.PI / 2;
        lead1.position.set(-14, 5, 0);
        group.add(lead1);

        const lead2 = new THREE.Mesh(leadGeo, leadMat);
        lead2.rotation.z = Math.PI / 2;
        lead2.position.set(14, 5, 0);
        group.add(lead2);
      } else if (comp.type === 'led') {
        // LED 5mm dome
        const domeGeo = new THREE.CylinderGeometry(4.5, 4.5, 9, 24);
        const ledColor = comp.properties.color || '#ef4444';
        const isGlowing = isSimulating && simState?.isActive && !simState.isOverloaded;

        const domeMat = new THREE.MeshStandardMaterial({
          color: simState?.isOverloaded ? 0x111111 : new THREE.Color(ledColor),
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: 0.85,
          emissive: isGlowing ? new THREE.Color(ledColor) : new THREE.Color(0x000000),
          emissiveIntensity: isGlowing ? 2.5 : 0,
        });

        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = 8;
        dome.castShadow = true;
        group.add(dome);

        const capGeo = new THREE.SphereGeometry(4.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const cap = new THREE.Mesh(capGeo, domeMat);
        cap.position.y = 12.5;
        group.add(cap);

        if (isGlowing) {
          const pointLight = new THREE.PointLight(new THREE.Color(ledColor), 2, 60);
          pointLight.position.set(0, 14, 0);
          group.add(pointLight);
        }

        // Leads
        const leadGeo = new THREE.CylinderGeometry(0.7, 0.7, 6, 8);
        const leadMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
        const anode = new THREE.Mesh(leadGeo, leadMat);
        anode.position.set(-6, 3, 0);
        group.add(anode);

        const cathode = new THREE.Mesh(leadGeo, leadMat);
        cathode.position.set(6, 3, 0);
        group.add(cathode);
      } else if (comp.type === 'switch_spst') {
        // SPST switch body
        const baseGeo = new THREE.BoxGeometry(26, 10, 14);
        const baseMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x2563eb : 0x334155,
          roughness: 0.5,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 5;
        group.add(base);

        // Toggle lever
        const isClosed = Boolean(comp.properties.isClosed);
        const leverGeo = new THREE.CylinderGeometry(1.5, 2, 10, 12);
        const leverMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
        const lever = new THREE.Mesh(leverGeo, leverMat);
        lever.position.set(0, 12, 0);
        lever.rotation.z = isClosed ? -0.4 : 0.4;
        group.add(lever);
      }

      // Selection Halo Ring
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(18, 20, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.2;
        group.add(ring);
      }

      // Pin Hitboxes & Visual Sockets
      comp.pins.forEach((pin) => {
        const pinPos = pin.relativePosition;

        // Visual Gold Pad
        const padGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.4, 16);
        const padMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b, // Gold pad
          metalness: 0.9,
          roughness: 0.2,
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.position.set(pinPos.x, 0.2, pinPos.z);
        group.add(padMesh);

        // Invisible Raycast Hitbox for precise click
        const hitGeo = new THREE.SphereGeometry(4.5, 12, 12);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.set(pinPos.x, pinPos.y, pinPos.z);
        group.add(hitbox);

        pinHitboxesRef.current.push({
          mesh: hitbox,
          componentId: comp.id,
          pinId: pin.id,
        });
      });

      scene.add(group);
      componentMeshesRef.current.set(comp.id, group);
    });
  }, [doc.components, selectedComponentId, isSimulating, simulationResult]);

  // Update Wire Connections in 3D Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old wires
    wireMeshesRef.current.forEach((mesh) => scene.remove(mesh));
    wireMeshesRef.current.clear();

    doc.connections.forEach((conn) => {
      const fromComp = doc.components.find((c) => c.id === conn.fromComponentId);
      const toComp = doc.components.find((c) => c.id === conn.toComponentId);
      if (!fromComp || !toComp) return;

      const fromPin = fromComp.pins.find((p) => p.id === conn.fromPinId);
      const toPin = toComp.pins.find((p) => p.id === conn.toPinId);
      if (!fromPin || !toPin) return;

      // Calculate absolute positions
      const p1 = new THREE.Vector3(
        fromComp.position.x + fromPin.relativePosition.x,
        fromPin.relativePosition.y,
        fromComp.position.z + fromPin.relativePosition.z
      );
      const p2 = new THREE.Vector3(
        toComp.position.x + toPin.relativePosition.x,
        toPin.relativePosition.y,
        toComp.position.z + toPin.relativePosition.z
      );

      // Create an arching 3D curve
      const mid = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5);
      mid.y += Math.min(25, p1.distanceTo(p2) * 0.35 + 8);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const points = curve.getPoints(24);
      const wireGeo = new THREE.BufferGeometry().setFromPoints(points);

      const isSelected = selectedWireId === conn.id;
      const wireColor = isSelected ? 0x38bdf8 : parseInt(conn.color.replace('#', '0x'), 16) || 0x22c55e;

      const wireMat = new THREE.LineBasicMaterial({
        color: wireColor,
        linewidth: isSelected ? 4 : 2,
      });

      const wireLine = new THREE.Line(wireGeo, wireMat);
      wireLine.name = `wire_${conn.id}`;
      scene.add(wireLine);
      wireMeshesRef.current.set(conn.id, wireLine);
    });
  }, [doc.connections, doc.components, selectedWireId]);

  // Raycasting & Mouse Events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      // Check pin hits first (high priority for wiring)
      const pinHits = raycaster.intersectObjects(pinHitboxesRef.current.map((p) => p.mesh));
      if (pinHits.length > 0) {
        const hitPinInfo = pinHitboxesRef.current.find((p) => p.mesh === pinHits[0].object);
        if (hitPinInfo) {
          if (!activePinWiring) {
            onStartWire(hitPinInfo.componentId, hitPinInfo.pinId);
          } else {
            if (activePinWiring.componentId !== hitPinInfo.componentId) {
              onFinishWire(hitPinInfo.componentId, hitPinInfo.pinId);
            } else {
              onCancelWire();
            }
          }
          return;
        }
      }

      // Check component click or toggle
      const compHitMeshes: THREE.Object3D[] = [];
      componentMeshesRef.current.forEach((group) => {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material.visible !== false) {
            compHitMeshes.push(child);
          }
        });
      });

      const compHits = raycaster.intersectObjects(compHitHitMeshes(compHitMeshes));
      if (compHits.length > 0) {
        let rootGroup: THREE.Object3D | null = compHits[0].object;
        while (rootGroup && !rootGroup.name.startsWith('comp_')) {
          rootGroup = rootGroup.parent;
        }
        if (rootGroup) {
          const compId = rootGroup.name.replace('comp_', '');
          const clickedComp = doc.components.find((c) => c.id === compId);

          if (clickedComp?.type === 'switch_spst' && e.detail >= 1) {
            onToggleSwitch(compId);
          }

          onSelectComponent(compId);
          onSelectWire(null);

          // Prepare drag
          isDraggingRef.current = true;
          draggedCompIdRef.current = compId;
          dragStartPosRef.current = { ...clickedComp!.position };
          return;
        }
      }

      // Check wire click
      const wireHits = raycaster.intersectObjects(Array.from(wireMeshesRef.current.values()));
      if (wireHits.length > 0) {
        const wireId = wireHits[0].object.name.replace('wire_', '');
        onSelectWire(wireId);
        onSelectComponent(null);
        return;
      }

      // If clicked empty space, initiate camera orbit or pan
      if (e.button === 0 && !e.shiftKey) {
        isOrbitingRef.current = true;
      } else if (e.button === 2 || e.shiftKey) {
        isPanningRef.current = true;
      }
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

      onSelectComponent(null);
      onSelectWire(null);
      if (activePinWiring) onCancelWire();
    },
    [doc.components, activePinWiring, onStartWire, onFinishWire, onCancelWire, onSelectComponent, onSelectWire, onToggleSwitch]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Handle Component Dragging
      if (isDraggingRef.current && draggedCompIdRef.current) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);

        if (intersectPoint) {
          // Snap to 10mm grid
          const gridSize = doc.board.gridSize || 10;
          const snappedX = Math.round(intersectPoint.x / gridSize) * gridSize;
          const snappedZ = Math.round(intersectPoint.z / gridSize) * gridSize;

          // Boundary clamp
          const halfW = (doc.board.width || 180) / 2 - 10;
          const halfD = (doc.board.depth || 120) / 2 - 10;
          const clampedX = Math.max(-halfW, Math.min(halfW, snappedX));
          const clampedZ = Math.max(-halfD, Math.min(halfD, snappedZ));

          onMoveComponent(draggedCompIdRef.current, { x: clampedX, y: 0, z: clampedZ });
        }
        return;
      }

      // Handle Orbit / Pan
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

      if (isOrbitingRef.current && cameraRef.current) {
        const camera = cameraRef.current;
        const offset = camera.position.clone().sub(cameraTargetRef.current);
        const radius = offset.length();
        let theta = Math.atan2(offset.x, offset.z);
        let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

        theta -= deltaX * 0.008;
        phi -= deltaY * 0.008;
        phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi)); // Don't flip upside down

        camera.position.x = cameraTargetRef.current.x + radius * Math.sin(phi) * Math.sin(theta);
        camera.position.y = cameraTargetRef.current.y + radius * Math.cos(phi);
        camera.position.z = cameraTargetRef.current.z + radius * Math.sin(phi) * Math.cos(theta);
        camera.lookAt(cameraTargetRef.current);
      } else if (isPanningRef.current && cameraRef.current) {
        const camera = cameraRef.current;
        const panSpeed = 0.15;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        const panOffset = right.clone().multiplyScalar(-deltaX * panSpeed).add(up.clone().multiplyScalar(deltaY * panSpeed));
        camera.position.add(panOffset);
        cameraTargetRef.current.add(panOffset);
        camera.lookAt(cameraTargetRef.current);
      }
    },
    [doc.board, onMoveComponent]
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
    draggedCompIdRef.current = null;
    isOrbitingRef.current = false;
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!cameraRef.current) return;
    const zoomFactor = e.deltaY * 0.12;
    const camera = cameraRef.current;
    const dir = camera.position.clone().sub(cameraTargetRef.current).normalize();
    const newDist = camera.position.distanceTo(cameraTargetRef.current) + zoomFactor;

    if (newDist > 40 && newDist < 400) {
      camera.position.copy(cameraTargetRef.current.clone().add(dir.multiplyScalar(newDist)));
    }
  }, []);

  const handleResetCamera = () => {
    if (!cameraRef.current) return;
    cameraTargetRef.current.set(0, 0, 0);
    cameraRef.current.position.set(0, 140, 160);
    cameraRef.current.lookAt(0, 0, 0);
  };

  const handleTopDownCamera = () => {
    if (!cameraRef.current) return;
    cameraTargetRef.current.set(0, 0, 0);
    cameraRef.current.position.set(0, 200, 0.001);
    cameraRef.current.lookAt(0, 0, 0);
  };

  const handleZoomIn = () => {
    if (!cameraRef.current) return;
    const dir = cameraRef.current.position.clone().sub(cameraTargetRef.current).normalize();
    const dist = cameraRef.current.position.distanceTo(cameraTargetRef.current);
    const newDist = Math.max(45, dist - 25);
    cameraRef.current.position.copy(cameraTargetRef.current.clone().add(dir.multiplyScalar(newDist)));
  };

  const handleZoomOut = () => {
    if (!cameraRef.current) return;
    const dir = cameraRef.current.position.clone().sub(cameraTargetRef.current).normalize();
    const dist = cameraRef.current.position.distanceTo(cameraTargetRef.current);
    const newDist = Math.min(350, dist + 25);
    cameraRef.current.position.copy(cameraTargetRef.current.clone().add(dir.multiplyScalar(newDist)));
  };

  // Fallback if WebGL is not supported
  if (!webglSupported) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 bg-slate-950 select-none">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Đồ họa 3D không khả dụng</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Trình duyệt hoặc phần cứng đồ họa hiện tại chưa kích hoạt WebGL. Vui lòng bật tính năng 
              <strong> Tăng tốc phần cứng (Hardware Acceleration) </strong> trong cài đặt trình duyệt để xem mô hình mạch 3D.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition cursor-pointer"
          >
            Thử tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950">
      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-400">
            {language === 'vi' ? 'Đang khởi tạo không gian 3D...' : 'Initializing 3D Workspace...'}
          </span>
        </div>
      )}

      {/* Context lost / Scene Error Overlay */}
      {sceneError && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm p-5 bg-rose-950/40 border border-rose-800/80 rounded-2xl space-y-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-200">{sceneError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-xs font-medium rounded-lg transition"
            >
              {language === 'vi' ? 'Tải lại trang' : 'Reload Page'}
            </button>
          </div>
        </div>
      )}

      {/* Top-Left Navigation Guide Pill */}
      <div className="absolute top-4 left-4 hidden md:flex items-center gap-2 bg-slate-900/75 backdrop-blur-md border border-slate-800/80 px-3 py-1.5 rounded-full text-[11px] text-slate-400 shadow-sm pointer-events-none">
        <span className="text-slate-300 font-medium">{language === 'vi' ? 'Chuột trái/phải:' : 'Left/Right drag:'}</span> {language === 'vi' ? 'Xoay 3D' : 'Rotate'}
        <span className="text-slate-600">•</span>
        <span className="text-slate-300 font-medium">{language === 'vi' ? 'Shift + Kéo:' : 'Shift + Drag:'}</span> {language === 'vi' ? 'Di chuyển' : 'Pan'}
        <span className="text-slate-600">•</span>
        <span className="text-slate-300 font-medium">{language === 'vi' ? 'Lăn chuột:' : 'Scroll:'}</span> {language === 'vi' ? 'Thu phóng' : 'Zoom'}
      </div>

      {/* Floating Canvas Controls (HUD) */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-lg">
        {/* Reset 3D View */}
        <button
          onClick={handleResetCamera}
          className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
          title={language === 'vi' ? 'Đặt lại góc nhìn 3D ban đầu' : 'Reset 3D view'}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Góc 3D' : '3D View'}</span>
        </button>

        {/* Top-down 2D View */}
        <button
          onClick={handleTopDownCamera}
          className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
          title={language === 'vi' ? 'Góc nhìn phẳng từ trên xuống' : 'Top-down orthogonal view'}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Nhìn 2D' : '2D View'}</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />

        {/* Zoom Controls */}
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          title={language === 'vi' ? 'Phóng to' : 'Zoom in'}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          title={language === 'vi' ? 'Thu nhỏ' : 'Zoom out'}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-slate-800 mx-0.5" />

        {/* Low-graphics toggle */}
        <button
          onClick={() => {
            if (onToggleLowGraphics) {
              onToggleLowGraphics();
            } else {
              setInternalLowGraphics(!internalLowGraphics);
            }
          }}
          className={`px-2 py-1 text-[11px] font-medium rounded-lg transition flex items-center gap-1.5 ${
            isLowGraphics
              ? 'bg-amber-950/70 border border-amber-800/80 text-amber-300'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title={
            isLowGraphics
              ? language === 'vi' ? 'Đang ở chế độ đồ họa thấp (Tiết kiệm)' : 'Currently in low graphics mode'
              : language === 'vi' ? 'Chuyển sang chế độ đồ họa thấp cho máy yếu' : 'Switch to low graphics mode'
          }
        >
          <Gauge className="w-3 h-3" />
          <span>
            {isLowGraphics
              ? language === 'vi' ? 'Đồ họa thấp' : 'Low Graphics'
              : language === 'vi' ? 'Đồ họa cao' : 'High Graphics'}
          </span>
        </button>
      </div>

      {/* Active Pin Wiring Indicator */}
      {activePinWiring && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-sky-950/90 border border-sky-600 text-sky-200 px-4 py-2 rounded-full text-xs font-medium shadow-xl flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>
            {language === 'vi'
              ? 'Đang nối dây: Nhấp vào chân linh kiện thứ hai để hoàn thành (Nhấn ESC để hủy)'
              : 'Wiring: Click second component pin to complete (Press ESC to cancel)'}
          </span>
          <button
            onClick={onCancelWire}
            className="ml-2 underline text-sky-300 hover:text-white cursor-pointer"
          >
            {language === 'vi' ? 'Hủy' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
};

function compHitHitMeshes(meshes: THREE.Object3D[]): THREE.Object3D[] {
  return meshes.filter((m) => m instanceof THREE.Mesh);
}
