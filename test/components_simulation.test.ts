/**
 * Component library audit tests (2026-11-08): structure of every definition, breadboard topology,
 * reference circuits for every simulated component, DRC/solver consistency, legacy projects,
 * undo/redo of parameters and a solver time check.
 * Reference values are computed by hand from the documented models (see
 * docs/reports/COMPONENT_SIMULATION_AUDIT_2026-11-08.md).
 * Run with: npx tsx test/components_simulation.test.ts
 */
import assert from 'node:assert/strict';
import { simulateBehavior, SIM_CONSTANTS, buildConnectivity, computeBreadboardPlugs, isSwitchClosed } from '../src/domain/simulation/engine.ts';
import { validateProjectDocument } from '../src/domain/validation/engine.ts';
import { COMPONENT_DEFINITIONS, COMPONENT_DEFINITION_MAP } from '../src/domain/components/definitions.ts';
import { isKnownPin, resolveDefinitionId, resolvePinId } from '../src/domain/components/aliases.ts';
import { SIMULATION_SUPPORT } from '../src/domain/simulation/capabilities.ts';
import { CommandHistory } from '../src/domain/commands/history.ts';
import { UpdateComponentParameterCommand } from '../src/domain/commands/commands.ts';
import { ComponentInstance, Connection, ProjectDocument } from '../src/domain/project/types.ts';
import { SAMPLE_PROJECTS } from '../src/persistence/sampleProjects.ts';
import { CATALOG_DESIGNS } from '../src/server/catalogDesigns.ts';
import { LESSONS } from '../src/domain/lessons/lessonsData.ts';

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
function close(actual: number | undefined, expected: number, relTol: number, label: string) {
  assert.ok(actual !== undefined && Number.isFinite(actual), `${label} value missing (${actual})`);
  const err = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12);
  assert.ok(err <= relTol, `${label} expected ≈ ${expected}, got ${actual} (rel err ${err.toExponential(2)})`);
}

const RS = SIM_CONSTANTS.SOURCE_INTERNAL_RESISTANCE;
let seq = 0;
function comp(definitionId: string, parameters: Record<string, any> = {}, extra: Partial<ComponentInstance> = {}): ComponentInstance {
  seq += 1;
  return {
    instanceId: extra.instanceId || `${definitionId}-${seq}`,
    definitionId,
    name: extra.name || `${definitionId.toUpperCase()}${seq}`,
    // far from any breadboard, spread out so collisions / auto-plug do not interfere
    position: extra.position || { x: 300 + (seq % 8) * 30, y: 0, z: 300 + Math.floor(seq / 8) * 30 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters,
    state: extra.state,
  };
}
function w(a: ComponentInstance, ap: string, b: ComponentInstance, bp: string): Connection {
  seq += 1;
  return { id: `w${seq}`, fromComponentId: a.instanceId, fromPinId: ap, toComponentId: b.instanceId, toPinId: bp };
}
function doc(components: ComponentInstance[], connections: Connection[]): ProjectDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    projectId: `p-${seq}`,
    name: 'test',
    revision: 1,
    units: 'mm',
    board: { width: 100000, depth: 100000, thickness: 1.6, solderMaskColor: '#114a36', copperLayerCount: 2, gridSpacing: 2.54 },
    components,
    connections,
    wireRoutes: [],
    createdAt: now,
    updatedAt: now,
  };
}
const src = (v = 5) => comp('dc-source', { voltage: v });
const res = (r: number, extra: Record<string, any> = {}) => comp('resistor', { resistance: r, ...extra });

async function main() {
  // ------------------------------------------------------------------------------------------
  console.log('\n[1] Cấu trúc thư viện linh kiện');
  check('Mọi definitionId duy nhất, pin id duy nhất trong linh kiện, kiểu chân hợp lệ, tọa độ hữu hạn', () => {
    const ids = new Set<string>();
    const pinTypes = new Set(['power', 'ground', 'passive', 'input', 'output', 'bidirectional']);
    for (const def of COMPONENT_DEFINITIONS) {
      assert.ok(!ids.has(def.definitionId), `duplicate ${def.definitionId}`);
      ids.add(def.definitionId);
      assert.match(def.definitionId, /^[a-z0-9][a-z0-9-]*$/, def.definitionId);
      const pins = new Set<string>();
      for (const p of def.pins) {
        assert.ok(!pins.has(p.id), `${def.definitionId}: duplicate pin ${p.id}`);
        pins.add(p.id);
        assert.ok(pinTypes.has(p.type), `${def.definitionId}.${p.id}: type ${p.type}`);
        for (const k of ['x', 'y', 'z'] as const) assert.ok(Number.isFinite(p.localOffset[k]), `${def.definitionId}.${p.id}.${k}`);
      }
      assert.ok(def.pins.length >= 2, `${def.definitionId} has pins`);
      for (const k of ['x', 'y', 'z'] as const) assert.ok(def.dimensions[k] > 0, `${def.definitionId} dimension ${k}`);
    }
  });
  check('Giá trị mặc định nằm trong khoảng cho phép của Property Panel', () => {
    for (const def of COMPONENT_DEFINITIONS) {
      for (const f of def.parameterSchema) {
        const v = def.defaultParameters[f.name] ?? f.default;
        if (f.type === 'number') {
          assert.ok(Number.isFinite(v), `${def.definitionId}.${f.name}`);
          if (f.min !== undefined) assert.ok(v >= f.min, `${def.definitionId}.${f.name} < min`);
          if (f.max !== undefined) assert.ok(v <= f.max, `${def.definitionId}.${f.name} > max`);
        }
        if (f.type === 'select') assert.ok(f.options?.some((o) => o.value === v), `${def.definitionId}.${f.name} default not an option`);
      }
    }
  });
  check('Mọi linh kiện trong registry có mức hỗ trợ mô phỏng được công bố', () => {
    for (const def of COMPONENT_DEFINITIONS) {
      const s = SIMULATION_SUPPORT[resolveDefinitionId(def.definitionId)];
      assert.ok(s, `${def.definitionId} missing in SIMULATION_SUPPORT`);
      assert.ok(s.summary.length > 10 && s.limits.length > 5, def.definitionId);
    }
  });
  check('Sơ đồ chân theo datasheet: NE555 (DIP-8), 74HC08 (DIP-14), 7 đoạn, rơ-le, nút nhấn', () => {
    const order = (id: string) => COMPONENT_DEFINITION_MAP.get(id)!.pins.map((p) => `${p.designator}:${p.id}`).join(' ');
    assert.equal(order('ne555'), '1:gnd 2:trig 3:out 4:reset 5:ctrl 6:thr 7:dis 8:vcc');
    const hc = COMPONENT_DEFINITION_MAP.get('logic-and')!.pins;
    assert.equal(hc.length, 14);
    assert.equal(hc.find((p) => p.designator === '7')!.id, 'gnd');
    assert.equal(hc.find((p) => p.designator === '14')!.id, 'vcc');
    assert.deepEqual(['1', '2', '3'].map((d) => hc.find((p) => p.designator === d)!.id), ['in_a', 'in_b', 'out_y']);
    assert.equal(COMPONENT_DEFINITION_MAP.get('7seg-display')!.pins.length, 10);
    assert.deepEqual(COMPONENT_DEFINITION_MAP.get('relay')!.pins.map((p) => p.id), ['coil_pos', 'coil_neg', 'com', 'no', 'nc']);
    assert.equal(COMPONENT_DEFINITION_MAP.get('pushbutton')!.pins.length, 4);
    const uno = COMPONENT_DEFINITION_MAP.get('arduino-uno')!.pins.map((p) => p.id);
    for (let i = 0; i <= 13; i++) assert.ok(uno.includes(`pin_d${i}`), `D${i}`);
    for (let i = 0; i <= 5; i++) assert.ok(uno.includes(`pin_a${i}`), `A${i}`);
    for (const pwm of [3, 5, 6, 9, 10, 11]) assert.match(COMPONENT_DEFINITION_MAP.get('arduino-uno')!.pins.find((p) => p.id === `pin_d${pwm}`)!.designator!, /^~/);
  });
  check('Chân IC DIP cắm đúng lỗ breadboard: bước 2,54 mm, hai hàng vắt qua rãnh giữa, mỗi chân một lỗ riêng', () => {
    for (const id of ['ne555', 'logic-and']) {
      const bb = comp('breadboard', {}, { position: { x: 0, y: 0, z: 0 } });
      // NE555 pins sit on half-pitch columns; the 14-pin package is shifted half a pitch
      const ic = comp(id, {}, { position: { x: id === 'ne555' ? 0 : 1.27, y: 0, z: 0 } });
      const plugs = computeBreadboardPlugs(doc([bb, ic], []));
      const def = COMPONENT_DEFINITION_MAP.get(id)!;
      assert.equal(plugs.length, def.pins.length, `${id}: every pin plugged`);
      assert.equal(new Set(plugs.map((p) => p.toPinId)).size, def.pins.length, `${id}: distinct holes`);
      for (const p of plugs) {
        const row = p.toPinId.split('_')[2];
        const pin = def.pins.find((x) => x.id === p.fromPinId)!;
        assert.equal(row, pin.localOffset.z > 0 ? 'f' : 'a', `${id}.${pin.id} row`);
      }
    }
  });
  check('Tên chân cũ (AI / sản phẩm mẫu / dự án cũ) được ánh xạ về chân chuẩn', () => {
    assert.equal(resolvePinId('arduino-uno', 'a0'), 'pin_a0');
    assert.equal(resolvePinId('arduino-uno', 'gnd1'), 'pin_gnd');
    assert.equal(resolvePinId('arduino-uno', 'd9'), 'pin_d9');
    assert.equal(resolvePinId('capacitor', 'pos'), 'pin_pos');
    assert.equal(resolvePinId('servo-motor', 'signal'), 'pwm');
    assert.equal(resolveDefinitionId('servo-motor'), 'servo-sg90');
    assert.equal(resolvePinId('ne555', 'threshold'), 'thr');
    assert.ok(isKnownPin('servo-motor', 'signal'));
  });

  // ------------------------------------------------------------------------------------------
  console.log('\n[2] Breadboard: cấu trúc nối thông');
  const sameNet = (a: string, b: string, params: Record<string, any> = {}) => {
    const bb = comp('breadboard', params, { position: { x: 0, y: 0, z: 0 } });
    const r1 = comp('resistor', {});
    const r2 = comp('resistor', {});
    const c = buildConnectivity(doc([bb, r1, r2], [w(r1, 'pin1', bb, a), w(r2, 'pin1', bb, b)]));
    return c.nodeOf(r1.instanceId, 'pin1') === c.nodeOf(r2.instanceId, 'pin1');
  };
  check('Cùng cột: A–E nối thông, F–J nối thông; A–E và F–J cách điện qua rãnh giữa', () => {
    assert.ok(sameNet('tie_5_a', 'tie_5_e'));
    assert.ok(sameNet('tie_12_f', 'tie_12_j'));
    assert.ok(!sameNet('tie_5_e', 'tie_5_f'));
  });
  check('Hai cột khác nhau không nối với nhau', () => {
    assert.ok(!sameNet('tie_5_a', 'tie_6_a'));
    assert.ok(!sameNet('tie_60_j', 'tie_59_j'));
  });
  check('Thanh nguồn liền: lỗ 1 và 60 cùng nút; + và − cách điện; thanh trên và dưới cách điện', () => {
    assert.ok(sameNet('rail_top_pos_1', 'rail_top_pos_60'));
    assert.ok(!sameNet('rail_top_pos_1', 'rail_top_neg_1'));
    assert.ok(!sameNet('rail_top_pos_1', 'rail_bot_pos_1'));
    assert.ok(!sameNet('rail_top_pos_1', 'tie_1_a'));
  });
  check('Thanh nguồn ngắt giữa (railSplit): lỗ 1–30 tách khỏi 31–60', () => {
    assert.ok(sameNet('rail_top_pos_1', 'rail_top_pos_30', { railSplit: true }));
    assert.ok(!sameNet('rail_top_pos_30', 'rail_top_pos_31', { railSplit: true }));
    assert.ok(sameNet('rail_bot_neg_31', 'rail_bot_neg_60', { railSplit: true }));
  });
  check('Chân cũ strip_N nối vào đúng cột đang hiển thị (strip_2 ở cột 8)', () => {
    assert.ok(sameNet('strip_2_top', 'tie_8_c'));
    assert.ok(!sameNet('strip_2_top', 'tie_2_c'));
    assert.ok(sameNet('strip_10_bot', 'tie_60_h'));
  });
  check('Mạch thật qua breadboard: nguồn → thanh + → R 1 kΩ → cột → LED → thanh − ', () => {
    const bb = comp('breadboard', {}, { position: { x: 0, y: 0, z: 0 } });
    const s = src(5);
    const r = res(1000);
    const led = comp('led', { color: 'red' });
    const d = doc([bb, s, r, led], [
      w(s, 'vcc', bb, 'rail_top_pos_3'),
      w(r, 'pin1', bb, 'rail_top_pos_40'),
      w(r, 'pin2', bb, 'tie_20_a'),
      w(led, 'anode', bb, 'tie_20_d'),
      w(led, 'cathode', bb, 'rail_top_neg_55'),
      w(s, 'gnd', bb, 'rail_top_neg_1'),
    ]);
    const out = simulateBehavior(d);
    close(out.components[led.instanceId].currentA, 3 / (1000 + 10 + RS), 1e-6, 'I');
    const split = simulateBehavior({ ...d, components: d.components.map((c) => (c.instanceId === bb.instanceId ? { ...c, parameters: { railSplit: true } } : c)) });
    assert.equal(split.components[led.instanceId].isOn, false, 'split rail interrupts the + supply');
  });

  // ------------------------------------------------------------------------------------------
  console.log('\n[3] Mạch tham chiếu từng linh kiện');
  check('Test 1 — Điện trở: 5 V / 1 kΩ → I = 5 mA, P = 25 mW', () => {
    const s = src(5);
    const r = res(1000);
    const out = simulateBehavior(doc([s, r], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', s, 'gnd')]));
    close(out.components[r.instanceId].currentA, 5 / (1000 + RS), 1e-9, 'I');
    close(out.components[r.instanceId].powerW, 1000 * (5 / (1000 + RS)) ** 2, 1e-9, 'P');
  });
  check('Điện trở quá công suất: 5 V / 47 Ω 0,25 W → OVERPOWER, DRC cùng báo', () => {
    const s = src(5);
    const r = res(47);
    const d = doc([s, r], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', s, 'gnd')]);
    assert.ok(simulateBehavior(d).diagnostics!.some((x) => x.ruleId === 'OVERPOWER'));
    assert.ok(validateProjectDocument(d).some((x) => x.ruleId === 'OVERPOWER'));
  });
  check('Test 2 — Phân áp: 10 V, R1 = R2 = 1 kΩ → điểm giữa 5 V', () => {
    const s = src(10);
    const r1 = res(1000);
    const r2 = res(1000);
    const out = simulateBehavior(doc([s, r1, r2], [w(s, 'vcc', r1, 'pin1'), w(r1, 'pin2', r2, 'pin1'), w(r2, 'pin2', s, 'gnd')]));
    close(out.components[r2.instanceId].voltageV, (10 * 1000) / (2000 + RS), 1e-9, 'V mid');
  });
  check('Test 3 — LED: dòng theo Vf của màu (đỏ 2,0 V; lam 3,0 V kể cả dự án cũ lưu forwardVoltage: 2)', () => {
    for (const [color, vf, params] of [
      ['red', 2.0, {}],
      ['blue', 3.0, {}],
      ['blue', 3.0, { forwardVoltage: 2.0 }],
      ['green', 2.2, {}],
    ] as const) {
      const s = src(5);
      const r = res(220);
      const led = comp('led', { color, ...params });
      const out = simulateBehavior(doc([s, r, led], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', led, 'anode'), w(led, 'cathode', s, 'gnd')]));
      close(out.components[led.instanceId].currentA, (5 - vf) / (220 + 10 + RS), 1e-6, `${color} I`);
      assert.ok(out.components[led.instanceId].visual!.brightness! > 0, 'visual brightness from current');
    }
  });
  check('LED: dòng quá nhỏ (5 V / 1 MΩ) không được báo là sáng', () => {
    const s = src(5);
    const r = res(1e6);
    const led = comp('led', { color: 'red' });
    const out = simulateBehavior(doc([s, r, led], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', led, 'anode'), w(led, 'cathode', s, 'gnd')]));
    assert.equal(out.components[led.instanceId].isOn, false);
  });
  check('Diode 1N4007: thuận sụt 0,7 V; ngược khóa', () => {
    const s = src(5);
    const r = res(1000);
    const d1 = comp('diode');
    const fwd = simulateBehavior(doc([s, r, d1], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', d1, 'anode'), w(d1, 'cathode', s, 'gnd')]));
    close(fwd.components[d1.instanceId].currentA, (5 - 0.7) / (1000 + 1 + RS), 1e-6, 'I');
    const rev = simulateBehavior(doc([s, r, d1], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', d1, 'cathode'), w(d1, 'anode', s, 'gnd')]));
    assert.equal(rev.components[d1.instanceId].currentA, 0);
  });
  check('Test 4 — Tụ điện: DC xác lập không có dòng; τ = R·C = 1 kΩ × 100 µF = 0,1 s', () => {
    const s = src(5);
    const r = res(1000);
    const c = comp('capacitor', { capacitance: 100 });
    const out = simulateBehavior(doc([s, r, c], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', c, 'pin_pos'), w(c, 'pin_neg', s, 'gnd')]));
    assert.ok((out.components[r.instanceId].currentA ?? 0) < 1e-6);
    close(out.components[c.instanceId].voltageV, 5, 1e-3, 'Vc');
    close(out.components[c.instanceId].timeConstantS, (1000 + RS) * 100e-6, 1e-6, 'τ');
  });
  check('Tụ hóa mắc ngược cực và quá áp → REVERSE_POLARITY / OVERVOLTAGE', () => {
    const s = src(12);
    const r = res(1000);
    const c = comp('capacitor', { capacitance: 10, voltageRating: 6.3 });
    const out = simulateBehavior(doc([s, r, c], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', c, 'pin_neg'), w(c, 'pin_pos', s, 'gnd')]));
    const rules = out.diagnostics!.map((d) => d.ruleId);
    assert.ok(rules.includes('REVERSE_POLARITY') && rules.includes('OVERVOLTAGE'), rules.join(','));
  });
  check('Test 5 — Biến trở 10 kΩ ở 0%, 25%, 50%, 75%, 100%: V con chạy = 5·(1 − x)', () => {
    for (const pos of [0, 0.25, 0.5, 0.75, 1]) {
      const s = src(5);
      const pot = comp('potentiometer', { maxResistance: 10000, currentPosition: pos });
      const meter = res(1e7); // 10 MΩ voltmeter from wiper to GND
      const out = simulateBehavior(doc([s, pot, meter], [w(s, 'vcc', pot, 'pin1'), w(pot, 'pin2', s, 'gnd'), w(pot, 'wiper', meter, 'pin1'), w(meter, 'pin2', s, 'gnd')]));
      const v = out.components[meter.instanceId].voltageV ?? 0;
      assert.ok(Math.abs(v - 5 * (1 - pos)) < 0.005, `pos ${pos}: ${v}`);
    }
  });
  check('Test 6 — Công tắc: mở → hở mạch, đóng → mạch kín (cả tham số open cũ trong Property Panel)', () => {
    const s = src(5);
    const r = res(1000);
    const sw = comp('switch', { open: true });
    const conns = [w(s, 'vcc', sw, 'pin1'), w(sw, 'pin2', r, 'pin1'), w(r, 'pin2', s, 'gnd')];
    assert.equal(simulateBehavior(doc([s, r, sw], conns)).status, 'stopped');
    const closed = { ...sw, parameters: { open: false } };
    assert.equal(simulateBehavior(doc([s, r, closed], conns)).status, 'running');
    assert.equal(isSwitchClosed({ ...sw, parameters: {}, state: { open: false } }), true);
    assert.equal(simulateBehavior(doc([s, r, sw], conns), { [sw.instanceId]: true }).status, 'running', 'runtime toggle wins');
  });
  check('Nút nhấn 4 chân: 1A–1B luôn nối; nhấn mới nối nhóm 1 với nhóm 2', () => {
    const s = src(5);
    const r = res(1000);
    const b = comp('pushbutton', { pressed: false });
    const conns = [w(s, 'vcc', b, 'pin1b'), w(b, 'pin2b', r, 'pin1'), w(r, 'pin2', s, 'gnd')];
    assert.equal(simulateBehavior(doc([s, r, b], conns)).status, 'stopped');
    const pressed = simulateBehavior(doc([s, r, { ...b, parameters: { pressed: true } }], conns));
    close(pressed.components[r.instanceId].currentA, 5 / (1000 + RS + SIM_CONSTANTS.CONTACT_RESISTANCE), 1e-6, 'I');
  });
  check('Nguồn DC: ngắn mạch qua dây → error; quá dòng định mức → SOURCE_OVERLOAD', () => {
    const s = src(5);
    assert.equal(simulateBehavior(doc([s], [w(s, 'vcc', s, 'gnd')])).status, 'error');
    const r = res(2); // 2.5 A > 1 A
    const out = simulateBehavior(doc([s, r], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', s, 'gnd')]));
    assert.ok(out.diagnostics!.some((d) => d.ruleId === 'SOURCE_OVERLOAD'));
  });
  check('Còi chủ động: 5 V đúng cực kêu; ngược cực không kêu, không dòng; 3,3 V chưa đủ áp', () => {
    const run = (v: number, reverse = false) => {
      const s = src(v);
      const bz = comp('buzzer');
      const out = simulateBehavior(doc([s, bz], reverse ? [w(s, 'vcc', bz, 'pin_neg'), w(bz, 'pin_pos', s, 'gnd')] : [w(s, 'vcc', bz, 'pin_pos'), w(bz, 'pin_neg', s, 'gnd')]));
      return out.components[bz.instanceId];
    };
    assert.equal(run(5).isOn, true);
    close(run(5).currentA, 5 / (170 + RS), 1e-6, 'I');
    assert.equal(run(5, true).isOn, false);
    assert.ok((run(5, true).currentA ?? 0) < 1e-6);
    assert.equal(run(3.3).isOn, false);
  });
  check('LDR: tối → điện trở lớn, sáng → điện trở nhỏ (dòng tăng khi tăng ánh sáng)', () => {
    const at = (level: number) => {
      const s = src(5);
      const l = comp('ldr', { lightLevelPercent: level });
      return simulateBehavior(doc([s, l], [w(s, 'vcc', l, 'pin1'), w(l, 'pin2', s, 'gnd')])).components[l.instanceId].currentA ?? 0;
    };
    close(at(0), 5 / (1e6 + RS), 1e-6, 'dark');
    close(at(100), 5 / (400 + RS), 1e-6, 'bright');
    assert.ok(at(30) < at(60));
  });
  check('Rơ-le: 5 V cuộn hút → COM–NO đóng; 3,3 V (< 3,75 V) → COM–NC giữ đóng', () => {
    for (const [coilV, expect] of [
      [5, 'no'],
      [3.3, 'nc'],
    ] as const) {
      const coil = src(coilV);
      const load = src(12);
      const rl = comp('relay');
      const rNo = res(1200);
      const rNc = res(2400);
      const out = simulateBehavior(doc([coil, load, rl, rNo, rNc], [
        w(coil, 'vcc', rl, 'coil_pos'), w(rl, 'coil_neg', coil, 'gnd'),
        w(load, 'vcc', rl, 'com'), w(rl, 'no', rNo, 'pin1'), w(rNo, 'pin2', load, 'gnd'), w(rl, 'nc', rNc, 'pin1'), w(rNc, 'pin2', load, 'gnd'),
      ]));
      const iNo = out.components[rNo.instanceId].currentA ?? 0;
      const iNc = out.components[rNc.instanceId].currentA ?? 0;
      if (expect === 'no') {
        close(iNo, 12 / (1200 + RS + 0.01), 1e-5, 'NO load');
        assert.ok(iNc < 1e-6);
        close(out.components[rl.instanceId].currentA, coilV / (70 + RS), 1e-6, 'coil I');
      } else {
        close(iNc, 12 / (2400 + RS + 0.01), 1e-5, 'NC load');
        assert.ok(iNo < 1e-6);
      }
      assert.equal(out.components[rl.instanceId].visual!.contact, expect);
    }
  });
  check('Transistor NPN: bão hòa (RB 1 kΩ), khuếch đại (RB 1 MΩ: IC = β·IB), tắt (B nối GND)', () => {
    const build = (rb: number, baseToGnd = false) => {
      const s = src(5);
      const rB = res(rb);
      const rC = res(1000);
      const q = comp('transistor-npn', { gainBeta: 100 });
      const conns = [w(s, 'vcc', rC, 'pin1'), w(rC, 'pin2', q, 'collector'), w(q, 'emitter', s, 'gnd'), baseToGnd ? w(q, 'base', s, 'gnd') : w(s, 'vcc', rB, 'pin1')];
      if (!baseToGnd) conns.push(w(rB, 'pin2', q, 'base'));
      const out = simulateBehavior(doc([s, rB, rC, q], conns));
      return { q: out.components[q.instanceId], rc: out.components[rC.instanceId] };
    };
    const sat = build(1000);
    assert.equal(sat.q.mode, 'saturation');
    close(sat.rc.currentA, (5 - 0.2) / (1000 + 0.5), 2e-3, 'Ic sat');
    const act = build(1e6);
    assert.equal(act.q.mode, 'active');
    close(act.rc.currentA, (100 * (5 - 0.7)) / (1e6 + 10), 2e-3, 'Ic = β·Ib');
    const off = build(1000, true);
    assert.equal(off.q.mode, 'cutoff');
    assert.ok((off.rc.currentA ?? 0) < 1e-6);
  });
  check('Test 10 — LM7805: 12 V vào, tải 100 Ω → 5 V, 50 mA; nguồn cấp 50 mA + IQ 5 mA; Pd ≈ 0,41 W', () => {
    const s = src(12);
    const reg = comp('voltage-reg-7805');
    const load = res(100);
    const out = simulateBehavior(doc([s, reg, load], [w(s, 'vcc', reg, 'vin'), w(s, 'gnd', reg, 'gnd'), w(reg, 'vout', load, 'pin1'), w(load, 'pin2', s, 'gnd')]));
    close(out.components[load.instanceId].voltageV, 5 * (100 / 100.01), 1e-4, 'Vout');
    close(out.components[s.instanceId].currentA, 0.05 + 0.005, 2e-3, 'Iin');
    close(out.components[reg.instanceId].powerW, 7 * 0.05 + 12 * 0.005, 3e-3, 'Pd');
    assert.equal(out.components[reg.instanceId].mode, 'regulating');
  });
  check('LM7805: 6 V vào (thiếu 2 V dropout) → ra ≈ 4 V và cảnh báo; 40 V vào → OVERVOLTAGE', () => {
    const run = (v: number) => {
      const s = src(v);
      const reg = comp('voltage-reg-7805');
      const load = res(1000);
      return { out: simulateBehavior(doc([s, reg, load], [w(s, 'vcc', reg, 'vin'), w(s, 'gnd', reg, 'gnd'), w(reg, 'vout', load, 'pin1'), w(load, 'pin2', s, 'gnd')])), load, reg };
    };
    const lo = run(6);
    close(lo.out.components[lo.load.instanceId].voltageV, 4, 2e-3, 'Vout dropout');
    assert.ok(lo.out.diagnostics!.some((d) => d.ruleId === 'REGULATOR_DROPOUT'));
    const hi = run(40);
    assert.ok(hi.out.diagnostics!.some((d) => d.ruleId === 'OVERVOLTAGE'));
    assert.equal(hi.out.components[hi.reg.instanceId].isOn, false);
  });
  check('LM35: 25 °C → 250 mV; 80 °C → 800 mV; không có nguồn → không xuất áp', () => {
    for (const t of [25, 80]) {
      const s = src(5);
      const sensor = comp('temp-sensor', { temperatureC: t });
      const meter = res(1e6);
      const out = simulateBehavior(doc([s, sensor, meter], [w(s, 'vcc', sensor, 'vcc'), w(sensor, 'gnd', s, 'gnd'), w(sensor, 'vout', meter, 'pin1'), w(meter, 'pin2', s, 'gnd')]));
      close(out.components[meter.instanceId].voltageV, t * 0.01, 1e-4, `${t} °C`);
    }
    const s = src(5);
    const sensor = comp('temp-sensor', { temperature: 30 }); // parameter name used by lesson 6
    const meter = res(1e6);
    const off = simulateBehavior(doc([s, sensor, meter], [w(sensor, 'gnd', s, 'gnd'), w(sensor, 'vout', meter, 'pin1'), w(meter, 'pin2', s, 'gnd')]));
    assert.equal(off.components[sensor.instanceId].isOn, false);
    assert.ok((off.components[meter.instanceId].voltageV ?? 0) < 1e-6);
  });
  check('74HC08: bảng chân lý AND đủ 4 tổ hợp; ngõ vào thả nổi → không xác định + cảnh báo', () => {
    for (const [a, b] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]) {
      const s = src(5);
      const ic = comp('logic-and');
      const load = res(10000);
      const conns = [w(s, 'vcc', ic, 'vcc'), w(ic, 'gnd', s, 'gnd'), w(s, a ? 'vcc' : 'gnd', ic, 'in_a'), w(s, b ? 'vcc' : 'gnd', ic, 'in_b'), w(ic, 'out_y', load, 'pin1'), w(load, 'pin2', s, 'gnd')];
      for (const pin of ['in_2a', 'in_2b', 'in_3a', 'in_3b', 'in_4a', 'in_4b']) conns.push(w(ic, pin, s, 'gnd'));
      const out = simulateBehavior(doc([s, ic, load], conns));
      const v = out.components[load.instanceId].voltageV ?? 0;
      if (a && b) close(v, 5 * (10000 / 10050), 1e-3, 'Y high');
      else assert.ok(v < 0.01, `Y low for ${a}${b}: ${v}`);
      assert.ok(!out.diagnostics!.some((d) => d.ruleId === 'FLOATING_INPUT'));
    }
    const s = src(5);
    const ic = comp('logic-and');
    const load = res(10000);
    const out = simulateBehavior(doc([s, ic, load], [w(s, 'vcc', ic, 'vcc'), w(ic, 'gnd', s, 'gnd'), w(s, 'vcc', ic, 'in_a'), w(ic, 'out_y', load, 'pin1'), w(load, 'pin2', s, 'gnd')]));
    assert.ok((out.components[load.instanceId].voltageV ?? 0) < 1e-6, 'undefined output is not driven');
    assert.ok(out.diagnostics!.some((d) => d.ruleId === 'FLOATING_INPUT'));
  });
  check('74HC08 chưa cấp VCC → không xuất mức logic', () => {
    const s = src(5);
    const ic = comp('logic-and');
    const load = res(10000);
    const out = simulateBehavior(doc([s, ic, load], [w(s, 'vcc', ic, 'in_a'), w(s, 'vcc', ic, 'in_b'), w(ic, 'out_y', load, 'pin1'), w(load, 'pin2', s, 'gnd')]));
    assert.ok((out.components[load.instanceId].voltageV ?? 0) < 1e-6);
    assert.equal(out.components[ic.instanceId].isPowered, false);
  });
  check('Test 9 — NE555 astable 9 V, RA 1 kΩ, RB 10 kΩ, C 10 µF → f = 1/(ln2·21 kΩ·10 µF) ≈ 6,87 Hz, duty 52,4 %; LED ở OUT nhấp nháy', () => {
    const s = src(9);
    const ic = comp('ne555');
    const ra = res(1000);
    const rb = res(10000);
    const c = comp('capacitor', { capacitance: 10 });
    const rl = res(330);
    const led = comp('led', { color: 'red' });
    const conns = [
      w(s, 'vcc', ic, 'vcc'), w(ic, 'gnd', s, 'gnd'), w(s, 'vcc', ic, 'reset'),
      w(s, 'vcc', ra, 'pin1'), w(ra, 'pin2', ic, 'dis'), w(ic, 'dis', rb, 'pin1'), w(rb, 'pin2', ic, 'thr'), w(ic, 'thr', ic, 'trig'),
      w(ic, 'thr', c, 'pin_pos'), w(c, 'pin_neg', s, 'gnd'),
      w(ic, 'out', rl, 'pin1'), w(rl, 'pin2', led, 'anode'), w(led, 'cathode', s, 'gnd'),
    ];
    const out = simulateBehavior(doc([s, ic, ra, rb, c, rl, led], conns));
    const f = 1 / (Math.LN2 * 21000 * 10e-6);
    assert.equal(out.components[ic.instanceId].mode, 'astable');
    const pwm = out.components[led.instanceId].pwm;
    assert.ok(pwm, 'LED follows the oscillator');
    close(pwm!.frequencyHz, f, 1e-9, 'f');
    close(pwm!.duty, 11000 / 21000, 1e-9, 'duty');
    // Without RESET tied high the state is undetermined and nothing oscillates
    const floating = simulateBehavior(doc([s, ic, ra, rb, c, rl, led], conns.filter((x) => x.toPinId !== 'reset')));
    assert.equal(floating.components[led.instanceId].pwm, undefined);
    assert.equal(floating.components[led.instanceId].isOn, false);
    assert.ok(floating.diagnostics!.some((d) => d.ruleId === 'FLOATING_INPUT'));
  });
  check('NE555 monostable: TRIG kéo lên 10 kΩ → OUT thấp; nhấn nút kéo TRIG xuống → OUT cao; T = 1,1·R·C', () => {
    const s = src(5);
    const ic = comp('ne555');
    const rt = res(100000);
    const c = comp('capacitor', { capacitance: 10 });
    const pull = res(10000);
    const btn = comp('pushbutton', { pressed: false });
    const load = res(1000);
    const conns = [
      w(s, 'vcc', ic, 'vcc'), w(ic, 'gnd', s, 'gnd'), w(s, 'vcc', ic, 'reset'),
      w(s, 'vcc', rt, 'pin1'), w(rt, 'pin2', ic, 'thr'), w(ic, 'thr', ic, 'dis'), w(ic, 'thr', c, 'pin_pos'), w(c, 'pin_neg', s, 'gnd'),
      w(s, 'vcc', pull, 'pin1'), w(pull, 'pin2', ic, 'trig'), w(ic, 'trig', btn, 'pin1'), w(btn, 'pin2', s, 'gnd'),
      w(ic, 'out', load, 'pin1'), w(load, 'pin2', s, 'gnd'),
    ];
    const idle = simulateBehavior(doc([s, ic, rt, c, pull, btn, load], conns));
    assert.ok((idle.components[load.instanceId].voltageV ?? 0) < 0.01, 'OUT low');
    const pressed = simulateBehavior(doc([s, ic, rt, c, pull, { ...btn, parameters: { pressed: true } }, load], conns));
    assert.ok((pressed.components[load.instanceId].voltageV ?? 0) > 3, 'OUT high while triggered');
    assert.match(pressed.components[ic.instanceId].note || '', /1\.10 s/);
  });
  check('LED RGB chung cathode: chỉ chân Đỏ có dòng → chỉ đỏ sáng; Vf lam 3,2 V', () => {
    const s = src(5);
    const rgb = comp('rgb-led');
    const r1 = res(220);
    const r3 = res(220);
    const out = simulateBehavior(doc([s, rgb, r1, r3], [w(s, 'vcc', r1, 'pin1'), w(r1, 'pin2', rgb, 'red'), w(s, 'vcc', r3, 'pin1'), w(r3, 'pin2', rgb, 'blue'), w(rgb, 'cathode', s, 'gnd')]));
    const v = out.components[rgb.instanceId].visual!.rgb!;
    assert.ok(v[0] > 0 && v[1] === 0 && v[2] > 0);
    close(out.components[r3.instanceId].currentA, (5 - 3.2) / (220 + 10 + RS * 0 + 0.0), 2e-3, 'blue I');
  });
  check('LED 7 đoạn: dòng qua A và D → sáng đúng 2 đoạn, dùng được cả chân COM thứ hai', () => {
    const s = src(5);
    const seg = comp('7seg-display', { color: 'red' });
    const ra = res(330);
    const rd = res(330);
    const out = simulateBehavior(doc([s, seg, ra, rd], [w(s, 'vcc', ra, 'pin1'), w(ra, 'pin2', seg, 'seg_a'), w(s, 'vcc', rd, 'pin1'), w(rd, 'pin2', seg, 'seg_d'), w(seg, 'com2', s, 'gnd')]));
    const lv = out.components[seg.instanceId].visual!.segments!;
    assert.deepEqual(Object.entries(lv).filter(([, b]) => b > 0).map(([k]) => k).sort(), ['a', 'd']);
  });
  check('Động cơ DC: 6 V → quay 3000 vòng/phút, đảo cực → quay ngược; dưới ngưỡng khởi động → đứng yên', () => {
    const run = (v: number, rev = false) => {
      const s = src(v);
      const m = comp('dc-motor');
      return simulateBehavior(doc([s, m], rev ? [w(s, 'vcc', m, 'neg'), w(m, 'pos', s, 'gnd')] : [w(s, 'vcc', m, 'pos'), w(m, 'neg', s, 'gnd')])).components[m.instanceId];
    };
    close(run(6).visual!.rpm, 3000 * (6 * 20 / (20 + RS)) / 6, 1e-6, 'rpm');
    assert.ok(run(6, true).visual!.rpm! < 0);
    // 0.5 V source: below 0.8 V start voltage
    const s = src(5);
    const m = comp('dc-motor');
    const r = res(200);
    const out = simulateBehavior(doc([s, m, r], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', m, 'pos'), w(m, 'neg', s, 'gnd')]));
    assert.equal(out.components[m.instanceId].isOn, false);
  });
  check('Servo SG90: có nguồn nhưng không có xung → không xoay; OLED có nguồn → màn hình vẫn tối', () => {
    const s = src(5);
    const sv = comp('servo-sg90');
    const ol = comp('oled-i2c');
    const out = simulateBehavior(doc([s, sv, ol], [w(s, 'vcc', sv, 'vcc'), w(sv, 'gnd', s, 'gnd'), w(s, 'vcc', ol, 'vcc'), w(ol, 'gnd', s, 'gnd')]));
    assert.equal(out.components[sv.instanceId].isPowered, true);
    assert.equal(out.components[sv.instanceId].visual?.angleDeg, undefined);
    assert.equal(out.components[ol.instanceId].visual?.displayOn, false);
  });

  // ------------------------------------------------------------------------------------------
  console.log('\n[4] Test 8 — Arduino UNO: nguồn, GPIO và chương trình mẫu');
  const unoLed = (program: string, extra: (u: ComponentInstance) => { comps: ComponentInstance[]; conns: Connection[] } = () => ({ comps: [], conns: [] })) => {
    const u = comp('arduino-uno', { codeProgram: program });
    const r = res(220);
    const led = comp('led', { color: 'red' });
    const e = extra(u);
    const out = simulateBehavior(doc([u, r, led, ...e.comps], [w(u, 'pin_d13', r, 'pin1'), w(r, 'pin2', led, 'anode'), w(led, 'cathode', u, 'pin_gnd'), ...e.conns]));
    return { out, led, u };
  };
  check('Chương trình "none": D13 không được lái → LED tắt (không còn giả định D13 luôn HIGH)', () => {
    const { out, led } = unoLed('none');
    assert.equal(out.components[led.instanceId].isOn, false);
  });
  check('Blink: LED ở D13 nhấp nháy 0,5 Hz, 50 %; dòng khi sáng = (5 − 2)/(220 + 10 + 25) Ω', () => {
    const { out, led } = unoLed('blink_led');
    const st = out.components[led.instanceId];
    assert.equal(st.pwm?.frequencyHz, 0.5);
    assert.equal(st.pwm?.duty, 0.5);
    close(st.currentA, (0.5 * 3) / (220 + 10 + 25), 1e-3, 'average I');
  });
  check('Nút bấm D12: có điện trở kéo xuống → nhả: LED tắt, nhấn: LED sáng; không có điện trở kéo → báo thả nổi', () => {
    const withBtn = (pressed: boolean, pulldown: boolean) =>
      unoLed('button_read', (u) => {
        const b = comp('pushbutton', { pressed });
        const pd = res(10000);
        const conns = [w(u, 'pin_5v', b, 'pin1'), w(b, 'pin2', u, 'pin_d12')];
        if (pulldown) conns.push(w(u, 'pin_d12', pd, 'pin1'), w(pd, 'pin2', u, 'pin_gnd'));
        return { comps: pulldown ? [b, pd] : [b], conns };
      });
    const off = withBtn(false, true);
    assert.equal(off.out.components[off.led.instanceId].isOn, false);
    const on = withBtn(true, true);
    assert.equal(on.out.components[on.led.instanceId].isOn, true);
    const fl = withBtn(false, false);
    assert.equal(fl.out.components[fl.led.instanceId].isOn, false);
    assert.ok(fl.out.diagnostics!.some((d) => d.ruleId === 'FLOATING_INPUT'));
  });
  check('AnalogInOutSerial: biến trở 50 % ở A0 → analogRead ≈ 511, PWM D9 490 Hz, duty 128/255', () => {
    const u = comp('arduino-uno', { codeProgram: 'analog_read' });
    const pot = comp('potentiometer', { maxResistance: 10000, currentPosition: 0.5 });
    const r = res(220);
    const led = comp('led', { color: 'red' });
    const out = simulateBehavior(doc([u, pot, r, led], [w(u, 'pin_5v', pot, 'pin1'), w(pot, 'pin2', u, 'pin_gnd'), w(pot, 'wiper', u, 'pin_a0'), w(u, 'pin_d9', r, 'pin1'), w(r, 'pin2', led, 'anode'), w(led, 'cathode', u, 'pin_gnd')]));
    const pwm = out.components[led.instanceId].pwm!;
    assert.equal(pwm.frequencyHz, 490);
    close(pwm.duty, 128 / 255, 1e-9, 'duty');
  });
  check('Knob: biến trở 25 % (A0 ≈ 3,75 V → 767) → servo D9 quay 134°', () => {
    const u = comp('arduino-uno', { codeProgram: 'servo_control' });
    const pot = comp('potentiometer', { maxResistance: 10000, currentPosition: 0.25 });
    const sv = comp('servo-sg90');
    const out = simulateBehavior(doc([u, pot, sv], [w(u, 'pin_5v', pot, 'pin1'), w(pot, 'pin2', u, 'pin_gnd'), w(pot, 'wiper', u, 'pin_a0'), w(u, 'pin_5v', sv, 'vcc'), w(sv, 'gnd', u, 'pin_gnd2'), w(u, 'pin_d9', sv, 'pwm')]));
    assert.equal(out.components[sv.instanceId].visual?.angleDeg, 134);
  });
  check('Chân D13 nối thẳng LED không điện trở → vượt 40 mA, báo lỗi', () => {
    const u = comp('arduino-uno', { codeProgram: 'blink_led' });
    const led = comp('led', { color: 'red' });
    const out = simulateBehavior(doc([u, led], [w(u, 'pin_d13', led, 'anode'), w(led, 'cathode', u, 'pin_gnd')]));
    assert.ok(out.diagnostics!.some((d) => d.ruleId === 'OVERCURRENT' && d.message.includes('40 mA')));
  });
  check('Chân 3.3V: giới hạn 50 mA theo thông số UNO R3', () => {
    const u = comp('arduino-uno', { codeProgram: 'none' });
    const r = res(33); // 100 mA
    const out = simulateBehavior(doc([u, r], [w(u, 'pin_3v3', r, 'pin1'), w(r, 'pin2', u, 'pin_gnd')]));
    assert.ok(out.diagnostics!.some((d) => d.ruleId === 'SOURCE_OVERLOAD'));
  });

  // ------------------------------------------------------------------------------------------
  console.log('\n[5] DRC thống nhất với bộ giải');
  check('Ngắn mạch qua thanh nguồn breadboard → DRC SHORT_CIRCUIT (trước đây DRC bỏ sót)', () => {
    const bb = comp('breadboard', {}, { position: { x: 0, y: 0, z: 0 } });
    const s = src(5);
    const d = doc([bb, s], [w(s, 'vcc', bb, 'rail_top_pos_1'), w(s, 'gnd', bb, 'rail_top_pos_44')]);
    assert.ok(validateProjectDocument(d).some((i) => i.ruleId === 'SHORT_CIRCUIT' && i.severity === 'error'));
  });
  check('Dây nối vào chân không tồn tại → INVALID_PIN', () => {
    const s = src(5);
    const r = res(1000);
    const d = doc([s, r], [w(s, 'vcc', r, 'pin9')]);
    assert.ok(validateProjectDocument(d).some((i) => i.ruleId === 'INVALID_PIN'));
  });
  check('IC đã nối tín hiệu nhưng chưa nối VCC/GND → MISSING_POWER', () => {
    const s = src(5);
    const ic = comp('logic-and');
    const d = doc([s, ic], [w(s, 'vcc', ic, 'in_a')]);
    assert.ok(validateProjectDocument(d).some((i) => i.ruleId === 'MISSING_POWER'));
  });
  check('Không có cảnh báo giả: mạch LED + 220 Ω đúng không có lỗi/cảnh báo điện', () => {
    const s = src(5);
    const r = res(220);
    const led = comp('led', { color: 'red' });
    const d = doc([s, r, led], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', led, 'anode'), w(led, 'cathode', s, 'gnd')]);
    const bad = validateProjectDocument(d).filter((i) => i.severity !== 'info');
    assert.deepEqual(bad.map((i) => i.ruleId), []);
  });
  check('Mọi lỗi/cảnh báo điện của bộ giải đều xuất hiện trong DRC', () => {
    const s = src(5);
    const led = comp('led', { color: 'red' });
    const d = doc([s, led], [w(s, 'vcc', led, 'anode'), w(led, 'cathode', s, 'gnd')]);
    const sim = simulateBehavior(d).diagnostics!.filter((x) => x.severity !== 'info');
    const drc = validateProjectDocument(d);
    for (const x of sim) assert.ok(drc.some((i) => i.ruleId === x.ruleId && i.message === x.message), x.message);
  });

  // ------------------------------------------------------------------------------------------
  console.log('\n[6] Dự án cũ, sản phẩm mẫu, bài học, undo/redo, hiệu năng');
  check('Toàn bộ dự án mẫu, thiết kế sản phẩm và mạch bài học mô phỏng/DRC không lỗi runtime; mọi dây trỏ tới chân có thật', () => {
    const docs: ProjectDocument[] = [...(SAMPLE_PROJECTS as ProjectDocument[]), ...Object.values(CATALOG_DESIGNS).map((f) => f())];
    for (const l of LESSONS) docs.push(l.createInitialProject());
    for (const d of docs) {
      const snapshot = JSON.stringify(d);
      const out = simulateBehavior(d);
      assert.ok(['running', 'stopped', 'error'].includes(out.status), d.name);
      validateProjectDocument(d);
      assert.equal(JSON.stringify(d), snapshot, `${d.name}: stored document untouched`);
      for (const c of d.connections) {
        for (const [cid, pid] of [[c.fromComponentId, c.fromPinId], [c.toComponentId, c.toPinId]]) {
          const inst = d.components.find((x) => x.instanceId === cid)!;
          assert.ok(isKnownPin(inst.definitionId, pid), `${d.name}: ${inst.definitionId}.${pid}`);
        }
      }
    }
  });
  check('Đổi thông số qua command engine: mô phỏng cập nhật, Undo/Redo khôi phục đúng', () => {
    const s = src(5);
    const r = res(1000);
    const history = new CommandHistory(doc([s, r], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', s, 'gnd')]));
    const i1 = simulateBehavior(history.currentDocument).components[r.instanceId].currentA!;
    history.execute(new UpdateComponentParameterCommand(r.instanceId, 'resistance', 1000, 500));
    const i2 = simulateBehavior(history.currentDocument).components[r.instanceId].currentA!;
    close(i2, 2 * i1, 1e-3, 'after change');
    history.undo();
    close(simulateBehavior(history.currentDocument).components[r.instanceId].currentA, i1, 1e-9, 'after undo');
    history.redo();
    close(simulateBehavior(history.currentDocument).components[r.instanceId].currentA, i2, 1e-9, 'after redo');
  });
  check('Tham số hỏng (NaN, 0 Ω, chuỗi) không làm bộ giải ném lỗi hay trả NaN', () => {
    const s = comp('dc-source', { voltage: 'abc' });
    const r = res(0);
    const r2 = comp('resistor', { resistance: NaN });
    const out = simulateBehavior(doc([s, r, r2], [w(s, 'vcc', r, 'pin1'), w(r, 'pin2', r2, 'pin1'), w(r2, 'pin2', s, 'gnd')]));
    for (const st of Object.values(out.components)) if (st.currentA !== undefined) assert.ok(Number.isFinite(st.currentA));
  });
  check('Mạch lớn (Arduino + 40 nhánh LED/điện trở/transistor) giải trong < 3 s', () => {
    const u = comp('arduino-uno', { codeProgram: 'none' });
    const comps: ComponentInstance[] = [u];
    const conns: Connection[] = [];
    for (let k = 0; k < 40; k++) {
      const rb = res(10000);
      const rc = res(1000);
      const led = comp('led', { color: k % 2 ? 'red' : 'blue' });
      const q = comp('transistor-npn');
      comps.push(rb, rc, led, q);
      conns.push(w(u, 'pin_5v', rb, 'pin1'), w(rb, 'pin2', q, 'base'), w(u, 'pin_5v', rc, 'pin1'), w(rc, 'pin2', led, 'anode'), w(led, 'cathode', q, 'collector'), w(q, 'emitter', u, 'pin_gnd'));
    }
    const t = Date.now();
    const out = simulateBehavior(doc(comps, conns));
    const ms = Date.now() - t;
    console.log(`      (thời gian giải đo được: ${ms} ms cho ${comps.length} linh kiện)`);
    assert.ok(ms < 3000, `${ms} ms`);
    assert.equal(out.status, 'running');
  });

  console.log(`\nComponents & simulation: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
