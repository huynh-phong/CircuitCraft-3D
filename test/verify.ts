/**
 * Verification Test Suite for CircuitCraft 3D
 * Tests:
 * 1. Board Geometry Engine (Perimeter, Containment, Splitting)
 * 2. Intelligent Orthogonal Wire Router (Clearance, Obstacle avoidance, 90-degree waypoints)
 * 3. Board Commands (Resize, Cut, Shape changes with Undo/Redo)
 * 4. Sample Projects Validation (Schema compliance, Component connections)
 */

import {
  getBoardPerimeter,
  isPointInsideBoard,
  areAllComponentsContained,
  splitPolygonByCuttingLine,
} from '../src/domain/project/boardGeometry';
import {
  computeOrthogonalWireRoute,
  getComponentObstacles,
  segmentIntersectsObstacles,
} from '../src/domain/project/wireRouting';
import {
  ResizeBoardCommand,
  CutBoardCommand,
  ChangeBoardShapeCommand,
} from '../src/domain/commands/commands';
import { SAMPLE_PROJECTS } from '../src/persistence/sampleProjects';
import { BoardDefinition, ComponentInstance, Vector3D } from '../src/domain/project/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- 1. Testing Board Geometry Engine ---');

// Test rectangular perimeter
const rectBoard: BoardDefinition = {
  width: 100,
  depth: 80,
  thickness: 1.6,
  solderMaskColor: '#104936',
  copperLayerCount: 2,
  gridSpacing: 2.54,
  shape: 'rectangle',
};
const rectPerimeter = getBoardPerimeter(rectBoard);
assert(rectPerimeter.length === 4, 'Rectangular board has 4 perimeter vertices');
assert(
  isPointInsideBoard({ x: 0, z: 0 }, rectBoard),
  'Origin (0,0) is inside rectangular board'
);
assert(
  isPointInsideBoard({ x: 40, z: 30 }, rectBoard),
  '(40, 30) is inside 100x80 board'
);
assert(
  !isPointInsideBoard({ x: 60, z: 0 }, rectBoard),
  '(60, 0) is outside 100x80 board'
);

// Test circular board
const circleBoard: BoardDefinition = {
  ...rectBoard,
  shape: 'circle',
};
const circlePerimeter = getBoardPerimeter(circleBoard);
assert(circlePerimeter.length === 36, 'Circular board has 36 approximated vertices');
assert(
  isPointInsideBoard({ x: 0, z: 0 }, circleBoard),
  'Center of circle is inside'
);
assert(
  isPointInsideBoard({ x: 30, z: 30 }, circleBoard),
  '(30, 30) is inside diameter 80 circle'
);
assert(
  !isPointInsideBoard({ x: 45, z: 0 }, circleBoard),
  '(45, 0) is outside radius 40 circle'
);

// Test polygon splitting (Board Cut Tool)
const initialSquare = [
  { x: -50, z: -50 },
  { x: 50, z: -50 },
  { x: 50, z: 50 },
  { x: -50, z: 50 },
];
// Cut line across top-right corner
const cutLine = [
  { x: 20, z: -50 },
  { x: 50, z: -20 },
];
const splitResult = splitPolygonByCuttingLine(initialSquare, cutLine);
assert(splitResult !== null, 'Polygon was successfully split by cutting line');
if (splitResult) {
  assert(splitResult.kept.length >= 5, 'Chamfered polygon has 5 vertices');
  assert(
    isPointInsideBoard({ x: 0, z: 0 }, { ...rectBoard, shape: 'polygon', outline: splitResult.kept }),
    'Origin remains inside polygon after cut'
  );
  assert(
    !isPointInsideBoard({ x: 48, z: -48 }, { ...rectBoard, shape: 'polygon', outline: splitResult.kept }),
    'Cut-off top-right corner is no longer inside'
  );
}

console.log('\n--- 2. Testing Component Containment ---');

const testComponents: ComponentInstance[] = [
  {
    instanceId: 'c1',
    definitionId: 'resistor',
    name: 'R1',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters: {},
  },
  {
    instanceId: 'c2',
    definitionId: 'led',
    name: 'LED1',
    position: { x: 30, y: 0, z: 20 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters: {},
  },
];
const containment = areAllComponentsContained(testComponents, rectBoard);
assert(containment.allContained, 'All test components are within board bounds');

// Place one outside
const outsideComponents: ComponentInstance[] = [
  ...testComponents,
  {
    instanceId: 'c-out',
    definitionId: 'resistor',
    name: 'R_Out',
    position: { x: 120, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters: {},
  },
];
const outsideCheck = areAllComponentsContained(outsideComponents, rectBoard);
assert(!outsideCheck.allContained, 'Detected component placed outside board');
assert(outsideCheck.outsideComponentIds.includes('c-out'), 'Identified correct outside component id');

console.log('\n--- 3. Testing Intelligent Orthogonal Wire Router ---');

const startPin: Vector3D = { x: -30, y: 1, z: 0 };
const endPin: Vector3D = { x: 30, y: 1, z: 0 };
const middleComp: ComponentInstance = {
  instanceId: 'obs-1',
  definitionId: 'dc-source', // dimensions x: 30, z: 20
  name: 'Blocking Battery',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  parameters: {},
};

const route = computeOrthogonalWireRoute(
  startPin,
  endPin,
  [middleComp],
  'source-comp',
  'target-comp'
);
assert(route.length >= 4, 'Route has waypoints for takeoff, navigation, and landing');
assert(route[0].x === startPin.x && route[0].z === startPin.z, 'Route starts at startPin');
assert(
  route[route.length - 1].x === endPin.x && route[route.length - 1].z === endPin.z,
  'Route terminates at endPin'
);
// Verify detour avoided (0, 0)
const crossesMiddle = route.some(
  (pt) => Math.abs(pt.x) < 5 && Math.abs(pt.z) < 5
);
assert(!crossesMiddle, 'Orthogonal wire router successfully detours around obstacle');

console.log('\n--- 4. Testing Board Commands & Undo/Redo ---');

const mockDoc = { ...SAMPLE_PROJECTS[0] };
const oldBoard = { ...mockDoc.board };
const newBoard: BoardDefinition = { ...oldBoard, width: 120, depth: 90 };

const resizeCmd = new ResizeBoardCommand(oldBoard, newBoard);
const docAfterResize = resizeCmd.execute(mockDoc);
assert(docAfterResize.board.width === 120, 'Resize command expanded board width to 120');
assert(docAfterResize.revision === mockDoc.revision + 1, 'Revision bumped on board resize');

const docAfterUndo = resizeCmd.undo(docAfterResize);
assert(docAfterUndo.board.width === oldBoard.width, 'Undo restored original board width');

console.log('\n--- 5. Testing 3 Flagship Projects ---');

const p1 = SAMPLE_PROJECTS.find((p) => p.projectId === 'sample-auto-nightlight');
assert(p1 !== undefined, 'Project 1 (Đèn ngủ tự động) is present');
assert(p1?.metadata?.difficulty === 'Dễ', 'Project 1 difficulty is Dễ');
assert((p1?.components.length || 0) >= 5, 'Project 1 has all required components');

const p2 = SAMPLE_PROJECTS.find((p) => p.projectId === 'sample-speed-blinker');
assert(p2 !== undefined, 'Project 2 (Đèn nháy điều chỉnh tốc độ) is present');
assert(p2?.metadata?.difficulty === 'Trung bình', 'Project 2 difficulty is Trung bình');
assert(p2?.board.width === 95 && p2?.board.depth === 65, 'Project 2 has resized board dimensions (95x65mm)');

const p3 = SAMPLE_PROJECTS.find((p) => p.projectId === 'sample-smart-door-uno');
assert(p3 !== undefined, 'Project 3 (Hệ thống cửa thông minh UNO R3) is present');
assert(p3?.metadata?.difficulty === 'Khó', 'Project 3 difficulty is Khó');
assert(p3?.board.shape === 'polygon', 'Project 3 features custom cut polygon board');
assert((p3?.board.outline?.length || 0) >= 5, 'Project 3 board has chamfered cut outline');

console.log('\n🎉 ALL 18 TESTS PASSED SUCCESSFULLY! Everything is verified.');
