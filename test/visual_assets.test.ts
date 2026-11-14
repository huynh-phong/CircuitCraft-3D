/**
 * VISUAL-1 — asset library, v2 component models, model set registry, workbench decoration.
 *
 * Runs in Node (no WebGL): it checks scene objects, pin anchors, GPU resource bookkeeping through
 * dispose events and the asset caches. `renderer.info` itself is checked in the browser.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COMPONENT_DEFINITION_MAP } from '../src/domain/components/definitions.ts';
import type { ComponentInstance, ProjectDocument } from '../src/domain/project/types.ts';
import { SAMPLE_PROJECTS } from '../src/persistence/sampleProjects.ts';
import { clearGroup, isShared } from '../src/scene/disposal.ts';
import { reconcileChildren } from '../src/scene/sceneReconciler.ts';
import { assetCacheStats } from '../src/scene/assets/cache.ts';
import { MIN_TOUCH_RADIUS_MM } from '../src/scene/assets/pins/index.ts';
import { PinMarkerLayer } from '../src/scene/assets/pins/markers.ts';
import { countTriangles } from '../src/scene/assets/primitives/index.ts';
import { COMPONENT_TRIANGLE_BUDGET, DetailLevel, WORKBENCH_TRIANGLE_BUDGET } from '../src/scene/assets/quality.ts';
import { getModelSpec, listModelDefinitionIds, listModelSpecs } from '../src/scene/assets/registry.ts';
import { resistorBands } from '../src/scene/assets/specs/resistor.ts';
import { componentVisualSignature, createComponentMesh, DEFAULT_MODEL_SET } from '../src/scene/models/index.ts';
import { buildWorkbench, workbenchKeepOut, PLACEMENT_HALF_X, PLACEMENT_HALF_Z } from '../src/scene/workbench/workbench.ts';

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

const DETAILS: DetailLevel[] = ['low', 'balanced', 'high'];
const ANCHOR_TOLERANCE = 0.01; // scene units

function instanceOf(definitionId: string, id = 'x1', parameters: Record<string, any> = {}): ComponentInstance {
  const def = COMPONENT_DEFINITION_MAP.get(definitionId)!;
  return {
    instanceId: id,
    definitionId,
    name: id.toUpperCase(),
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters: { ...def.defaultParameters, ...parameters },
  };
}

/** Pin hit targets of a built component: pin id -> anchor (x, y, z) and collider radius. */
function pinTargets(group: THREE.Object3D): Map<string, { x: number; y: number; z: number; radius: number }> {
  const out = new Map<string, { x: number; y: number; z: number; radius: number }>();
  group.traverse((o) => {
    if (!(o as THREE.Group).isGroup || !o.userData?.isPin || !o.name.startsWith('pin-')) return;
    const hit = o.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    if (!hit) return;
    const radius = (hit.geometry as THREE.CylinderGeometry).parameters.radiusTop;
    out.set(o.userData.pinId, { x: o.position.x, y: hit.position.y, z: o.position.z, radius });
  });
  return out;
}

const isHitTarget = (mesh: THREE.Mesh) => Boolean(mesh.userData?.isPin);

console.log('\n[Registry v2: pins and anchors]');
check(`Bộ model mặc định là "v2"`, () => assert.equal(DEFAULT_MODEL_SET, 'v2'));
check('Registry có đủ 23 spec (6 Đợt 1 + 17 Đợt 2)', () => assert.equal(listModelSpecs().length, 23));

const legacyOffAnchor = new Set<string>();
for (const definitionId of listModelDefinitionIds()) {
  const def = COMPONENT_DEFINITION_MAP.get(definitionId);
  const spec = getModelSpec(definitionId)!;
  check(`${definitionId}: definition tồn tại và spec chỉ khai báo pin ID có thật`, () => {
    assert.ok(def, `definition "${definitionId}" missing`);
    const ids = new Set(def!.pins.map((p) => p.id));
    for (const pinId of Object.keys(spec.pins)) assert.ok(ids.has(pinId), `spec pin "${pinId}" not in definition`);
  });
  if (!def) continue;
  const inst = instanceOf(definitionId);
  const legacy = pinTargets(createComponentMesh(inst, def, {}, { modelSet: 'legacy' }));
  for (const detail of DETAILS) {
    check(`${definitionId} @${detail}: đủ pin ID, anchor trùng định nghĩa và trùng legacy (≤ ${ANCHOR_TOLERANCE})`, () => {
      const group = createComponentMesh(inst, def, {}, { modelSet: 'v2', detail });
      assert.equal(group.userData.modelSpec, spec.id, 'built from the v2 spec');
      const v2 = pinTargets(group);
      assert.deepEqual([...v2.keys()].sort(), def.pins.map((p) => p.id).sort(), 'pin ids = definition pin ids');
      for (const pin of def.pins) {
        const t = v2.get(pin.id)!;
        assert.ok(Math.abs(t.x - pin.localOffset.x) <= ANCHOR_TOLERANCE, `${pin.id}.x`);
        assert.ok(Math.abs(t.y - pin.localOffset.y) <= ANCHOR_TOLERANCE, `${pin.id}.y`);
        assert.ok(Math.abs(t.z - pin.localOffset.z) <= ANCHOR_TOLERANCE, `${pin.id}.z`);
        assert.ok(t.radius >= MIN_TOUCH_RADIUS_MM - 1e-9, `${pin.id} touch radius not smaller than legacy`);
        const old = legacy.get(pin.id);
        assert.ok(old, `legacy has pin ${pin.id}`);
        assert.ok(t.radius >= old!.radius - 1e-9, `${pin.id} touch radius vs legacy`);
        const o = pin.localOffset;
        if (Math.hypot(old!.x - o.x, old!.y - o.y, old!.z - o.z) > ANCHOR_TOLERANCE) {
          // The LEGACY hit target itself is off the logical anchor (wires, solver and DRC use the
          // definition): v2 follows the definition. Listed explicitly below.
          legacyOffAnchor.add(`${definitionId}:${pin.id}`);
        } else {
          assert.ok(Math.hypot(t.x - old!.x, t.y - old!.y, t.z - old!.z) <= ANCHOR_TOLERANCE, `${pin.id} anchor vs legacy`);
        }
      }
    });
    check(`${definitionId} @${detail}: trong ngân sách tam giác (${COMPONENT_TRIANGLE_BUDGET[detail]})`, () => {
      const group = createComponentMesh(inst, def, { isSimulationOn: true, visual: { brightness: 1 } as any }, { modelSet: 'v2', detail });
      const triangles = countTriangles(group, (m) => !isHitTarget(m));
      assert.ok(triangles > 0 && triangles <= COMPONENT_TRIANGLE_BUDGET[detail], `${triangles} triangles`);
    });
  }
}

check('Chỉ đúng các vùng chạm legacy đã biết là lệch anchor logic (tụ hóa, diode); v2 theo definition', () => {
  assert.deepEqual([...legacyOffAnchor].sort(), ['capacitor:pin_neg', 'capacitor:pin_pos', 'diode:anode', 'diode:cathode']);
});

check('Số tam giác giảm dần theo mức Chất lượng (cao ≥ chuẩn ≥ thấp)', () => {
  for (const definitionId of listModelSpecs().map((spec) => spec.definitionIds[0])) {
    const def = COMPONENT_DEFINITION_MAP.get(definitionId)!;
    const [low, balanced, high] = DETAILS.map((detail) =>
      countTriangles(createComponentMesh(instanceOf(definitionId), def, {}, { modelSet: 'v2', detail }), (m) => !isHitTarget(m))
    );
    assert.ok(low <= balanced && balanced <= high, `${definitionId}: ${low} / ${balanced} / ${high}`);
    console.log(`      ${definitionId.padEnd(17)} tam giác: thấp ${low} | chuẩn ${balanced} | cao ${high}`);
  }
});

console.log('\n[Hành vi model v2]');
const hexes = (ohms: number, tol?: number) => resistorBands(ohms, tol).map((b) => b.hex.toString(16).padStart(6, '0'));
check('Vòng màu điện trở sinh theo giá trị thật (4 vòng)', () => {
  assert.deepEqual(hexes(220), ['dc2626', 'dc2626', '7a4a1e', 'd4af37']); // red red brown gold
  assert.deepEqual(hexes(4700), ['eab308', '7c3aed', 'dc2626', 'd4af37']); // yellow violet red gold
  assert.deepEqual(hexes(1_000_000), ['7a4a1e', '1c1917', '16a34a', 'd4af37']); // brown black green gold
  assert.deepEqual(hexes(4.7), ['eab308', '7c3aed', 'd4af37', 'd4af37']); // x0.1 = gold multiplier
});
check('Điện trở cần 3 chữ số hoặc sai số ≤ 2% dùng 5 vòng', () => {
  assert.deepEqual(hexes(1250), ['7a4a1e', 'dc2626', '16a34a', '7a4a1e', 'd4af37']);
  assert.equal(resistorBands(10000, 1).length, 5);
  assert.equal(resistorBands(10000, 5).length, 4);
});
check('Đổi giá trị điện trở đổi chữ ký hình ảnh (mesh được dựng lại)', () => {
  const def = COMPONENT_DEFINITION_MAP.get('resistor')!;
  assert.notEqual(
    componentVisualSignature(instanceOf('resistor', 'r', { resistance: 220 }), def),
    componentVisualSignature(instanceOf('resistor', 'r', { resistance: 330 }), def)
  );
});
check('LED chỉ phát sáng theo kết quả mô phỏng (không có kết quả = không có đèn)', () => {
  const def = COMPONENT_DEFINITION_MAP.get('led')!;
  const glow = (options: any) => createComponentMesh(instanceOf('led'), def, options, { modelSet: 'v2' }).getObjectsByProperty('name', 'sim-glow');
  assert.equal(glow({}).length, 0, 'no simulation');
  assert.equal(glow({ isSimulationOn: false, visual: { brightness: 1 } }).length, 0, 'simulation says off');
  assert.equal(glow({ isSimulationOn: true, visual: { brightness: 0 } }).length, 0, 'zero current');
  const dim = glow({ isSimulationOn: true, visual: { brightness: 0.25 } });
  const full = glow({ isSimulationOn: true, visual: { brightness: 1 } });
  const intensity = (list: THREE.Object3D[]) => (list.find((o) => (o as THREE.PointLight).isPointLight) as THREE.PointLight).intensity;
  assert.ok(intensity(dim) > 0 && intensity(dim) < intensity(full), 'light scales with the solved brightness');
});
check('Công tắc: cần gạt nằm về phía pin2 khi đóng, pin1 khi mở, và vẫn bấm được', () => {
  const def = COMPONENT_DEFINITION_MAP.get('switch')!;
  const knobX = (closed: boolean) => {
    const knob = createComponentMesh(instanceOf('switch', 's1'), def, { switchClosed: closed }, { modelSet: 'v2' }).getObjectByName('switch-toggle-knob')!;
    assert.equal(knob.userData.componentId, 's1');
    return knob.position.x;
  };
  assert.ok(knobX(true) > 0 && knobX(false) < 0);
});
check('Biến trở: trục xoay theo vị trí con chạy', () => {
  const def = COMPONENT_DEFINITION_MAP.get('potentiometer')!;
  const key = (pos: number) => {
    const g = createComponentMesh(instanceOf('potentiometer', 'p', { currentPosition: pos }), def, {}, { modelSet: 'v2' });
    const box = new THREE.Box3();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === 'flat:f8fafc') box.expandByObject(m);
    });
    return box.getCenter(new THREE.Vector3()).x;
  };
  assert.ok(Math.abs(key(0.5)) < 0.05, 'indicator centred at mid travel');
  assert.ok(key(0) * key(1) < 0, 'indicator on opposite sides at the two end stops');
});

console.log('\n[modelSet legacy ↔ v2]');
const cloneDoc = (doc: ProjectDocument) => JSON.parse(JSON.stringify(doc)) as ProjectDocument;
check('Chuyển legacy ↔ v2 và đổi Chất lượng không thay đổi dữ liệu dự án', () => {
  for (const doc of SAMPLE_PROJECTS) {
    const before = JSON.stringify(doc);
    const working = cloneDoc(doc);
    for (const modelSet of ['legacy', 'v2', 'legacy', 'v2'] as const) {
      for (const detail of DETAILS) {
        for (const inst of working.components) {
          const def = COMPONENT_DEFINITION_MAP.get(inst.definitionId);
          if (!def || def.modelUrl) continue; // GLB parts need a loader (browser only)
          createComponentMesh(inst, def, {}, { modelSet, detail });
          componentVisualSignature(inst, def, {}, { modelSet, detail });
        }
      }
    }
    assert.equal(JSON.stringify(working), before, doc.projectId);
  }
});
check('Chuyển bộ model dựng lại đúng linh kiện có spec v2, linh kiện khác giữ nguyên mesh', () => {
  const comps = [instanceOf('resistor', 'a'), instanceOf('ultrasonic-sensor', 'b')];
  const group = new THREE.Group();
  const sync = (modelSet: 'legacy' | 'v2') =>
    reconcileChildren(
      group,
      comps.map((c) => ({ key: c.instanceId, signature: componentVisualSignature(c, COMPONENT_DEFINITION_MAP.get(c.definitionId)!, {}, { modelSet }), data: c })),
      (c) => createComponentMesh(c, COMPONENT_DEFINITION_MAP.get(c.definitionId)!, {}, { modelSet })
    );
  sync('v2');
  const untouched = group.children[1];
  const stats = sync('legacy');
  assert.equal(stats.built, 1, 'only the resistor (has a v2 spec) is rebuilt');
  assert.equal(group.children[1], untouched, 'part without a v2 spec untouched');
  assert.equal(group.children[0].userData.modelSpec, undefined, 'resistor is now the legacy model');
  clearGroup(group);
});
check('Linh kiện chưa có spec v2 vẫn dựng bằng model legacy trong bộ v2', () => {
  const def = COMPONENT_DEFINITION_MAP.get('ultrasonic-sensor')!;
  assert.equal(createComponentMesh(instanceOf('ultrasonic-sensor'), def, {}, { modelSet: 'v2' }).userData.modelSpec, undefined);
});

console.log('\n[Bàn làm việc: chỉ tồn tại trong scene]');
const benchOptions = (detail: DetailLevel, decor = true) => ({ ...workbenchKeepOut(SAMPLE_PROJECTS[0].board), detail, decor, theme: 'dark' as const });
check('Dựng bàn làm việc không đọc/ghi ProjectDocument', () => {
  const before = JSON.stringify(SAMPLE_PROJECTS[0]);
  const bench = buildWorkbench(benchOptions('high'));
  assert.equal(JSON.stringify(SAMPLE_PROJECTS[0]), before);
  assert.equal(bench.userData.sceneOnly, true);
  clearGroup(new THREE.Group().add(bench));
});
check('Dữ liệu lưu/xuất của dự án không chứa đồ trang trí hay cài đặt hiển thị', () => {
  const allowed = ['schemaVersion', 'projectId', 'name', 'description', 'revision', 'units', 'board', 'components', 'connections', 'wireRoutes', 'createdAt', 'updatedAt', 'authorId', 'thumbnail', 'metadata', 'projectType'];
  for (const doc of SAMPLE_PROJECTS) {
    const saved = JSON.stringify(doc);
    for (const key of Object.keys(JSON.parse(saved))) assert.ok(allowed.includes(key), `unexpected top-level key "${key}"`);
    for (const word of ['workbench', 'decor', 'modelSet', 'showGrid', 'modelSpec', 'detail']) {
      assert.equal(saved.includes(`"${word}"`), false, `"${word}" must not be in a saved project`);
    }
  }
});
check('Đồ trang trí không bắt raycast (mọi hướng tia đều trượt)', () => {
  const bench = buildWorkbench(benchOptions('high'));
  bench.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  let hits = 0;
  let meshes = 0;
  bench.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes += 1;
    // Aim straight down at the centre of each mesh: a pickable mesh would be hit
    const centre = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    raycaster.set(new THREE.Vector3(centre.x, 1000, centre.z), new THREE.Vector3(0, -1, 0));
    hits += raycaster.intersectObject(bench, true).length;
  });
  assert.ok(meshes > 5, 'the bench has meshes');
  assert.equal(hits, 0);
  clearGroup(new THREE.Group().add(bench));
});
check('Đồ trang trí nằm ngoài vùng làm việc với mọi kích thước board', () => {
  for (const [width, depth] of [[80, 60], [140, 90], [300, 300], [200, 300]]) {
    const keep = workbenchKeepOut({ width, depth });
    assert.ok(keep.keepX >= Math.max(PLACEMENT_HALF_X, width / 2) && keep.keepZ >= Math.max(PLACEMENT_HALF_Z, depth / 2));
    const bench = buildWorkbench({ ...keep, detail: 'balanced', decor: true, theme: 'dark' });
    bench.updateMatrixWorld(true);
    const decor = bench.getObjectByName('workbench-decor')!;
    decor.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Soft contact shadows may spill a little; solid geometry may not enter the work area
      if ((m.material as THREE.Material).name === 'bench:contact-shadow') return;
      const pos = m.geometry.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const inside = Math.abs(v.x) < Math.max(PLACEMENT_HALF_X, width / 2) && Math.abs(v.z) < Math.max(PLACEMENT_HALF_Z, depth / 2);
        assert.ok(!inside, `decor vertex inside the work area (${v.x.toFixed(0)}, ${v.z.toFixed(0)}) for board ${width}x${depth}`);
      }
    });
    clearGroup(new THREE.Group().add(bench));
  }
});
check('Mức Chất lượng giảm số đồ trang trí; tắt trang trí chỉ còn mặt bàn; đèn chỉ có ở mức cao', () => {
  const tri = (detail: DetailLevel, decor = true) => {
    const bench = buildWorkbench(benchOptions(detail, decor));
    const out = { triangles: countTriangles(bench), lights: bench.getObjectsByProperty('isSpotLight', true).length, decor: Boolean(bench.getObjectByName('workbench-decor')) };
    clearGroup(new THREE.Group().add(bench));
    return out;
  };
  const low = tri('low');
  const balanced = tri('balanced');
  const high = tri('high');
  const off = tri('high', false);
  console.log(`      tam giác bàn làm việc: thấp ${low.triangles} | chuẩn ${balanced.triangles} | cao ${high.triangles} | tắt trang trí ${off.triangles}`);
  assert.ok(low.triangles < balanced.triangles && balanced.triangles <= high.triangles);
  for (const detail of DETAILS) assert.ok({ low, balanced, high }[detail].triangles <= WORKBENCH_TRIANGLE_BUDGET[detail], `${detail} within budget`);
  assert.equal(low.lights + balanced.lights, 0);
  assert.equal(high.lights, 1);
  assert.equal(off.decor, false);
  assert.ok(off.triangles < low.triangles);
});

console.log('\n[Giải phóng tài nguyên GPU]');
/** Counts geometries that are created for a subtree and how many of them get disposed. */
function trackOwned(root: THREE.Object3D, counter: { live: number }) {
  const seen = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g || seen.has(g) || isShared(g)) return;
    seen.add(g);
    counter.live += 1;
    g.addEventListener('dispose', () => (counter.live -= 1));
  });
}
check('Thêm/xóa linh kiện lặp lại: geometry riêng được giải phóng hết, cache dùng chung không tăng', () => {
  const ids = ['dc-source', 'resistor', 'led', 'switch', 'potentiometer', 'connector'];
  const holder = new THREE.Group();
  const counter = { live: 0 };
  const cycle = (detail: DetailLevel) => {
    for (const id of ids) {
      const mesh = createComponentMesh(instanceOf(id), COMPONENT_DEFINITION_MAP.get(id)!, { isSimulationOn: true, visual: { brightness: 1 } as any }, { modelSet: 'v2', detail });
      trackOwned(mesh, counter);
      holder.add(mesh);
    }
    clearGroup(holder);
  };
  for (const detail of DETAILS) cycle(detail); // warm the caches for every detail level
  const warm = assetCacheStats();
  for (let i = 0; i < 25; i++) for (const detail of DETAILS) cycle(detail);
  assert.equal(counter.live, 0, 'every non-shared geometry was disposed');
  assert.deepEqual(assetCacheStats(), warm, 'shared caches stay the same size');
});
check('Bật/tắt trang trí và đổi Chất lượng lặp lại: không rò rỉ geometry, cache không tăng', () => {
  const holder = new THREE.Group();
  const counter = { live: 0 };
  const cycle = () => {
    for (const detail of DETAILS) {
      for (const decor of [true, false]) {
        const bench = buildWorkbench(benchOptions(detail, decor));
        trackOwned(bench, counter);
        holder.add(bench);
        clearGroup(holder);
      }
    }
  };
  cycle();
  const warm = assetCacheStats();
  for (let i = 0; i < 10; i++) cycle();
  assert.equal(counter.live, 0);
  assert.deepEqual(assetCacheStats(), warm);
});
check('Tài nguyên dùng chung của thư viện không bị dispose khi xóa mesh', () => {
  let disposedShared = 0;
  const holder = new THREE.Group();
  const mesh = createComponentMesh(instanceOf('dc-source'), COMPONENT_DEFINITION_MAP.get('dc-source')!, {}, { modelSet: 'v2' });
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    assert.ok(isShared(mat), `material "${mat.name}" comes from the shared palette`);
    mat.addEventListener('dispose', () => (disposedShared += 1));
  });
  holder.add(mesh);
  clearGroup(holder);
  assert.equal(disposedShared, 0);
});
check('Marker chân: một InstancedMesh cho mọi chân, ẩn khi không có chân, giải phóng được', () => {
  const layer = new PinMarkerLayer();
  layer.update([]);
  assert.equal(layer.count, 0);
  const items = Array.from({ length: 700 }, (_, i) => ({ position: { x: i, y: 0, z: 0 }, state: i % 2 ? ('free' as const) : ('connected' as const) }));
  layer.update(items);
  assert.equal(layer.count, 700);
  assert.equal(layer.object.children.length, 1, 'one instanced mesh');
  layer.update(items.slice(0, 3));
  assert.equal(layer.count, 3);
  assert.equal(layer.object.children.length, 1, 'capacity is reused');
  layer.update([]);
  assert.equal(layer.count, 0);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0)).intersectObject(layer.object, true).length, 0);
  layer.dispose();
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFAILURES:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('🎉 VISUAL ASSETS TESTS PASSED');
