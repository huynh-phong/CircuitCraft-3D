/**
 * Task 2.2 Acceptance Tests
 * Verifies Command Engine: Add, Move, Rotate, Update Property, Remove, Connect, Disconnect,
 * Atomic Transactions, Undo/Redo invariants, and Error Handling.
 * Run with: npx tsx test/task_2_2.test.ts
 */

import {
  CommandHistory,
  AddComponentCommand,
  RemoveComponentCommand,
  MoveComponentCommand,
  RotateComponentCommand,
  UpdatePropertyCommand,
  AddConnectionCommand,
  RemoveConnectionCommand,
} from '../src/engine/commandEngine.ts';
import {
  createEmptyProjectFixture,
  createSampleLedCircuitFixture,
} from '../src/domain/fixtures.ts';
import { ComponentInstance, ConnectionWire, WireRoute } from '../src/types/circuit.ts';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

console.log('--- Testing Task 2.2: Command Engine & Transactions ---');

// -------------------------------------------------------------
// 1. Thêm -> Di chuyển -> Xoay -> Undo -> Redo
// -------------------------------------------------------------
console.log('\n[1] Testing Add -> Move -> Rotate -> Undo -> Redo');
const history = new CommandHistory(50);
let doc = createEmptyProjectFixture();
const initialRevision = doc.revision;

const testResistor: ComponentInstance = {
  id: 'test_res_1',
  type: 'resistor',
  name: 'R_Test',
  position: { x: 10, y: 0, z: 20 },
  rotation: 0,
  properties: { resistance: 1000, label: '1k' },
  pins: [
    { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -10, y: 0, z: 0 } },
    { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 10, y: 0, z: 0 } },
  ],
};

// Step 1: Add
doc = history.execute(doc, 'Thêm điện trở', [new AddComponentCommand(testResistor)]);
assert(doc.components.length === 1, 'Component should be added');
assert(doc.components[0].id === 'test_res_1', 'Component ID matches');
assert(doc.revision === initialRevision + 1, 'Revision incremented after add');
assert(history.canUndo(), 'Can undo after add');
assert(!history.canRedo(), 'Cannot redo yet');

// Step 2: Move
doc = history.execute(doc, 'Di chuyển điện trở', [
  new MoveComponentCommand('test_res_1', { x: 50, y: 0, z: 80 }),
]);
assert(doc.components[0].position.x === 50, 'Position X updated to 50');
assert(doc.components[0].position.z === 80, 'Position Z updated to 80');
assert(doc.revision === initialRevision + 2, 'Revision incremented after move');

// Step 3: Rotate
doc = history.execute(doc, 'Xoay điện trở', [
  new RotateComponentCommand('test_res_1', 90),
]);
assert(doc.components[0].rotation === 90, 'Rotation updated to 90');
assert(doc.revision === initialRevision + 3, 'Revision incremented after rotate');

// Step 4: Undo Rotate
doc = history.undo(doc)!;
assert(doc !== null, 'Undo rotate succeeded');
assert(doc.components[0].rotation === 0, 'Rotation reverted back to 0');
assert(history.canRedo(), 'Can redo after undo');

// Step 5: Undo Move
doc = history.undo(doc)!;
assert(doc.components[0].position.x === 10, 'Position X reverted back to 10');
assert(doc.components[0].position.z === 20, 'Position Z reverted back to 20');

// Step 6: Undo Add
doc = history.undo(doc)!;
assert(doc.components.length === 0, 'Component removed upon undo add');

// Step 7: Redo Add
doc = history.redo(doc)!;
assert(doc.components.length === 1, 'Component restored upon redo add');
assert(doc.components[0].id === 'test_res_1', 'Restored component has correct ID');

// Step 8: Redo Move
doc = history.redo(doc)!;
assert(doc.components[0].position.x === 50, 'Position restored upon redo move');

// Step 9: Redo Rotate
doc = history.redo(doc)!;
assert(doc.components[0].rotation === 90, 'Rotation restored upon redo rotate');

// -------------------------------------------------------------
// 2. Xóa linh kiện có dây và wireRoutes -> Undo
// -------------------------------------------------------------
console.log('\n[2] Testing Remove Component with Connected Wires & WireRoutes -> Undo');
const ledCircuit = createSampleLedCircuitFixture();
const initialCompCount = ledCircuit.components.length;
const initialConnCount = ledCircuit.connections.length;

// Attach a mock wireRoute to the first connection
const sampleWireRoute: WireRoute = {
  connectionId: ledCircuit.connections[0].id, // wire_1 connected to dc_1
  waypoints: [
    { x: -50, y: 6, z: -20 },
    { x: -10, y: 5, z: -20 },
  ],
};
ledCircuit.wireRoutes = [sampleWireRoute];

const circuitHistory = new CommandHistory(50);
let activeCircuit = { ...ledCircuit };

// Target dc_1 which is connected to wire_1 and wire_4
activeCircuit = circuitHistory.execute(activeCircuit, 'Xóa nguồn DC', [
  new RemoveComponentCommand('dc_1'),
]);

// Assert dc_1 is removed
assert(!activeCircuit.components.some((c) => c.id === 'dc_1'), 'dc_1 removed from components');
assert(activeCircuit.components.length === initialCompCount - 1, 'Component count decreased by 1');

// Assert both wire_1 and wire_4 are removed
assert(!activeCircuit.connections.some((w) => w.id === 'wire_1'), 'wire_1 connected to dc_1 removed');
assert(!activeCircuit.connections.some((w) => w.id === 'wire_4'), 'wire_4 connected to dc_1 removed');
assert(activeCircuit.connections.length === initialConnCount - 2, 'Two wires removed');

// Assert wireRoute for wire_1 was cleaned up
assert(
  !activeCircuit.wireRoutes?.some((r) => r.connectionId === 'wire_1'),
  'wireRoute for wire_1 was also cleaned up'
);

// Now Undo!
activeCircuit = circuitHistory.undo(activeCircuit)!;
assert(activeCircuit.components.some((c) => c.id === 'dc_1'), 'dc_1 restored upon undo');
const restoredDc = activeCircuit.components.find((c) => c.id === 'dc_1')!;
assert(restoredDc.properties.voltage === 5, 'dc_1 restored with exact properties (voltage: 5V)');
assert(restoredDc.pins.length === 2, 'dc_1 restored with exact pins');

// Connections restored
assert(activeCircuit.connections.some((w) => w.id === 'wire_1'), 'wire_1 restored with exact ID');
assert(activeCircuit.connections.some((w) => w.id === 'wire_4'), 'wire_4 restored with exact ID');
assert(activeCircuit.connections.length === initialConnCount, 'Connection count restored exactly');

// Wire route restored
assert(
  activeCircuit.wireRoutes?.some((r) => r.connectionId === 'wire_1'),
  'wireRoute for wire_1 restored with exact waypoints'
);

// -------------------------------------------------------------
// 3. Transaction thất bại không để lại thay đổi (Atomicity)
// -------------------------------------------------------------
console.log('\n[3] Testing Failed Transaction Atomicity (No partial mutations)');
const txHistory = new CommandHistory(50);
let baseDoc = createSampleLedCircuitFixture();
const preDocSnapshot = JSON.stringify(baseDoc);
const preRevision = baseDoc.revision;

let txErrorCaught = false;
try {
  baseDoc = txHistory.execute(baseDoc, 'Multi-step batch with deliberate failure', [
    // Step 1: Valid move
    new MoveComponentCommand('sw_1', { x: 100, y: 0, z: 100 }),
    // Step 2: Invalid command (duplicate connection to non-existent pin)
    new AddConnectionCommand({
      id: 'bad_wire',
      fromComponentId: 'non_existent_comp',
      fromPinId: 'pin_pos',
      toComponentId: 'sw_1',
      toPinId: 'pin_1',
      color: '#ff0000',
    }),
    // Step 3: Valid rotate
    new RotateComponentCommand('res_1', 180),
  ]);
} catch (err) {
  txErrorCaught = true;
  console.log(`  ✓ Caught expected transaction failure: ${(err as Error).message}`);
}

assert(txErrorCaught, 'Transaction failure must throw error');
assert(
  JSON.stringify(baseDoc) === preDocSnapshot,
  'Document state must be 100% identical to pre-transaction state'
);
assert(baseDoc.revision === preRevision, 'Revision was not incremented on failed transaction');
assert(!txHistory.canUndo(), 'History has no pending undo transactions after failure');

// -------------------------------------------------------------
// 4. Lệnh mới sau undo không dùng lại nhánh redo cũ (Redo stack cleared)
// -------------------------------------------------------------
console.log('\n[4] Testing Redo Branch Cleared on New Command after Undo');
const branchHistory = new CommandHistory(50);
let bDoc = createEmptyProjectFixture();

// Action A
bDoc = branchHistory.execute(bDoc, 'Action A', [
  new AddComponentCommand({
    id: 'comp_A',
    type: 'resistor',
    name: 'A',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    properties: { resistance: 100 },
    pins: [{ id: 'p1', label: '1', type: 'passive', relativePosition: { x: 0, y: 0, z: 0 } }],
  }),
]);

// Action B
bDoc = branchHistory.execute(bDoc, 'Action B', [
  new UpdatePropertyCommand('comp_A', { resistance: 200 }),
]);
assert(bDoc.components[0].properties.resistance === 200, 'Resistance is 200 after Action B');

// Undo Action B
bDoc = branchHistory.undo(bDoc)!;
assert(bDoc.components[0].properties.resistance === 100, 'Resistance is 100 after Undo Action B');
assert(branchHistory.canRedo(), 'Can redo Action B');

// Action C (New Branch!)
bDoc = branchHistory.execute(bDoc, 'Action C', [
  new UpdatePropertyCommand('comp_A', { resistance: 500 }),
]);
assert(bDoc.components[0].properties.resistance === 500, 'Resistance is 500 after Action C');
assert(
  !branchHistory.canRedo(),
  'Redo stack MUST be empty after executing a new command (cannot re-apply Action B)'
);

// Undo Action C goes back to Action A, not Action B
bDoc = branchHistory.undo(bDoc)!;
assert(bDoc.components[0].properties.resistance === 100, 'Undo Action C goes directly back to Action A');

// -------------------------------------------------------------
// 5. Multi-command Transaction (Single Undo Step)
// -------------------------------------------------------------
console.log('\n[5] Testing Multi-command Transaction as Single Undo Step');
const multiHistory = new CommandHistory(50);
let mDoc = createSampleLedCircuitFixture();
const initialRev = mDoc.revision;

// A transaction of 3 commands at once
mDoc = multiHistory.execute(mDoc, 'Di chuyển đồng thời S1 và R1 và đổi màu LED', [
  new MoveComponentCommand('sw_1', { x: 99, y: 0, z: 99 }),
  new MoveComponentCommand('res_1', { x: 88, y: 0, z: 88 }),
  new UpdatePropertyCommand('led_1', { color: '#3b82f6' }),
]);

assert(mDoc.revision === initialRev + 1, 'Transaction incremented revision by exactly 1');
assert(mDoc.components.find((c) => c.id === 'sw_1')!.position.x === 99, 'sw_1 moved');
assert(mDoc.components.find((c) => c.id === 'res_1')!.position.x === 88, 'res_1 moved');
assert(mDoc.components.find((c) => c.id === 'led_1')!.properties.color === '#3b82f6', 'led_1 color changed');

// Single Undo rolls back all 3 commands
mDoc = multiHistory.undo(mDoc)!;
assert(mDoc.components.find((c) => c.id === 'sw_1')!.position.x === -10, 'sw_1 position reverted');
assert(mDoc.components.find((c) => c.id === 'res_1')!.position.x === 30, 'res_1 position reverted');
assert(mDoc.components.find((c) => c.id === 'led_1')!.properties.color === '#ef4444', 'led_1 color reverted');
assert(!multiHistory.canUndo(), 'Only 1 undo step was present for the whole transaction');

// -------------------------------------------------------------
// 6. Connect & Disconnect Commands & Validations
// -------------------------------------------------------------
console.log('\n[6] Testing AddConnection and RemoveConnection with Precondition Validations');
let connDoc = createSampleLedCircuitFixture();
const connHistory = new CommandHistory(50);

// Self-connection should fail
let selfConnFailed = false;
try {
  connHistory.execute(connDoc, 'Nối chân vào chính nó', [
    new AddConnectionCommand({
      id: 'wire_self',
      fromComponentId: 'sw_1',
      fromPinId: 'pin_1',
      toComponentId: 'sw_1',
      toPinId: 'pin_1',
      color: '#000',
    }),
  ]);
} catch (err) {
  selfConnFailed = true;
}
assert(selfConnFailed, 'Self-connection should be rejected');

// Duplicate connection should fail
let dupConnFailed = false;
try {
  // wire_1 already connects dc_1:pin_pos -> sw_1:pin_1
  connHistory.execute(connDoc, 'Nối trùng đường dây đã có', [
    new AddConnectionCommand({
      id: 'wire_dup',
      fromComponentId: 'sw_1',
      fromPinId: 'pin_1',
      toComponentId: 'dc_1',
      toPinId: 'pin_pos',
      color: '#000',
    }),
  ]);
} catch (err) {
  dupConnFailed = true;
}
assert(dupConnFailed, 'Duplicate connection between same pins should be rejected');

// Remove connection & undo
const connCountBefore = connDoc.connections.length;
connDoc = connHistory.execute(connDoc, 'Xóa dây nối 2', [
  new RemoveConnectionCommand('wire_2'),
]);
assert(connDoc.connections.length === connCountBefore - 1, 'Wire 2 removed');
assert(!connDoc.connections.some((w) => w.id === 'wire_2'), 'wire_2 is gone');

connDoc = connHistory.undo(connDoc)!;
assert(connDoc.connections.length === connCountBefore, 'Wire count restored on undo');
assert(connDoc.connections.some((w) => w.id === 'wire_2'), 'wire_2 restored');

// -------------------------------------------------------------
// 7. Architectural Invariant: Isolation
// -------------------------------------------------------------
console.log('\n[7] Testing Architectural Invariant: Engine Isolation');
const engineFile = path.resolve('src/engine/commandEngine.ts');
const engineContent = fs.readFileSync(engineFile, 'utf-8');
const forbiddenImports = ['three', 'react', 'lucide-react', '@react-three', 'document.', 'window.'];
for (const token of forbiddenImports) {
  const importRegex = new RegExp(`from\\s+['"][^'"]*${token}[^'"]*['"]`, 'i');
  assert(!importRegex.test(engineContent), `src/engine/commandEngine.ts must NOT import '${token}'`);
}

console.log('\n========================================');
console.log('🎉 ALL TASK 2.2 TESTS PASSED SUCCESSFULLY!');
console.log('========================================\n');
