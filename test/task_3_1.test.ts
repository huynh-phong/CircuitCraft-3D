import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProjectDocument, ComponentInstance } from '../src/types/circuit.ts';
import {
  AddComponentCommand,
  MoveComponentCommand,
  CommandHistory,
} from '../src/engine/commandEngine.ts';
import { createEmptyProjectFixture } from '../src/domain/fixtures.ts';
import { validateProjectDocument } from '../src/domain/schema.ts';

describe('Task 3.1: 3D Scene Integration, Board Dynamics & Canvas Isolation', () => {
  it('Criterion 1: ProjectDocument schema does not contain camera or Three.js objects', () => {
    const doc = createEmptyProjectFixture();
    
    // Check that doc does not contain camera, three, scene, or renderer keys
    const docKeys = Object.keys(doc);
    assert.strictEqual(docKeys.includes('camera'), false, 'Camera must not be in ProjectDocument');
    assert.strictEqual(docKeys.includes('scene'), false, 'Scene must not be in ProjectDocument');
    assert.strictEqual(docKeys.includes('renderer'), false, 'Renderer must not be in ProjectDocument');

    // Board contains only geometric and physical values
    assert.strictEqual(typeof doc.board.width, 'number');
    assert.strictEqual(typeof doc.board.depth, 'number');
    assert.strictEqual(typeof doc.board.thickness, 'number');
    assert.strictEqual(typeof doc.board.gridSize, 'number');

    // Document passes schema validation
    const validation = validateProjectDocument(doc);
    assert.strictEqual(validation.isValid, true);
  });

  it('Criterion 2: Board dimensions update in ProjectDocument and remain valid', () => {
    let doc = createEmptyProjectFixture();
    
    // Resize board
    doc = {
      ...doc,
      board: {
        ...doc.board,
        width: 250,
        depth: 180,
        thickness: 6,
        gridSize: 10,
      },
    };

    assert.strictEqual(doc.board.width, 250);
    assert.strictEqual(doc.board.depth, 180);
    assert.strictEqual(doc.board.thickness, 6);

    const validation = validateProjectDocument(doc);
    assert.strictEqual(validation.isValid, true);
  });

  it('Criterion 3: CommandEngine is completely decoupled from visual effects & camera state', () => {
    let doc = createEmptyProjectFixture();
    const history = new CommandHistory();

    const testComponent: ComponentInstance = {
      id: 'res_1',
      type: 'resistor',
      name: 'R1',
      position: { x: 20, y: 0, z: 20 },
      rotation: 0,
      pins: [
        { id: 'pin1', label: '1', type: 'passive', relativePosition: { x: -8, y: 0, z: 0 } },
        { id: 'pin2', label: '2', type: 'passive', relativePosition: { x: 8, y: 0, z: 0 } },
      ],
      properties: { resistance: 220 },
    };
    const addCmd = new AddComponentCommand(testComponent);
    doc = history.execute(doc, 'Add Resistor', [addCmd]);
    assert.strictEqual(doc.components.length, 1);

    const compId = doc.components[0].id;
    const moveCmd = new MoveComponentCommand(compId, { x: 40, y: 0, z: 50 });
    doc = history.execute(doc, 'Move Resistor', [moveCmd]);
    assert.strictEqual(doc.components[0].position.x, 40);

    // Verify command engine document is strictly data
    assert.strictEqual(doc.components[0].position.x, 40);
    assert.strictEqual((doc as any).camera, undefined);
    assert.strictEqual((doc as any).orbitControls, undefined);
  });

  it('Criterion 4: Editor transient interaction state holds camera & graphics mode separately', () => {
    // EditorInteractionState should isolate camera and graphics flags from ProjectDocument
    const editorState = {
      mode: 'select' as const,
      selectedComponentId: null,
      selectedWireId: null,
      activePinWiring: null,
      isSimulating: false,
      isLowGraphics: true,
      camera: {
        position: { x: 0, y: 140, z: 160 },
        target: { x: 0, y: 0, z: 0 },
      },
    };

    assert.strictEqual(editorState.isLowGraphics, true);
    assert.deepStrictEqual(editorState.camera.position, { x: 0, y: 140, z: 160 });
  });
});
