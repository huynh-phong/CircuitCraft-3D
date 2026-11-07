import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { clearGroup, disposeObjectTree } from './disposal';
import { ReconcileStats, reconcileChildren } from './sceneReconciler';
import { ProjectDocument, ComponentInstance, Connection, Vector3D, BoardDefinition } from '../domain/project/types';
import { COMPONENT_DEFINITION_MAP } from '../domain/components/definitions';
import { SceneMaterialRegistry } from './materials';
import { applyComponentTransform, componentVisualSignature, createComponentMesh } from './proceduralModels';
import { componentLayoutHash, createPreviewWireMesh, createWireMesh, wireVisualSignature } from './wires';
import { Minibot3D, MinibotState } from './minibot3D';
import { snapToGrid, calculatePinWorldPosition } from '../domain/project/coordinates';
import { SimulationResult } from '../domain/simulation/types';
import { useI18n } from '../i18n/context';
import {
  getBoardPerimeter,
  getClosestPointOnPerimeter,
  isPointInsideBoard,
} from '../domain/project/boardGeometry';
import { PanelRightOpen, PanelRightClose, Eye, Maximize2, RotateCcw, Target, Compass } from 'lucide-react';

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
  /** Touch / pen: press and hold a part (opens its properties). */
  onLongPressComponent?: (componentId: string) => void;
  showGrid?: boolean;
  activeWireColor?: string;
  isRightInspectorCollapsed?: boolean;
  onToggleRightInspector?: () => void;
  placingComponentId?: string | null;
  onPlacedComponent?: () => void;
}

/** Development aid: how much work the scene did, readable from the browser console. */
function reportSceneStats(kind: 'components' | 'wires', stats: ReconcileStats, startedAt: number) {
  if (!import.meta.env.DEV) return;
  const w = window as any;
  const totals = (w.__cc3dSceneStats ??= {
    components: { built: 0, kept: 0, removed: 0, passes: 0, lastMs: 0 },
    wires: { built: 0, kept: 0, removed: 0, passes: 0, lastMs: 0 },
  })[kind];
  totals.built += stats.built;
  totals.kept += stats.kept;
  totals.removed += stats.removed;
  totals.passes += 1;
  totals.lastMs = performance.now() - startedAt;
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
  isRightInspectorCollapsed = false,
  onToggleRightInspector,
  placingComponentId,
  onPlacedComponent,
  onLongPressComponent,
}) => {
  const { effectiveTheme, language } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  // The render loop outlives individual renders: it reads the latest props through this ref
  const latestPropsRef = useRef({ document, simulationResult, isExplodedView });
  latestPropsRef.current = { document, simulationResult, isExplodedView };
  const instancesByMeshNameRef = useRef(new Map<string, ComponentInstance>());

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

  // Touch & pen gestures. Every active pointer is tracked so that a second finger turns the gesture
  // into camera control (pinch zoom + two-finger pan) and cancels a part drag started by the first.
  const activePointersRef = useRef(new Map<number, { x: number; y: number; type: string }>());
  const primaryPointerIdRef = useRef<number | null>(null);
  const pinchRef = useRef<{ startDistance: number; startRadius: number; lastMid: { x: number; y: number } } | null>(null);
  /** After a two-finger gesture, remaining fingers do nothing until all are lifted. */
  const gestureLockRef = useRef(false);
  /** Last time a stylus touched the screen: palm contacts right after are ignored. */
  const penActiveAtRef = useRef(0);
  const longPressRef = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  // WebGL can lose its context (GPU reset, backgrounded tab on mobile): the scene is rebuilt on restore
  const [contextEpoch, setContextEpoch] = useState(0);
  const [isContextLost, setIsContextLost] = useState(false);

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

  // Damped Camera State & Target Vectors
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraRadiusRef = useRef<number>(140);
  const targetRadiusRef = useRef<number>(140);
  const cameraThetaRef = useRef<number>(Math.PI / 4); // Horizontal angle
  const targetThetaRef = useRef<number>(Math.PI / 4);
  const cameraPhiRef = useRef<number>(Math.PI / 3); // Vertical angle
  const targetPhiRef = useRef<number>(Math.PI / 3);

  // Inertia angular velocities (decayed with friction on release)
  const orbitVelocityRef = useRef<{ theta: number; phi: number }>({ theta: 0, phi: 0 });

  // Camera flight preset transition controller
  const cameraTransitionRef = useRef<{
    startTime: number;
    duration: number;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromRadius: number;
    toRadius: number;
    fromTheta: number;
    deltaTheta: number;
    fromPhi: number;
    toPhi: number;
  } | null>(null);

  // Active view preset state for UI feedback
  const [activePreset, setActivePreset] = useState<'perspective' | 'top' | 'isometric' | 'reset' | 'fit'>('perspective');

  // Settling components map: component instanceId -> settle start timestamp
  const settlingComponentsRef = useRef<Map<string, { startTime: number }>>(new Map());

  // Raycaster & Plane
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseCoordsRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const groundPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  // Exploded view animation value (0 = normal, 1 = exploded)
  const explodedProgressRef = useRef<number>(0);

  // Tooltip UI state
  const [hoveredPinInfo, setHoveredPinInfo] = useState<{
    componentId: string;
    pinId: string;
    name: string;
    designator?: string;
    x: number;
    y: number;
  } | null>(null);

  // Immediately apply Camera position from current spherical coordinates
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const r = cameraRadiusRef.current;
    const phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, cameraPhiRef.current));
    const theta = cameraThetaRef.current;
    const target = cameraTargetRef.current;

    const x = target.x + r * Math.sin(phi) * Math.sin(theta);
    const y = target.y + r * Math.cos(phi);
    const z = target.z + r * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
  }, []);

  // Smooth cinematic flyCameraTo controller with easeInOut trajectory
  const flyCameraTo = useCallback(
    (opts: {
      target?: THREE.Vector3;
      radius?: number;
      theta?: number;
      phi?: number;
      duration?: number;
    }) => {
      const toTarget = opts.target || new THREE.Vector3(0, 0, 0);
      const toRadius = opts.radius ?? 140;
      const toPhi = opts.phi ?? Math.PI / 3;
      const toTheta = opts.theta ?? Math.PI / 4;

      // Calculate shortest angular path so theta never spins 360 unnecessarily
      let deltaTheta = toTheta - cameraThetaRef.current;
      while (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
      while (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;

      cameraTransitionRef.current = {
        startTime: performance.now(),
        duration: (opts.duration ?? 650) / 1000,
        fromTarget: cameraTargetRef.current.clone(),
        toTarget: toTarget.clone(),
        fromRadius: cameraRadiusRef.current,
        toRadius,
        fromTheta: cameraThetaRef.current,
        deltaTheta,
        fromPhi: cameraPhiRef.current,
        toPhi,
      };
      orbitVelocityRef.current = { theta: 0, phi: 0 };
    },
    []
  );

  // Set standard view presets with smooth cinematic trajectory
  const setView = useCallback(
    (mode: 'top' | 'perspective' | 'isometric' | 'reset' | 'fit') => {
      setActivePreset(mode);
      if (mode === 'top') {
        flyCameraTo({
          target: new THREE.Vector3(0, 0, 0),
          radius: 150,
          theta: 0,
          phi: 0.08,
          duration: 650,
        });
      } else if (mode === 'perspective') {
        flyCameraTo({
          target: new THREE.Vector3(0, 0, 0),
          radius: 145,
          theta: Math.PI / 4,
          phi: Math.PI / 3.2,
          duration: 650,
        });
      } else if (mode === 'isometric') {
        flyCameraTo({
          target: new THREE.Vector3(0, 0, 0),
          radius: 160,
          theta: Math.PI / 4,
          phi: Math.atan(1 / Math.SQRT2),
          duration: 650,
        });
      } else if (mode === 'reset') {
        flyCameraTo({
          target: new THREE.Vector3(0, 0, 0),
          radius: 140,
          theta: Math.PI / 4,
          phi: Math.PI / 3,
          duration: 650,
        });
      } else if (mode === 'fit') {
        // Compute bounding box encompassing board and all placed components
        const box = new THREE.Box3();
        const halfW = document.board.width / 2;
        const halfD = document.board.depth / 2;
        box.expandByPoint(new THREE.Vector3(-halfW, 0, -halfD));
        box.expandByPoint(new THREE.Vector3(halfW, 10, halfD));
        for (const comp of document.components) {
          box.expandByPoint(new THREE.Vector3(comp.position.x - 10, comp.position.y, comp.position.z - 10));
          box.expandByPoint(new THREE.Vector3(comp.position.x + 10, comp.position.y + 14, comp.position.z + 10));
        }
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.z, 60);
        const fitRadius = Math.max(90, Math.min(280, maxDim * 1.55));
        flyCameraTo({
          target: center,
          radius: fitRadius,
          theta: Math.PI / 4,
          phi: Math.PI / 3.2,
          duration: 700,
        });
      }
    },
    [flyCameraTo, document.board, document.components]
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
      logarithmicDepthBuffer: true,
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

    const handleContextLost = (event: Event) => {
      // Ask the browser to give the context back; nothing in the project depends on the GPU
      event.preventDefault();
      setIsContextLost(true);
    };
    const handleContextRestored = () => {
      setIsContextLost(false);
      setContextEpoch((n) => n + 1);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

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

      // 1. Camera Auto-Flight Transition / Damping & Inertia
      if (cameraTransitionRef.current) {
        const tr = cameraTransitionRef.current;
        const elapsed = (time - tr.startTime) / 1000;
        const t = Math.min(1, Math.max(0, elapsed / tr.duration));
        // Cinematic cubic ease-in-out curve
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        targetRadiusRef.current = THREE.MathUtils.lerp(tr.fromRadius, tr.toRadius, ease);
        targetThetaRef.current = tr.fromTheta + tr.deltaTheta * ease;
        targetPhiRef.current = THREE.MathUtils.lerp(tr.fromPhi, tr.toPhi, ease);
        targetLookAtRef.current.lerpVectors(tr.fromTarget, tr.toTarget, ease);

        cameraRadiusRef.current = targetRadiusRef.current;
        cameraThetaRef.current = targetThetaRef.current;
        cameraPhiRef.current = targetPhiRef.current;
        cameraTargetRef.current.copy(targetLookAtRef.current);

        if (t >= 1) {
          cameraTransitionRef.current = null;
        }
      } else {
        // Natural inertia when releasing pointer while orbiting
        if (!isOrbitingRef.current && (Math.abs(orbitVelocityRef.current.theta) > 0.00004 || Math.abs(orbitVelocityRef.current.phi) > 0.00004)) {
          targetThetaRef.current += orbitVelocityRef.current.theta;
          targetPhiRef.current = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, targetPhiRef.current + orbitVelocityRef.current.phi));
          const friction = Math.exp(-6.8 * delta);
          orbitVelocityRef.current.theta *= friction;
          orbitVelocityRef.current.phi *= friction;
        }

        // Presentation Mode Turntable auto-orbit
        if (isPresentationMode && !isOrbitingRef.current && !isPanningRef.current && !isDraggingRef.current) {
          targetThetaRef.current += delta * 0.22;
        }

        // Smooth exponential damping towards user target (smooth CAD feel)
        const dampFactor = Math.min(1, 1 - Math.exp(-14 * delta));
        cameraRadiusRef.current = THREE.MathUtils.lerp(cameraRadiusRef.current, targetRadiusRef.current, dampFactor);
        cameraThetaRef.current = THREE.MathUtils.lerp(cameraThetaRef.current, targetThetaRef.current, dampFactor);
        cameraPhiRef.current = THREE.MathUtils.lerp(cameraPhiRef.current, targetPhiRef.current, dampFactor);
        cameraTargetRef.current.lerp(targetLookAtRef.current, dampFactor);
      }

      // Synchronize Three.js camera position & orientation
      const r = cameraRadiusRef.current;
      const phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, cameraPhiRef.current));
      const theta = cameraThetaRef.current;
      const camTarget = cameraTargetRef.current;

      camera.position.set(
        camTarget.x + r * Math.sin(phi) * Math.sin(theta),
        camTarget.y + r * Math.cos(phi),
        camTarget.z + r * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(camTarget);

      // 2. Smooth Exploded View transition
      const latest = latestPropsRef.current;
      const targetExploded = latest.isExplodedView ? 1 : 0;
      explodedProgressRef.current = THREE.MathUtils.lerp(explodedProgressRef.current, targetExploded, delta * 5);

      // Apply vertical elevation to components based on deterministic layer logic
      componentsGroupRef.current.children.forEach((child, index) => {
        const baseInstance = instancesByMeshNameRef.current.get(child.name);
        if (baseInstance) {
          const def = COMPONENT_DEFINITION_MAP.get(baseInstance.definitionId);
          const layerOffset = (def?.category === 'power' ? 24 : def?.category === 'passives' ? 14 : 32) + (index % 5) * 2;
          const explodedY = layerOffset * explodedProgressRef.current;
          child.position.y = baseInstance.position.y + explodedY;
        }
      });

      // 3. Tactile Settling Bounce Animation on newly dropped / placed components
      if (settlingComponentsRef.current.size > 0) {
        const nowMs = performance.now();
        settlingComponentsRef.current.forEach((info, compId) => {
          const child = componentsGroupRef.current.children.find((c) => c.name === `comp-${compId}`);
          const comp = instancesByMeshNameRef.current.get(`comp-${compId}`);
          if (child && comp) {
            const elapsed = (nowMs - info.startTime) / 1000;
            if (elapsed < 0.28) {
              const settleBounce = Math.sin(elapsed * 28) * Math.exp(-14 * elapsed) * 1.6;
              child.position.y = comp.position.y + settleBounce;
            } else {
              child.position.y = comp.position.y;
              settlingComponentsRef.current.delete(compId);
            }
          } else {
            settlingComponentsRef.current.delete(compId);
          }
        });
      }

      // 4. Electrical Current Flow Pulse Animation along connected wires
      const isCircuitActive = Boolean(latest.simulationResult && latest.simulationResult.status === 'running');
      wiresGroupRef.current.children.forEach((wireGroup, wireIdx) => {
        const pulseMesh = wireGroup.children.find((c) => c.name === 'electric-pulse') as THREE.Mesh | undefined;
        if (pulseMesh && pulseMesh.userData?.curve) {
          const curve = pulseMesh.userData.curve as THREE.Curve<THREE.Vector3>;
          const mat = pulseMesh.material as THREE.MeshBasicMaterial;
          if (isCircuitActive) {
            pulseMesh.visible = true;
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.9, delta * 6);
            const progress = ((time / 1000) * 0.45 + wireIdx * 0.22) % 1.0;
            const pt = curve.getPointAt(progress);
            pulseMesh.position.copy(pt);
          } else {
            mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, delta * 8);
            if (mat.opacity <= 0.04) {
              pulseMesh.visible = false;
            }
          }
        }
      });

      // 5. Update Minibot bobbing & hover
      if (minibotRef.current) {
        minibotRef.current.update(delta);
      }

      // 6. Update selection bounding box
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
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored, false);
      // The Minibot is re-created with the scene: release its GPU resources
      scene.remove(minibot.group);
      disposeObjectTree(minibot.group);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, [isPresentationMode, qualityPreset, contextEpoch]);

  // Release board / component / wire meshes when the workspace is unmounted
  useEffect(() => {
    return () => {
      clearGroup(boardGroupRef.current);
      clearGroup(resizeHandlesGroupRef.current);
      clearGroup(componentsGroupRef.current);
      clearGroup(wiresGroupRef.current);
      disposeObjectTree(previewWireRef.current);
      disposeObjectTree(cutLineMeshRef.current);
      disposeObjectTree(selectionOutlineRef.current);
    };
  }, []);

  // Reactively update scene background and workbench without re-creating scene or resetting camera
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
    clearGroup(boardGroup);

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
      const padGeom = new THREE.CircleGeometry(0.48, 12);
      padGeom.rotateX(-Math.PI / 2);
      padGeom.computeBoundingBox();
      padGeom.computeBoundingSphere();
      const padMat = mats.pcbPadMaterial;

      const halfW = w / 2 - 4;
      const halfD = d / 2 - 4;
      const step = document.board.gridSpacing || 2.54;

      const countX = Math.floor((halfW * 2) / step);
      const countZ = Math.floor((halfD * 2) / step);
      const totalPads = countX * countZ;

      if (totalPads < 4000) {
        const instancedPads = new THREE.InstancedMesh(padGeom, padMat, totalPads);
        instancedPads.position.set(0, 0.08, 0);
        instancedPads.frustumCulled = false; // CRITICAL: Never cull pad dots when zooming in closely!

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
    clearGroup(handlesGroup);

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
      disposeObjectTree(cutLineMeshRef.current);
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
        disposeObjectTree(cutLineMeshRef.current);
        cutLineMeshRef.current = null;
      }
    };
  }, [isCutMode, cutPointsState]);

  // Pin Highlights (Zero-clutter: only hovered pin or active wire start pin lights up)
  useEffect(() => {
    componentsGroupRef.current.traverse((child) => {
      if (child.name?.startsWith('pin-') && (child as any).isGroup && child.userData?.isPin) {
        let beacon = child.getObjectByName('pin-beacon') as THREE.Mesh;
        const pinY = child.userData.localOffset?.y ?? 1.0;
        if (!beacon) {
          const ringGeom = new THREE.RingGeometry(0.35, 1.05, 20);
          ringGeom.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x38bdf8,
            emissiveIntensity: 1.6,
            roughness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
          });
          beacon = new THREE.Mesh(ringGeom, ringMat);
          beacon.name = 'pin-beacon';
          beacon.position.set(0, pinY + 0.15, 0);
          child.add(beacon);
        }

        const { componentId, pinId } = child.userData;
        const isStartPin = Boolean(
          wiringStartPin && wiringStartPin.componentId === componentId && wiringStartPin.pinId === pinId
        );
        const isHovered = Boolean(
          hoveredPinInfo &&
            hoveredPinInfo.componentId === componentId &&
            hoveredPinInfo.pinId === pinId
        );

        // Only show indicator if hovered OR if it is the currently active start pin
        if (isStartPin || isHovered) {
          beacon.visible = true;
          const mat = beacon.material as THREE.MeshStandardMaterial;
          if (isStartPin) {
            mat.color.setHex(0xf59e0b); // Pulsing Gold
            mat.emissive.setHex(0xf59e0b);
            mat.emissiveIntensity = 2.2;
            beacon.scale.set(1.2, 1.2, 1.2);
          } else {
            mat.color.setHex(0x38bdf8); // Bright Luminous Cyan
            mat.emissive.setHex(0x38bdf8);
            mat.emissiveIntensity = 1.8;
            beacon.scale.set(1.0, 1.0, 1.0);
          }
        } else {
          beacon.visible = false;
        }
      }
    });
  }, [isWiringMode, wiringStartPin, hoveredPinInfo, document.components]);

  // Build / Update Component Meshes
  useEffect(() => {
    const started = performance.now();
    const meshOptions = (inst: ComponentInstance) => ({
      isSimulationOn: simulationResult?.components?.[inst.instanceId]?.isOn || false,
      switchClosed: switchStates[inst.instanceId] ?? (inst.state?.open === false),
    });

    instancesByMeshNameRef.current = new Map(document.components.map((c) => [`comp-${c.instanceId}`, c]));

    const items = document.components.flatMap((inst) => {
      const def = COMPONENT_DEFINITION_MAP.get(inst.definitionId);
      if (!def) return [];
      return [{ key: inst.instanceId, signature: componentVisualSignature(inst, def, meshOptions(inst)), data: inst }];
    });

    const stats = reconcileChildren(
      componentsGroupRef.current,
      items,
      (inst) => createComponentMesh(inst, COMPONENT_DEFINITION_MAP.get(inst.definitionId)!, meshOptions(inst)),
      (group, inst) => applyComponentTransform(group, inst)
    );
    reportSceneStats('components', stats, started);
  }, [document.components, simulationResult, switchStates]);

  // Selection outline: selecting a component never touches its mesh
  useEffect(() => {
    if (!sceneRef.current) return;
    if (selectionOutlineRef.current) {
      sceneRef.current.remove(selectionOutlineRef.current);
      disposeObjectTree(selectionOutlineRef.current);
      selectionOutlineRef.current = null;
    }
    if (!selectedComponentId) return;
    const meshGroup = componentsGroupRef.current.children.find((c) => c.name === `comp-${selectedComponentId}`);
    if (meshGroup) {
      const box = new THREE.BoxHelper(meshGroup, 0x38bdf8);
      box.name = 'selection-outline';
      selectionOutlineRef.current = box;
      sceneRef.current.add(box);
    }
  }, [selectedComponentId, document.components, simulationResult, switchStates, isPresentationMode, qualityPreset]);

  // Build / Update Wires
  useEffect(() => {
    const started = performance.now();
    const layoutHash = componentLayoutHash(document.components);
    const stats = reconcileChildren(
      wiresGroupRef.current,
      document.connections.map((conn) => ({
        key: conn.id,
        signature: wireVisualSignature(conn, document.components, conn.id === selectedConnectionId, layoutHash),
        data: conn,
      })),
      (conn) => createWireMesh(conn, document.components, conn.id === selectedConnectionId)
    );
    reportSceneStats('wires', stats, started);
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

  // Active placement from Component Library (attached to mouse cursor)
  useEffect(() => {
    if (placingComponentId) {
      const comp = document.components.find((c) => c.instanceId === placingComponentId);
      if (comp) {
        isDraggingRef.current = true;
        draggedCompIdRef.current = placingComponentId;
        dragStartPosRef.current = { ...comp.position };
        currentDragPosRef.current = { ...comp.position };
        dragOffsetRef.current = { x: 0, z: 0 };
      }
    }
  }, [placingComponentId, document.components]);

  // Track cursor movement across window while placing new component
  useEffect(() => {
    if (!placingComponentId) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !cameraRef.current) return;

      mouseCoordsRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoordsRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseCoordsRef.current, cameraRef.current);

      const intersectionPoint = new THREE.Vector3();
      if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, intersectionPoint)) {
        const step = e.shiftKey ? 0.5 : (document.board.gridSpacing || 2.54);
        let snappedX = snapToGrid(intersectionPoint.x, step);
        let snappedZ = snapToGrid(intersectionPoint.z, step);
        let targetY = 0;

        const breadboard = document.components.find((c) => c.definitionId === 'breadboard');
        const isDraggedBreadboard = placingComponentId === breadboard?.instanceId;

        if (breadboard && !isDraggedBreadboard) {
          const bbHalfW = 165 / 2;
          const bbHalfD = 55 / 2;
          const relX = snappedX - breadboard.position.x;
          const relZ = snappedZ - breadboard.position.z;

          if (Math.abs(relX) <= bbHalfW + 3 && Math.abs(relZ) <= bbHalfD + 3) {
            targetY = 9.8;
            const bbPitch = 2.54;
            const snappedCol = Math.max(1, Math.min(60, Math.round(relX / bbPitch + 29.5 + 1)));
            snappedX = breadboard.position.x + Number(((snappedCol - 1 - 29.5) * bbPitch).toFixed(2));

            const validZs = [-25.8, -23.5, -14.0, -11.46, -8.92, -6.38, -3.84, 3.84, 6.38, 8.92, 11.46, 14.0, 23.5, 25.8];
            const nearestZ = validZs.reduce((prev, curr) => (Math.abs(curr - relZ) < Math.abs(prev - relZ) ? curr : prev), validZs[0]);
            snappedZ = breadboard.position.z + nearestZ;
          }
        }

        currentDragPosRef.current = { x: snappedX, y: targetY, z: snappedZ };

        const meshGroup = componentsGroupRef.current.children.find(
          (c) => c.name === `comp-${placingComponentId}`
        );
        if (meshGroup) {
          meshGroup.position.set(snappedX, targetY, snappedZ);
        }
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    return () => window.removeEventListener('pointermove', handleWindowPointerMove);
  }, [placingComponentId, document.components, document.board.gridSpacing]);

  /** Nearest pin to a screen point, in pixels, among all placed parts. */
  const findNearestPin = (clientX: number, clientY: number, rect: DOMRect, maxDistancePx: number) => {
    const camera = cameraRef.current;
    if (!camera) return null;
    let best: { componentId: string; pinId: string; worldPos: Vector3D; distance: number } | null = null;
    const projected = new THREE.Vector3();
    for (const comp of document.components) {
      const def = COMPONENT_DEFINITION_MAP.get(comp.definitionId);
      if (!def) continue;
      for (const pin of def.pins) {
        const world = calculatePinWorldPosition(comp, pin.localOffset);
        projected.set(world.x, world.y, world.z).project(camera);
        if (projected.z > 1) continue; // behind the camera
        const sx = ((projected.x + 1) / 2) * rect.width + rect.left;
        const sy = ((1 - projected.y) / 2) * rect.height + rect.top;
        const distance = Math.hypot(sx - clientX, sy - clientY);
        if (distance <= maxDistancePx && (!best || distance < best.distance)) {
          best = { componentId: comp.instanceId, pinId: pin.id, worldPos: world, distance };
        }
      }
    }
    return best;
  };

  const panCameraByPixels = (dx: number, dy: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !cameraRef.current) return;
    cameraRef.current.updateMatrixWorld();
    const cameraMatrix = cameraRef.current.matrixWorld;
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0).normalize();
    const cameraUp = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1).normalize();
    const fovRad = ((cameraRef.current.fov || 40) * Math.PI) / 180;
    const panFactor = (cameraRadiusRef.current * 2 * Math.tan(fovRad / 2)) / rect.height;
    targetLookAtRef.current.addScaledVector(cameraRight, -dx * panFactor);
    targetLookAtRef.current.addScaledVector(cameraUp, dy * panFactor);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  };

  /** A second finger arrived: undo what the first one started, without recording anything. */
  const abandonSingleFingerAction = () => {
    cancelLongPress();
    isOrbitingRef.current = false;
    isPanningRef.current = false;
    orbitVelocityRef.current = { theta: 0, phi: 0 };
    if (isDraggingRef.current && draggedCompIdRef.current && dragStartPosRef.current) {
      const start = dragStartPosRef.current;
      const mesh = componentsGroupRef.current.children.find((c) => c.name === `comp-${draggedCompIdRef.current}`);
      mesh?.position.set(start.x, start.y, start.z);
    }
    if (draggedCompIdRef.current !== placingComponentId) {
      isDraggingRef.current = false;
      draggedCompIdRef.current = null;
      dragStartPosRef.current = null;
      currentDragPosRef.current = null;
    }
    if (isResizingBoardRef.current) {
      isResizingBoardRef.current = false;
      boardGroupRef.current.scale.set(1, 1, 1);
      originalBoardRef.current = null;
      currentResizedBoardRef.current = null;
    }
  };

  const twoPointers = () => Array.from(activePointersRef.current.values()).slice(0, 2);

  const onGesturePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const onCanvas = e.target === rendererRef.current?.domElement;
    if (e.pointerType === 'pen') penActiveAtRef.current = Date.now();
    // Palm rejection: a hand resting on the screen while drawing with a stylus
    if (e.pointerType === 'touch' && Date.now() - penActiveAtRef.current < 800) return;
    if (!onCanvas || e.pointerType === 'mouse') {
      handlePointerDown(e);
      return;
    }
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // capture is a convenience only
    }
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (e.pointerType === 'touch' && activePointersRef.current.size >= 2) {
      abandonSingleFingerAction();
      gestureLockRef.current = true;
      const [a, b] = twoPointers();
      pinchRef.current = {
        startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startRadius: targetRadiusRef.current,
        lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      if (cameraTransitionRef.current) cameraTransitionRef.current = null;
      return;
    }
    if (gestureLockRef.current) return;

    primaryPointerIdRef.current = e.pointerId;
    handlePointerDown(e);

    // Press and hold a part (without moving) to open its properties
    const pressedId = draggedCompIdRef.current;
    if (pressedId && pressedId !== placingComponentId && onLongPressComponent) {
      longPressRef.current = {
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          longPressRef.current = null;
          abandonSingleFingerAction();
          // A short haptic tick where allowed (only after the user has interacted with the page)
          if ((navigator as any).userActivation?.hasBeenActive) navigator.vibrate?.(15);
          onLongPressComponent(pressedId);
        }, 550),
      };
    }
  };

  const onGesturePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const tracked = activePointersRef.current.get(e.pointerId);
    if (!tracked) {
      if (e.pointerType === 'touch' && Date.now() - penActiveAtRef.current < 800) return;
      handlePointerMove(e);
      return;
    }
    tracked.x = e.clientX;
    tracked.y = e.clientY;

    if (pinchRef.current && activePointersRef.current.size >= 2) {
      const [a, b] = twoPointers();
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      targetRadiusRef.current = Math.max(30, Math.min(350, (pinchRef.current.startRadius * pinchRef.current.startDistance) / distance));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      panCameraByPixels(mid.x - pinchRef.current.lastMid.x, mid.y - pinchRef.current.lastMid.y);
      pinchRef.current.lastMid = mid;
      return;
    }
    if (gestureLockRef.current || e.pointerId !== primaryPointerIdRef.current) return;

    if (longPressRef.current && Math.hypot(e.clientX - longPressRef.current.x, e.clientY - longPressRef.current.y) > 10) {
      cancelLongPress();
    }
    handlePointerMove(e);
  };

  const onGesturePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) {
      if (e.pointerType === 'touch' && Date.now() - penActiveAtRef.current < 800) return;
      handlePointerUp();
      return;
    }
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) pinchRef.current = null;
    if (e.pointerId === primaryPointerIdRef.current) {
      primaryPointerIdRef.current = null;
      cancelLongPress();
      handlePointerUp();
    }
    if (activePointersRef.current.size === 0) gestureLockRef.current = false;
  };

  useEffect(() => () => cancelLongPress(), []);

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

    // Drop and place newly added component on click
    if (placingComponentId && draggedCompIdRef.current === placingComponentId) {
      const id = placingComponentId;
      const oldPos = dragStartPosRef.current || { x: 0, y: 0, z: 0 };
      const newPos = currentDragPosRef.current || { x: 0, y: 0, z: 0 };

      isDraggingRef.current = false;
      draggedCompIdRef.current = null;
      dragStartPosRef.current = null;
      currentDragPosRef.current = null;

      onMoveComponent(id, oldPos, newPos);
      if (onPlacedComponent) {
        onPlacedComponent();
      }
      return;
    }

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
              disposeObjectTree(cutLineMeshRef.current);
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
    // Pins are a few pixels wide: a finger or pen lands on the nearest pin within reach
    const nearPin =
      isWiringMode && !hitPin && e.pointerType !== 'mouse'
        ? findNearestPin(e.clientX, e.clientY, rect, e.pointerType === 'pen' ? 16 : 28)
        : null;

    if (isWiringMode && (hitPin || nearPin)) {
      const { componentId, pinId } = hitPin ? hitPin.object.userData : nearPin!;

      const targetComp = document.components.find((c) => c.instanceId === componentId);
      const targetDef = targetComp ? COMPONENT_DEFINITION_MAP.get(targetComp.definitionId) : null;
      const targetPinDef = targetDef?.pins.find((p) => p.id === pinId);
      const worldPos: Vector3D = (targetComp && targetPinDef)
        ? calculatePinWorldPosition(targetComp, targetPinDef.localOffset)
        : hitPin
        ? { x: hitPin.point.x, y: hitPin.point.y, z: hitPin.point.z }
        : nearPin!.worldPos;

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

    // Handle Camera Orbit with velocity tracking
    if (isOrbitingRef.current) {
      if (cameraTransitionRef.current) {
        cameraTransitionRef.current = null;
      }
      const dx = clientX - mousePrevRef.current.x;
      const dy = clientY - mousePrevRef.current.y;
      const dTheta = -dx * 0.0072;
      const dPhi = -dy * 0.0072;

      targetThetaRef.current += dTheta;
      targetPhiRef.current = Math.max(0.08, Math.min(Math.PI / 2 - 0.04, targetPhiRef.current + dPhi));
      orbitVelocityRef.current = { theta: dTheta, phi: dPhi };
      mousePrevRef.current = { x: clientX, y: clientY };
      return;
    }

    // Handle Camera Pan (Right-click drag across screen plane)
    if (isPanningRef.current) {
      if (cameraTransitionRef.current) {
        cameraTransitionRef.current = null;
      }
      const dx = clientX - mousePrevRef.current.x;
      const dy = clientY - mousePrevRef.current.y;

      cameraRef.current.updateMatrixWorld();
      const cameraMatrix = cameraRef.current.matrixWorld;

      // Camera Right vector in world space
      const cameraRight = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0).normalize();
      // Camera Up vector in world space
      const cameraUp = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1).normalize();

      const fovRad = ((cameraRef.current.fov || 40) * Math.PI) / 180;
      const panFactor = (cameraRadiusRef.current * 2 * Math.tan(fovRad / 2)) / rect.height;

      // Screen-space pan: moves camera target smoothly in screen plane
      targetLookAtRef.current.addScaledVector(cameraRight, -dx * panFactor);
      targetLookAtRef.current.addScaledVector(cameraUp, dy * panFactor);

      mousePrevRef.current = { x: clientX, y: clientY };
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
        let snappedX = snapToGrid(rawX, step);
        let snappedZ = snapToGrid(rawZ, step);
        let targetY = 0;

        // Check if placed on or near a Breadboard
        const breadboard = document.components.find((c) => c.definitionId === 'breadboard');
        const isDraggedBreadboard = draggedCompIdRef.current === breadboard?.instanceId;

        if (breadboard && !isDraggedBreadboard) {
          const bbHalfW = 165 / 2; // 82.5mm
          const bbHalfD = 55 / 2;  // 27.5mm
          const relX = snappedX - breadboard.position.x;
          const relZ = snappedZ - breadboard.position.z;

          if (Math.abs(relX) <= bbHalfW + 3 && Math.abs(relZ) <= bbHalfD + 3) {
            // Resting on breadboard surface!
            targetY = 9.8;
            const bbPitch = 2.54;
            // Snap X precisely to 60-column breadboard hole coordinates (columns 1..60)
            const snappedCol = Math.max(1, Math.min(60, Math.round(relX / bbPitch + 29.5 + 1)));
            snappedX = breadboard.position.x + Number(((snappedCol - 1 - 29.5) * bbPitch).toFixed(2));

            // Snap Z precisely to authentic breadboard row levels (A-E, F-J, rails)
            const validZs = [-25.8, -23.5, -14.0, -11.46, -8.92, -6.38, -3.84, 3.84, 6.38, 8.92, 11.46, 14.0, 23.5, 25.8];
            const nearestZ = validZs.reduce((prev, curr) => (Math.abs(curr - relZ) < Math.abs(prev - relZ) ? curr : prev), validZs[0]);
            snappedZ = breadboard.position.z + nearestZ;
          }
        }

        // Allow placing across full workbench ESD mat area (380x250mm)
        const maxWorkX = 175;
        const maxWorkZ = 115;
        const clampedX = Math.max(-maxWorkX, Math.min(maxWorkX, snappedX));
        const clampedZ = Math.max(-maxWorkZ, Math.min(maxWorkZ, snappedZ));

        currentDragPosRef.current = { x: clampedX, y: targetY, z: clampedZ };

        const meshGroup = componentsGroupRef.current.children.find(
          (c) => c.name === `comp-${draggedCompIdRef.current}`
        );
        if (meshGroup) {
          meshGroup.position.set(clampedX, targetY, clampedZ);
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
            c.instanceId === draggedId ? { ...c, position: { x: clampedX, y: targetY, z: clampedZ } } : c
          );
          // Only the dragged component's wires follow the cursor; routes of the other wires are
          // refreshed when the move is committed to the document
          const wiresGroup = wiresGroupRef.current;
          for (const conn of document.connections) {
            if (conn.fromComponentId !== draggedId && conn.toComponentId !== draggedId) continue;
            const current = wiresGroup.children.find((c) => c.userData?.reconcileKey === conn.id);
            const index = current ? wiresGroup.children.indexOf(current) : -1;
            if (current) {
              wiresGroup.remove(current);
              disposeObjectTree(current);
            }
            const wireMesh = createWireMesh(conn, tempComponents, conn.id === selectedConnectionId);
            if (wireMesh) {
              wireMesh.userData.reconcileKey = conn.id;
              wiresGroup.add(wireMesh);
              if (index >= 0) {
                wiresGroup.children.splice(wiresGroup.children.length - 1, 1);
                wiresGroup.children.splice(index, 0, wireMesh);
              }
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
        componentId: hoveredPin.object.userData.componentId,
        pinId: hoveredPin.object.userData.pinId,
        name: hoveredPin.object.userData.name || 'Chân linh kiện',
        designator: hoveredPin.object.userData.designator,
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
          disposeObjectTree(previewWireRef.current);
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

      if (oldPos.x !== newPos.x || oldPos.z !== newPos.z || oldPos.y !== newPos.y) {
        onMoveComponent(id, oldPos, newPos);
        // Trigger tactile CAD settling micro-bounce
        settlingComponentsRef.current.set(id, { startTime: performance.now() });
      }

      if (id === placingComponentId && onPlacedComponent) {
        settlingComponentsRef.current.set(id, { startTime: performance.now() });
        onPlacedComponent();
      }
    }

    if (previewWireRef.current && sceneRef.current && !isWiringMode) {
      sceneRef.current.remove(previewWireRef.current);
      disposeObjectTree(previewWireRef.current);
      previewWireRef.current = null;
    }
  };

  // Clean up preview wire when wiring mode exits
  useEffect(() => {
    if (!isWiringMode && previewWireRef.current && sceneRef.current) {
      sceneRef.current.remove(previewWireRef.current);
      disposeObjectTree(previewWireRef.current);
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
            disposeObjectTree(cutLineMeshRef.current);
            cutLineMeshRef.current = null;
          }
          if (onCancelCutMode) onCancelCutMode();
        }
        if (isWiringMode) {
          if (previewWireRef.current && sceneRef.current) {
            sceneRef.current.remove(previewWireRef.current);
            disposeObjectTree(previewWireRef.current);
            previewWireRef.current = null;
          }
          onCancelWiring();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWiringMode, isCutMode, onCancelWiring, onCancelCutMode]);

  // Smooth Damped Wheel Zoom (interpolated via targetRadius in RAF loop)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (cameraTransitionRef.current) {
      cameraTransitionRef.current = null;
      targetThetaRef.current = cameraThetaRef.current;
      targetPhiRef.current = cameraPhiRef.current;
      targetLookAtRef.current.copy(cameraTargetRef.current);
    }
    const zoomDelta = e.deltaY * 0.13;
    targetRadiusRef.current = Math.max(30, Math.min(350, targetRadiusRef.current + zoomDelta));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden bg-slate-950"
      // The canvas handles every touch gesture itself: no page scroll, no browser zoom
      style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
      onPointerDown={onGesturePointerDown}
      onPointerMove={onGesturePointerMove}
      onPointerUp={onGesturePointerEnd}
      onPointerCancel={onGesturePointerEnd}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isContextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 text-slate-200 text-sm" role="status">
          {language === 'vi' ? 'Đang khôi phục đồ họa 3D… Dự án của bạn vẫn được giữ nguyên.' : 'Restoring 3D graphics… your project is unchanged.'}
        </div>
      )}
      {/* View Presets Quick Bar (Centered horizontally at top of 3D viewport) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 dark:border-cyan-800/40 shadow-xl text-xs select-none">
        <button
          onClick={() => setView('perspective')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer active:scale-95 ${
            activePreset === 'perspective'
              ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
          title={language === 'vi' ? 'Góc nhìn phối cảnh 3D' : '3D Perspective view'}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Phối cảnh' : 'Perspective'}</span>
        </button>

        <button
          onClick={() => setView('top')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer active:scale-95 ${
            activePreset === 'top'
              ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
          title={language === 'vi' ? 'Nhìn thẳng từ trên xuống (2D PCB View)' : 'Top-down orthogonal view (2D PCB View)'}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Mặt trên' : 'Top View'}</span>
        </button>

        <button
          onClick={() => setView('isometric')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer active:scale-95 ${
            activePreset === 'isometric'
              ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
          title={language === 'vi' ? 'Góc nhìn trục lượng (Isometric 35.26°)' : 'Isometric view (35.26°)'}
        >
          <Eye className="w-3.5 h-3.5 rotate-45" />
          <span>{language === 'vi' ? 'Trục lượng' : 'Isometric'}</span>
        </button>

        <button
          onClick={() => setView('fit')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer active:scale-95 ${
            activePreset === 'fit'
              ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
          title={language === 'vi' ? 'Căn vừa toàn bộ mạch vào màn hình' : 'Fit all components to view'}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Toàn cảnh' : 'Fit to View'}</span>
        </button>

        {selectedComponentId && (
          <button
            onClick={() => {
              const comp = document.components.find((c) => c.instanceId === selectedComponentId);
              if (comp) {
                flyCameraTo({
                  target: new THREE.Vector3(comp.position.x, comp.position.y + 2, comp.position.z),
                  radius: 75,
                  theta: Math.PI / 4,
                  phi: Math.PI / 3.4,
                  duration: 600,
                });
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/60 font-medium transition cursor-pointer hover:border-teal-400 active:scale-95 shadow-xs"
            title={language === 'vi' ? 'Phóng to và căn giữa linh kiện đang chọn' : 'Focus camera on selected component'}
          >
            <Target className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Tập trung' : 'Focus'}</span>
          </button>
        )}

        <button
          onClick={() => setView('reset')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer active:scale-95"
          title={language === 'vi' ? 'Đặt lại góc quay camera ban đầu' : 'Reset camera'}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Đặt lại' : 'Reset'}</span>
        </button>
      </div>

      {/* Pin Hover Floating Tooltip */}
      {hoveredPinInfo && (
        <div
          className="pointer-events-none absolute z-30 px-2.5 py-1 bg-slate-900/95 dark:bg-slate-950/95 text-cyan-300 font-mono text-[11px] rounded-md border border-cyan-400/50 shadow-xl backdrop-blur-md -translate-x-1/2 -translate-y-full flex items-center gap-1.5"
          style={{ left: hoveredPinInfo.x, top: hoveredPinInfo.y }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
          <span className="font-semibold">{hoveredPinInfo.name}</span>
          {hoveredPinInfo.designator && (
            <span className="text-[10px] px-1 py-0.2 bg-cyan-950/80 text-cyan-400 rounded border border-cyan-800/60">
              {hoveredPinInfo.designator}
            </span>
          )}
        </div>
      )}

      {/* Cut tool indicator banner */}
      {isCutMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/90 border border-rose-300 dark:border-rose-500/80 text-rose-800 dark:text-rose-300 text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2 animate-pulse">
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
                disposeObjectTree(cutLineMeshRef.current);
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
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/90 border border-cyan-300 dark:border-cyan-500/80 text-cyan-800 dark:text-cyan-300 text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2 animate-pulse">
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
