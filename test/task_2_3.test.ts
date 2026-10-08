/**
 * Task 2.3 Acceptance Tests
 * Verifies:
 * 1. ProjectRepository interface & LocalStorageProjectRepository adapter (save, load, list, delete, optimistic concurrency).
 * 2. Edit project -> Save -> Reload preserves exact data.
 * 3. Import JSON validation & migration:
 *    - Corrupted JSON or invalid schema throws descriptive error and keeps active document untouched.
 *    - Future schemaVersion throws clear error, preserves source without overwriting.
 * 4. Separation of editor interaction state (selection, hover, camera, mode) from ProjectDocument.
 * 
 * Run with: npx tsx test/task_2_3.test.ts
 */

import {
  LocalStorageProjectRepository,
  StorageBackend,
} from '../src/services/projectRepository.ts';
import {
  createEmptyProjectFixture,
  createSampleLedCircuitFixture,
} from '../src/domain/fixtures.ts';
import {
  AddComponentCommand,
  MoveComponentCommand,
  CommandHistory,
} from '../src/engine/commandEngine.ts';
import {
  CURRENT_SCHEMA_VERSION,
  migrateProjectDocument,
  validateProjectDocument,
} from '../src/domain/schema.ts';
import { ProjectDocument, EditorInteractionState } from '../src/types/circuit.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

class MockMemoryStorage implements StorageBackend {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

console.log('--- Testing Task 2.3: State Separation, Project Repository, Migration & Persistence ---');

// -------------------------------------------------------------
// 1. Sửa dự án -> Lưu -> Tải lại giữ đúng dữ liệu
// -------------------------------------------------------------
console.log('\n[1] Testing Edit Project -> Save -> Reload preserves exact data');
const mockStorage = new MockMemoryStorage();
const repo = new LocalStorageProjectRepository(mockStorage);

let activeDoc = createSampleLedCircuitFixture();
activeDoc.name = 'Mạch Đèn LED Tự Động';

// Save initial
const saveRes1 = await repo.saveProject(activeDoc);
assert(saveRes1.success, 'Initial project save must succeed');
assert(saveRes1.revision === activeDoc.revision, 'Saved revision matches document revision');

// Modify through Command Engine
const history = new CommandHistory(50);
activeDoc = history.execute(activeDoc, 'Di chuyển công tắc S1', [
  new MoveComponentCommand('sw_1', { x: -40, y: 0, z: -15 }),
]);
assert(activeDoc.revision === saveRes1.revision + 1, 'Document revision incremented after command');

// Save modified document
const saveRes2 = await repo.saveProject(activeDoc);
assert(saveRes2.success, 'Modified project save must succeed');
assert(saveRes2.revision === activeDoc.revision, 'Saved revision updated');

// Reload document from repository
const reloadedDoc = await repo.getProject(activeDoc.id);
assert(reloadedDoc.id === activeDoc.id, 'Reloaded ID matches');
assert(reloadedDoc.name === 'Mạch Đèn LED Tự Động', 'Reloaded name matches');
assert(reloadedDoc.revision === activeDoc.revision, 'Reloaded revision matches');
assert(reloadedDoc.components.length === activeDoc.components.length, 'Component count matches');
assert(reloadedDoc.connections.length === activeDoc.connections.length, 'Connection count matches');

const reloadedSw = reloadedDoc.components.find((c) => c.id === 'sw_1')!;
assert(reloadedSw.position.x === -40, 'Reloaded component position X matches');
assert(reloadedSw.position.z === -15, 'Reloaded component position Z matches');

// -------------------------------------------------------------
// 2. Nhập JSON sai không làm mất dự án đang mở
// -------------------------------------------------------------
console.log('\n[2] Testing Import Invalid JSON does not mutate open project');
const openDocSnapshot = JSON.stringify(activeDoc);

// Case A: Corrupt/Malformed JSON syntax
let parseErrorThrown = false;
try {
  repo.importProjectJson('{"name": "Broken project", incomplete json...');
} catch (err: any) {
  parseErrorThrown = true;
  assert(err.message.includes('không phải JSON hợp lệ'), 'Expected malformed JSON error message');
}
assert(parseErrorThrown, 'Malformed JSON must throw error');
assert(JSON.stringify(activeDoc) === openDocSnapshot, 'Active doc remains untouched after malformed JSON');

// Case B: Corrupted schema (missing schemaVersion, dangling connections)
let corruptedSchemaThrown = false;
try {
  repo.importProjectJson(JSON.stringify({
    name: 'Corrupt Schema',
    components: [],
    connections: [{ id: 'w1', fromComponentId: 'ghost1', fromPinId: 'p1', toComponentId: 'ghost2', toPinId: 'p2' }],
  }));
} catch (err: any) {
  corruptedSchemaThrown = true;
  assert(err.message.includes('schemaVersion') || err.message.includes('không hợp lệ'), 'Expected schema error');
}
assert(corruptedSchemaThrown, 'Corrupted schema must throw error');
assert(JSON.stringify(activeDoc) === openDocSnapshot, 'Active doc remains untouched after corrupted schema import');

// Case C: Future schemaVersion (e.g. version 99)
let futureVersionThrown = false;
try {
  repo.importProjectJson(JSON.stringify({
    id: 'proj_future',
    name: 'Future Circuit Project',
    schemaVersion: 99,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    board: { width: 100, depth: 80, thickness: 1.6, gridSize: 2.54 },
    components: [],
    connections: [],
  }));
} catch (err: any) {
  futureVersionThrown = true;
  assert(err.message.includes('schemaVersion 99'), 'Error indicates future schemaVersion 99');
  assert(err.message.includes('Giữ nguyên bản gốc'), 'Error explicitly confirms original is preserved');
}
assert(futureVersionThrown, 'Future schemaVersion must throw error and preserve original');
assert(JSON.stringify(activeDoc) === openDocSnapshot, 'Active doc remains untouched after future schema rejection');

// Case D: Valid import succeeds
const validExportJson = repo.exportProjectJson(activeDoc);
const importedDoc = repo.importProjectJson(validExportJson);
assert(importedDoc.id === activeDoc.id, 'Valid JSON imported successfully');
assert(importedDoc.name === activeDoc.name, 'Imported document name matches');

// -------------------------------------------------------------
// 3. Concurrency conflict check (Optimistic Locking)
// -------------------------------------------------------------
console.log('\n[3] Testing Optimistic Concurrency Conflict Detection');
const conflictStorage = new MockMemoryStorage();
const conflictRepo = new LocalStorageProjectRepository(conflictStorage);

const baseDoc = createSampleLedCircuitFixture();
await conflictRepo.saveProject(baseDoc); // Revision 1

// Session 1 updates project to revision 2
const session1Doc: ProjectDocument = { ...baseDoc, revision: 2, name: 'Sửa ở Tab 1' };
await conflictRepo.saveProject(session1Doc);

// Session 2 attempts to save with expectedRevision = 1 (stale)
const session2Doc: ProjectDocument = { ...baseDoc, revision: 2, name: 'Sửa ở Tab 2' };
const conflictResult = await conflictRepo.saveProject(session2Doc, 1);

assert(conflictResult.conflict === true, 'Conflict detected when expectedRevision is stale');
assert(conflictResult.success === false, 'Save was rejected due to conflict');
assert(conflictResult.message?.includes('Xung đột phiên bản') ?? false, 'Conflict message provided');

// -------------------------------------------------------------
// 4. Catalog, List & Delete Projects
// -------------------------------------------------------------
console.log('\n[4] Testing Project Catalog, Listing, and Deletion');
const multiRepo = new LocalStorageProjectRepository(new MockMemoryStorage());

const p1 = multiRepo.createProject({ name: 'Dự án Alpha' });
const p2 = multiRepo.createProject({ name: 'Dự án Beta' });

await multiRepo.saveProject(p1);
await multiRepo.saveProject(p2);

const catalog = await multiRepo.listProjects();
assert(catalog.length === 2, 'Catalog contains 2 projects');
assert(catalog.some((p) => p.name === 'Dự án Alpha'), 'Catalog contains Alpha');
assert(catalog.some((p) => p.name === 'Dự án Beta'), 'Catalog contains Beta');

// Delete p1
const delResult = await multiRepo.deleteProject(p1.id);
assert(delResult === true, 'Delete Alpha succeeded');

const catalogAfterDel = await multiRepo.listProjects();
assert(catalogAfterDel.length === 1, 'Catalog has 1 project after deletion');
assert(!catalogAfterDel.some((p) => p.id === p1.id), 'Alpha is removed from catalog');

// -------------------------------------------------------------
// 5. Tách biệt State Editor khỏi ProjectDocument
// -------------------------------------------------------------
console.log('\n[5] Testing Editor Interaction State Separation from ProjectDocument');
const interactionState: EditorInteractionState = {
  selectedComponentId: 'res_1',
  selectedWireId: null,
  hoveredComponentId: 'led_1',
  hoveredPinId: 'pin_anode',
  activePinWiring: { componentId: 'dc_1', pinId: 'pin_pos' },
  mode: 'wire',
  camera: {
    position: [0, 80, 120],
    target: [0, 0, 0],
    isLowGraphics: false,
  },
};

// Assert ProjectDocument has no camera, selection, hover or Three.js properties
const docKeys = Object.keys(activeDoc);
assert(!docKeys.includes('selectedComponentId'), 'ProjectDocument must NOT have selectedComponentId');
assert(!docKeys.includes('hoveredComponentId'), 'ProjectDocument must NOT have hoveredComponentId');
assert(!docKeys.includes('camera'), 'ProjectDocument must NOT have camera state');
assert(!docKeys.includes('mode'), 'ProjectDocument must NOT have editor mode');
assert(!docKeys.includes('activePinWiring'), 'ProjectDocument must NOT have activePinWiring');

console.log('\n========================================');
console.log('🎉 ALL TASK 2.3 TESTS PASSED SUCCESSFULLY!');
console.log('========================================\n');
