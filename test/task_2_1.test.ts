/**
 * Task 2.1 Acceptance Tests
 * Verifies domain runtime schema validation, fixtures, and library definitions.
 * Run with: npx tsx test/task_2_1.test.ts
 */

import { validateProjectDocument, SUPPORTED_SCHEMA_VERSIONS } from '../src/domain/schema.ts';
import {
  createEmptyProjectFixture,
  createSampleLedCircuitFixture,
} from '../src/domain/fixtures.ts';
import { COMPONENT_CATALOG, COMPONENT_DEFINITIONS } from '../src/domain/componentLibrary.ts';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

console.log('--- Testing Task 2.1: Domain Schema & Component Library ---');

// 1. Valid fixtures
console.log('\n[1] Testing Valid Fixtures');
const emptyProject = createEmptyProjectFixture();
const emptyResult = validateProjectDocument(emptyProject);
assert(emptyResult.isValid, 'Empty project fixture should be valid');
assert(emptyResult.errors.length === 0, 'Empty project should have zero errors');

const sampleCircuit = createSampleLedCircuitFixture();
const sampleResult = validateProjectDocument(sampleCircuit);
assert(sampleResult.isValid, 'Sample LED circuit fixture should be valid');
assert(sampleResult.errors.length === 0, 'Sample circuit should have zero errors');

// 2. Unsupported schema version
console.log('\n[2] Testing Unsupported Schema Version');
const badVersionProject = {
  ...createEmptyProjectFixture(),
  schemaVersion: 999,
};
const badVersionResult = validateProjectDocument(badVersionProject);
assert(!badVersionResult.isValid, 'Unsupported schema version should fail');
assert(
  badVersionResult.errors.some((e) => e.path === 'schemaVersion' && e.code === 'UNSUPPORTED_VERSION'),
  'Should return UNSUPPORTED_VERSION error on schemaVersion path'
);

// 3. Duplicate Component ID
console.log('\n[3] Testing Duplicate Component ID');
const duplicateCompProject = createSampleLedCircuitFixture();
duplicateCompProject.components[1].id = duplicateCompProject.components[0].id; // Both have 'dc_1'
const duplicateCompResult = validateProjectDocument(duplicateCompProject);
assert(!duplicateCompResult.isValid, 'Duplicate component ID should fail');
assert(
  duplicateCompResult.errors.some((e) => e.path === 'components[1].id' && e.code === 'DUPLICATE_ID'),
  'Should flag duplicate component ID at components[1].id'
);

// 4. Duplicate Pin ID within a component
console.log('\n[4] Testing Duplicate Pin ID');
const duplicatePinProject = createSampleLedCircuitFixture();
duplicatePinProject.components[0].pins[1].id = duplicatePinProject.components[0].pins[0].id;
const duplicatePinResult = validateProjectDocument(duplicatePinProject);
assert(!duplicatePinResult.isValid, 'Duplicate pin ID should fail');
assert(
  duplicatePinResult.errors.some((e) => e.path === 'components[0].pins[1].id' && e.code === 'DUPLICATE_ID'),
  'Should flag duplicate pin ID at components[0].pins[1].id'
);

// 5. Duplicate Connection ID
console.log('\n[5] Testing Duplicate Connection ID');
const duplicateConnProject = createSampleLedCircuitFixture();
duplicateConnProject.connections[1].id = duplicateConnProject.connections[0].id;
const duplicateConnResult = validateProjectDocument(duplicateConnProject);
assert(!duplicateConnResult.isValid, 'Duplicate connection ID should fail');
assert(
  duplicateConnResult.errors.some((e) => e.path === 'connections[1].id' && e.code === 'DUPLICATE_ID'),
  'Should flag duplicate connection ID at connections[1].id'
);

// 6. Non-finite values (NaN, Infinity)
console.log('\n[6] Testing Non-finite Values');
const nanPositionProject = createSampleLedCircuitFixture();
nanPositionProject.components[0].position.x = NaN;
const nanPosResult = validateProjectDocument(nanPositionProject);
assert(!nanPosResult.isValid, 'NaN in position should fail');
assert(
  nanPosResult.errors.some((e) => e.path === 'components[0].position.x' && e.code === 'NON_FINITE_VALUE'),
  'Should report NON_FINITE_VALUE at components[0].position.x'
);

const infRotationProject = createSampleLedCircuitFixture();
infRotationProject.components[0].rotation = Infinity;
const infRotResult = validateProjectDocument(infRotationProject);
assert(!infRotResult.isValid, 'Infinity in rotation should fail');
assert(
  infRotResult.errors.some((e) => e.path === 'components[0].rotation' && e.code === 'NON_FINITE_VALUE'),
  'Should report NON_FINITE_VALUE at components[0].rotation'
);

const nanBoardProject = createSampleLedCircuitFixture();
nanBoardProject.board.width = -50;
const nanBoardResult = validateProjectDocument(nanBoardProject);
assert(!nanBoardResult.isValid, 'Negative board width should fail');
assert(
  nanBoardResult.errors.some((e) => e.path === 'board.width' && e.code === 'NON_FINITE_VALUE'),
  'Should report NON_FINITE_VALUE at board.width'
);

// 7. Dangling pin or component references in connections
console.log('\n[7] Testing Dangling References in Connections');
const ghostCompProject = createSampleLedCircuitFixture();
ghostCompProject.connections[0].fromComponentId = 'ghost_component';
const ghostCompResult = validateProjectDocument(ghostCompProject);
assert(!ghostCompResult.isValid, 'Missing component in connection should fail');
assert(
  ghostCompResult.errors.some((e) => e.path === 'connections[0].fromComponentId' && e.code === 'COMPONENT_NOT_FOUND'),
  'Should report COMPONENT_NOT_FOUND at connections[0].fromComponentId'
);

const ghostPinProject = createSampleLedCircuitFixture();
ghostPinProject.connections[0].toPinId = 'pin_ghost';
const ghostPinResult = validateProjectDocument(ghostPinProject);
assert(!ghostPinResult.isValid, 'Missing pin in connection should fail');
assert(
  ghostPinResult.errors.some((e) => e.path === 'connections[0].toPinId' && e.code === 'PIN_NOT_FOUND'),
  'Should report PIN_NOT_FOUND at connections[0].toPinId'
);

// 8. Self-connection
console.log('\n[8] Testing Self-connecting Wire');
const selfConnProject = createSampleLedCircuitFixture();
selfConnProject.connections[0].toComponentId = selfConnProject.connections[0].fromComponentId;
selfConnProject.connections[0].toPinId = selfConnProject.connections[0].fromPinId;
const selfConnResult = validateProjectDocument(selfConnProject);
assert(!selfConnResult.isValid, 'Self-connecting pin should fail');
assert(
  selfConnResult.errors.some((e) => e.path === 'connections[0]' && e.code === 'SELF_CONNECTION'),
  'Should report SELF_CONNECTION error'
);

// 9. Component Catalog & Definitions
console.log('\n[9] Testing Component Catalog & Definitions');
const requiredTypes = ['dc_power_supply', 'resistor', 'led', 'switch_spst', 'connector'] as const;
for (const compType of requiredTypes) {
  assert(!!COMPONENT_CATALOG[compType], `COMPONENT_CATALOG must have ${compType}`);
  assert(!!COMPONENT_DEFINITIONS[compType], `COMPONENT_DEFINITIONS must have ${compType}`);
  
  const def = COMPONENT_DEFINITIONS[compType];
  assert(def.version === '1.0.0', `${compType} definition version should be 1.0.0`);
  assert(def.pins.length >= 2, `${compType} must have at least 2 pins`);
  def.pins.forEach((pin) => {
    assert(typeof pin.id === 'string' && pin.id.length > 0, `${compType} pin must have non-empty id`);
    assert(Number.isFinite(pin.relativePosition.x), `${compType} pin relativePosition.x must be finite`);
    assert(Number.isFinite(pin.relativePosition.y), `${compType} pin relativePosition.y must be finite`);
    assert(Number.isFinite(pin.relativePosition.z), `${compType} pin relativePosition.z must be finite`);
  });
}

// 10. Architectural Invariant: Domain must not import UI or Three.js
console.log('\n[10] Testing Architectural Invariant: Domain Isolation');
const domainDir = path.resolve('src/domain');
const domainFiles = fs.readdirSync(domainDir).filter((f) => f.endsWith('.ts'));
const forbiddenTokens = ['three', 'react', 'lucide-react', '@react-three', 'document.', 'window.'];

for (const file of domainFiles) {
  const content = fs.readFileSync(path.join(domainDir, file), 'utf-8');
  for (const token of forbiddenTokens) {
    const importRegex = new RegExp(`from\\s+['"][^'"]*${token}[^'"]*['"]`, 'i');
    assert(
      !importRegex.test(content),
      `Domain file src/domain/${file} must NOT import '${token}'`
    );
  }
}

console.log('\n========================================');
console.log('🎉 ALL TASK 2.1 TESTS PASSED SUCCESSFULLY!');
console.log('========================================\n');
