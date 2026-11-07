/**
 * Incremental 3D scene updates, using the real mesh builders with three.js in Node (no GPU).
 * Timings measure JavaScript scene construction only; they are not FPS measurements.
 * Run with: npx tsx test/scene_incremental.test.ts
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { reconcileChildren } from '../src/scene/sceneReconciler.ts';
import { applyComponentTransform, componentVisualSignature, createComponentMesh } from '../src/scene/proceduralModels.ts';
import { componentLayoutHash, createWireMesh, wireVisualSignature } from '../src/scene/wires.ts';
import { clearGroup } from '../src/scene/disposal.ts';
import { SceneMaterialRegistry } from '../src/scene/materials.ts';
import { COMPONENT_DEFINITION_MAP } from '../src/domain/components/definitions.ts';
import { ComponentInstance, Connection } from '../src/domain/project/types.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err?.message || err}`);
    console.log(`  ✗ ${name}\n      ${err?.message || err}`);
  }
}

function buildCircuit(count: number) {
  const components: ComponentInstance[] = [];
  const connections: Connection[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i % 3;
    const definitionId = kind === 0 ? 'resistor' : kind === 1 ? 'led' : 'switch';
    components.push({
      instanceId: `c${i}`,
      definitionId,
      name: `${definitionId}${i}`,
      position: { x: (i % 20) * 12, y: 0, z: Math.floor(i / 20) * 12 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: kind === 0 ? { resistance: 220 } : kind === 1 ? { color: 'red' } : {},
    });
    if (i > 0 && kind === 1) {
      connections.push({ id: `w${i}`, fromComponentId: `c${i - 1}`, fromPinId: 'pin2', toComponentId: `c${i}`, toPinId: 'anode', wireStyle: 'straight' });
    }
  }
  return { components, connections };
}

type SimState = Record<string, boolean>;
function syncComponents(group: THREE.Group, components: ComponentInstance[], sim: SimState = {}, switches: SimState = {}) {
  const options = (c: ComponentInstance) => ({ isSimulationOn: Boolean(sim[c.instanceId]), switchClosed: Boolean(switches[c.instanceId]) });
  const started = performance.now();
  const stats = reconcileChildren(
    group,
    components.map((c) => ({
      key: c.instanceId,
      signature: componentVisualSignature(c, COMPONENT_DEFINITION_MAP.get(c.definitionId)!, options(c)),
      data: c,
    })),
    (c) => createComponentMesh(c, COMPONENT_DEFINITION_MAP.get(c.definitionId)!, options(c)),
    (obj, c) => applyComponentTransform(obj, c)
  );
  return { ...stats, ms: performance.now() - started };
}

console.log('\n[Component meshes]');
const { components, connections } = buildCircuit(60);
const group = new THREE.Group();
syncComponents(group, components);

check('Dựng lần đầu tạo đủ mesh, tên giữ nguyên để raycast/kéo thả tìm được', () => {
  assert.equal(group.children.length, 60);
  assert.equal(group.children[5].name, 'comp-c5');
  assert.equal(group.children[5].userData.instanceId, 'c5');
});
check('Render lại không có thay đổi (ví dụ chọn linh kiện): không dựng lại mesh nào', () => {
  const identity = [...group.children];
  const s = syncComponents(group, components);
  assert.equal(s.built, 0);
  assert.equal(s.removed, 0);
  assert.equal(s.kept, 60);
  assert.ok(group.children.every((c, i) => c === identity[i]));
});
check('Mô phỏng bật: chỉ LED đổi trạng thái được dựng lại, điện trở giữ nguyên', () => {
  const led = group.children[1];
  const resistor = group.children[0];
  const s = syncComponents(group, components, { c0: true, c1: true });
  assert.equal(s.built, 1);
  assert.notEqual(group.children[1], led);
  assert.equal(group.children[0], resistor);
  assert.ok(group.children[1].getObjectsByProperty('type', 'PointLight').length > 0, 'LED glow present');
});
check('Bật công tắc: chỉ đúng công tắc đó được dựng lại', () => {
  const s = syncComponents(group, components, { c0: true, c1: true }, { c2: true });
  assert.equal(s.built, 1);
});
check('Di chuyển linh kiện: giữ nguyên mesh, cập nhật vị trí đúng', () => {
  const moved = components.map((c) => (c.instanceId === 'c3' ? { ...c, position: { x: 99, y: 2, z: -7 }, rotation: { x: 0, y: 90, z: 0 } } : c));
  const mesh = group.children[3];
  const s = syncComponents(group, moved, { c0: true, c1: true }, { c2: true });
  assert.equal(s.built, 0);
  assert.equal(group.children[3], mesh);
  assert.deepEqual(mesh.position.toArray(), [99, 2, -7]);
  assert.ok(Math.abs(mesh.rotation.y - Math.PI / 2) < 1e-9);
});
check('Đổi tham số: chỉ linh kiện đó được dựng lại', () => {
  const changed = components.map((c) => (c.instanceId === 'c0' ? { ...c, parameters: { resistance: 1000 } } : c));
  const s = syncComponents(group, changed, { c0: true, c1: true }, { c2: true });
  assert.equal(s.built, 1);
});
check('Xóa rồi Undo: giải phóng geometry của mesh bị xóa, thứ tự đúng theo tài liệu', () => {
  let disposed = 0;
  group.children[10].traverse((o: any) => {
    if (o.geometry) o.geometry.addEventListener('dispose', () => (disposed += 1));
  });
  const without = components.filter((c) => c.instanceId !== 'c10');
  const s1 = syncComponents(group, without);
  assert.ok(s1.removed >= 1);
  assert.ok(disposed > 0, 'geometry disposed');
  assert.equal(group.children.some((c) => c.name === 'comp-c10'), false);
  syncComponents(group, components);
  assert.equal(group.children[10].name, 'comp-c10');
  assert.equal(group.children.length, 60);
});
check('Vật liệu dùng chung không bị dispose khi xóa mesh', () => {
  let disposedShared = 0;
  const registry = SceneMaterialRegistry.getInstance();
  const ledMaterial = registry.getLedMaterial('red', false);
  ledMaterial.addEventListener('dispose', () => (disposedShared += 1));
  registry.pinLeadMaterial.addEventListener('dispose', () => (disposedShared += 1));
  const holder = new THREE.Group();
  const led = createComponentMesh(components[1], COMPONENT_DEFINITION_MAP.get('led')!, { isSimulationOn: false });
  holder.add(led);
  let usesRegistryMaterial = false;
  led.traverse((o: any) => {
    if (o.material === ledMaterial) usesRegistryMaterial = true;
  });
  assert.ok(usesRegistryMaterial, 'the LED mesh really uses the shared material');
  clearGroup(holder);
  assert.equal(disposedShared, 0);
});

console.log('\n[Wires]');
const wires = new THREE.Group();
const wireSync = (comps: ComponentInstance[], conns: Connection[], selected: string | null) => {
  const hash = componentLayoutHash(comps);
  return reconcileChildren(
    wires,
    conns.map((c) => ({ key: c.id, signature: wireVisualSignature(c, comps, c.id === selected, hash), data: c })),
    (c) => createWireMesh(c, comps, c.id === selected)
  );
};
wireSync(components, connections, null);
check('Chọn một dây chỉ dựng lại đúng dây đó', () => {
  const s = wireSync(components, connections, connections[0].id);
  assert.equal(s.built, 1);
  assert.equal(s.kept, connections.length - 1);
});
check('Đổi tham số linh kiện không dựng lại dây', () => {
  const changed = components.map((c) => (c.instanceId === 'c0' ? { ...c, parameters: { resistance: 1000 } } : c));
  const s = wireSync(changed, connections, connections[0].id);
  assert.equal(s.built, 0);
});
check('Di chuyển linh kiện dựng lại dây nối với nó', () => {
  const moved = components.map((c) => (c.instanceId === 'c1' ? { ...c, position: { x: 50, y: 0, z: 50 } } : c));
  const s = wireSync(moved, connections, connections[0].id);
  assert.equal(s.built, 1);
});
check('Dây định tuyến vuông góc dựng lại khi bất kỳ vật cản nào di chuyển', () => {
  const ortho = connections.map((c) => ({ ...c, wireStyle: 'orthogonal' as const }));
  wireSync(components, ortho, null);
  const moved = components.map((c) => (c.instanceId === 'c30' ? { ...c, position: { x: 77, y: 0, z: 77 } } : c));
  const s = wireSync(moved, ortho, null);
  assert.ok(s.built >= ortho.length - 2);
});

console.log('\n[Scene construction time: full rebuild vs incremental, JavaScript only]');
for (const size of [20, 100, 400]) {
  const circuit = buildCircuit(size);
  const g = new THREE.Group();
  syncComponents(g, circuit.components);
  // what every selection / simulation change used to cost
  const t0 = performance.now();
  clearGroup(g);
  syncComponents(g, circuit.components);
  const full = performance.now() - t0;
  const select = syncComponents(g, circuit.components);
  const oneLed = syncComponents(g, circuit.components, { c1: true });
  console.log(
    `  ${String(size).padStart(4)} linh kiện: dựng lại toàn bộ ${full.toFixed(1).padStart(7)} ms | chọn linh kiện ${select.ms.toFixed(2).padStart(6)} ms (built=${select.built}) | 1 LED đổi trạng thái ${oneLed.ms.toFixed(2).padStart(6)} ms (built=${oneLed.built})`
  );
  check(`Cảnh ${size} linh kiện: chọn linh kiện nhanh hơn dựng lại toàn bộ và không dựng mesh`, () => {
    assert.equal(select.built, 0);
    assert.ok(select.ms < full, `${select.ms} < ${full}`);
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFAILURES:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('🎉 SCENE INCREMENTAL TESTS PASSED');
