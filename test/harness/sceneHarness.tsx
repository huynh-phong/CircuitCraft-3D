/**
 * Dev-only harness for the 3D workspace: mounts the real ThreeScene with a real ProjectDocument and
 * the real CommandHistory / simulation engine, without login or any API call.
 *
 * URL parameters: p = sample index | "batch1" | "library"   q = low | balanced | high
 * Everything is also scriptable from the console through `window.__harness`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../src/index.css';
import { I18nProvider } from '../../src/i18n/context';
import { ThreeScene } from '../../src/scene/ThreeScene';
import { SAMPLE_PROJECTS } from '../../src/persistence/sampleProjects';
import { createDefaultProjectDocument } from '../../src/domain/project/document';
import { COMPONENT_DEFINITIONS } from '../../src/domain/components/definitions';
import { CommandHistory } from '../../src/domain/commands/history';
import {
  AddComponentCommand,
  CreateConnectionCommand,
  DeleteComponentCommand,
  MoveComponentCommand,
  ResizeBoardCommand,
} from '../../src/domain/commands/commands';
import { simulateBehavior } from '../../src/domain/simulation/engine';
import type { ComponentInstance, Connection, ProjectDocument, Vector3D } from '../../src/domain/project/types';
import type { SimulationResult } from '../../src/domain/simulation/types';

type Quality = 'low' | 'balanced' | 'high';

const comp = (
  instanceId: string,
  definitionId: string,
  x: number,
  z: number,
  parameters: Record<string, any> = {},
  rotY = 0
): ComponentInstance => ({
  instanceId,
  definitionId,
  name: instanceId.toUpperCase(),
  position: { x, y: 0, z },
  rotation: { x: 0, y: rotY, z: 0 },
  parameters,
});

const wire = (id: string, a: string, ap: string, b: string, bp: string, wireColor?: string): Connection => ({
  id,
  fromComponentId: a,
  fromPinId: ap,
  toComponentId: b,
  toPinId: bp,
  wireColor,
  wireStyle: 'curved',
});

/** The six Batch-1 parts wired as a working LED circuit (source → switch → resistor → LED). */
function batch1Document(): ProjectDocument {
  const doc = createDefaultProjectDocument('VISUAL-1 Batch 1', { width: 140, depth: 90 });
  doc.projectId = 'harness-batch1';
  doc.components = [
    comp('bat1', 'dc-source', -45, -22, { voltage: 5 }),
    comp('sw1', 'switch', -8, -24, {}),
    comp('r1', 'resistor', 22, -24, { resistance: 220 }),
    comp('led1', 'led', 48, -22, { color: 'red' }),
    comp('pot1', 'potentiometer', -30, 20, { currentPosition: 0.3, maxResistance: 10000 }),
    comp('tb1', 'connector', 10, 22, {}),
    comp('r2', 'resistor', 40, 12, { resistance: 4700 }),
    comp('r3', 'resistor', 40, 26, { resistance: 1000000 }),
    comp('led2', 'led', 58, 18, { color: 'green' }),
  ];
  doc.components[1].state = { open: false };
  doc.connections = [
    wire('w1', 'bat1', 'vcc', 'sw1', 'pin1', '#ef4444'),
    wire('w2', 'sw1', 'pin2', 'r1', 'pin1', '#f59e0b'),
    wire('w3', 'r1', 'pin2', 'led1', 'anode', '#f59e0b'),
    wire('w4', 'led1', 'cathode', 'bat1', 'gnd', '#1e293b'),
  ];
  return doc;
}

/** One of every part the library offers, laid out on a grid. */
function libraryDocument(): ProjectDocument {
  const doc = createDefaultProjectDocument('Library', { width: 300, depth: 300 });
  doc.projectId = 'harness-library';
  const defs = COMPONENT_DEFINITIONS.filter((d) => !d.deprecatedBy && d.definitionId !== 'breadboard');
  let x = -120;
  let z = -120;
  doc.components = defs.map((d, i) => {
    const c = comp(`c${i}`, d.definitionId, x, z, { ...d.defaultParameters });
    x += Math.max(40, d.dimensions.x + 18);
    if (x > 110) {
      x = -120;
      z += 55;
    }
    return c;
  });
  return doc;
}

function initialDocument(): ProjectDocument {
  const p = new URLSearchParams(location.search).get('p') ?? '0';
  if (p === 'batch1') return batch1Document();
  if (p === 'library') return libraryDocument();
  return structuredClone(SAMPLE_PROJECTS[Number(p) || 0]);
}

function Harness() {
  const params = new URLSearchParams(location.search);
  const historyRef = useRef(new CommandHistory(initialDocument()));
  const [doc, setDoc] = useState<ProjectDocument>(historyRef.current.currentDocument);
  const [quality, setQuality] = useState<Quality>((params.get('q') as Quality) || 'balanced');
  const [isWiring, setIsWiring] = useState(false);
  const [wiringStart, setWiringStart] = useState<{ componentId: string; pinId: string; worldPos: Vector3D } | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(true);
  const [decor, setDecor] = useState(params.get('decor') !== '0');

  const simulationResult: SimulationResult | null = useMemo(
    () => (isSimulating ? simulateBehavior(doc, switchStates) : null),
    [isSimulating, doc, switchStates]
  );

  const run = useCallback((cmd: any) => setDoc(historyRef.current.execute(cmd)), []);

  useEffect(() => {
    (window as any).__harness = {
      doc: () => historyRef.current.currentDocument,
      setQuality,
      setWiring: (on: boolean) => {
        setIsWiring(on);
        if (!on) setWiringStart(null);
      },
      setSimulating: setIsSimulating,
      setMounted,
      setDecor,
      select: setSelectedComponentId,
      load: (d: ProjectDocument) => {
        historyRef.current = new CommandHistory(d);
        setDoc(d);
      },
      add: (c: ComponentInstance) => run(new AddComponentCommand(c)),
      remove: (id: string) => run(new DeleteComponentCommand(id)),
      move: (id: string, to: Vector3D) => {
        const c = historyRef.current.currentDocument.components.find((x) => x.instanceId === id)!;
        run(new MoveComponentCommand(id, c.position, to));
      },
      connect: (c: Connection) => run(new CreateConnectionCommand(c)),
      undo: () => {
        const d = historyRef.current.undo();
        if (d) setDoc(d);
        return Boolean(d);
      },
      redo: () => {
        const d = historyRef.current.redo();
        if (d) setDoc(d);
        return Boolean(d);
      },
      /** Frames per second over `ms` milliseconds of requestAnimationFrame. */
      fps: (ms = 3000) =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = (now: number) => {
            frames += 1;
            if (now - start >= ms) resolve(Math.round((frames * 1000) / (now - start)));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      /** Last-frame draw statistics and live GPU object counts of the workspace renderer. */
      info: () => {
        const r = (window as any).__cc3dRenderer;
        if (!r) return null;
        return {
          calls: r.info.render.calls,
          triangles: r.info.render.triangles,
          geometries: r.info.memory.geometries,
          textures: r.info.memory.textures,
          programs: r.info.programs?.length ?? null,
        };
      },
    };
  }, [run]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {mounted && (
        <ThreeScene
          document={doc}
          selectedComponentId={selectedComponentId}
          selectedConnectionId={selectedConnectionId}
          onSelectComponent={setSelectedComponentId}
          onSelectConnection={setSelectedConnectionId}
          onMoveComponent={(id, oldPos, newPos) => run(new MoveComponentCommand(id, oldPos, newPos))}
          onConnectPins={(a, ap, b, bp) => {
            run(new CreateConnectionCommand(wire(`w-${Date.now().toString(36)}`, a, ap, b, bp)));
            setWiringStart(null);
          }}
          onToggleSwitch={(id) => {
            const c = doc.components.find((x) => x.instanceId === id);
            const closed = switchStates[id] ?? c?.state?.open === false;
            setSwitchStates({ ...switchStates, [id]: !closed });
          }}
          isWiringMode={isWiring}
          wiringStartPin={wiringStart}
          onStartWiring={setWiringStart}
          onCancelWiring={() => setWiringStart(null)}
          onResizeBoard={(oldBoard, newBoard) => run(new ResizeBoardCommand(oldBoard, newBoard))}
          simulationResult={simulationResult}
          switchStates={switchStates}
          qualityPreset={quality}
          showWorkbenchDecor={decor}
        />
      )}
    </div>
  );
}

// StrictMode like the real app (src/main.tsx): effects mount, unmount and mount again in dev.
// `?strict=0` turns it off, which is needed to read renderer.info of a single renderer.
const app = (
  <I18nProvider>
    <Harness />
  </I18nProvider>
);
ReactDOM.createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).get('strict') === '0' ? app : <React.StrictMode>{app}</React.StrictMode>
);
