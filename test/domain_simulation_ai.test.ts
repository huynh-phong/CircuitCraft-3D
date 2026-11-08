/**
 * Domain tests: DC solver (reference values), legacy component compatibility,
 * DRC/simulation consistency, AI proposal validation, AI request contract, Undo/Redo.
 * Run with: npx tsx test/domain_simulation_ai.test.ts
 */
import assert from 'node:assert/strict';
import { simulateBehavior, SIM_CONSTANTS } from '../src/domain/simulation/engine.ts';
import { validateProjectDocument } from '../src/domain/validation/engine.ts';
import { validateAIProposal } from '../src/domain/ai/proposalValidation.ts';
import { resolveDefinitionId, resolvePinId, toCanonicalDocument } from '../src/domain/components/aliases.ts';
import { COMPONENT_DEFINITION_MAP } from '../src/domain/components/definitions.ts';
import { buildCircuitContext, normalizeChatRequest } from '../src/ai/circuitContext.ts';
import { CommandHistory } from '../src/domain/commands/history.ts';
import { AddComponentCommand, BatchCommand, CreateConnectionCommand } from '../src/domain/commands/commands.ts';
import { ComponentInstance, Connection, ProjectDocument } from '../src/domain/project/types.ts';
import { SAMPLE_PROJECTS } from '../src/persistence/sampleProjects.ts';

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

const RS = SIM_CONSTANTS.SOURCE_INTERNAL_RESISTANCE;
const close = (actual: number | undefined, expected: number, relTol = 1e-3, label = '') => {
  assert.ok(actual !== undefined && Number.isFinite(actual), `${label} value missing`);
  const err = Math.abs(actual! - expected) / Math.max(Math.abs(expected), 1e-9);
  assert.ok(err <= relTol, `${label} expected ≈ ${expected}, got ${actual} (rel err ${err.toExponential(2)})`);
};

let seq = 0;
function comp(definitionId: string, parameters: Record<string, any> = {}, extra: Partial<ComponentInstance> = {}): ComponentInstance {
  seq += 1;
  return {
    instanceId: extra.instanceId || `${definitionId}-${seq}`,
    definitionId,
    name: extra.name || `${definitionId.toUpperCase()}${seq}`,
    // spread out so DRC collision / breadboard auto-plug do not interfere
    position: extra.position || { x: (seq % 6) * 12 - 30, y: 0, z: Math.floor(seq / 6) * 12 - 20 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters,
    state: extra.state,
  };
}
function wire(a: ComponentInstance, ap: string, b: ComponentInstance, bp: string): Connection {
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
    board: { width: 200, depth: 200, thickness: 1.6, solderMaskColor: '#114a36', copperLayerCount: 2, gridSpacing: 2.54 },
    components,
    connections,
    wireRoutes: [],
    createdAt: now,
    updatedAt: now,
  };
}

console.log('\n[DC solver – reference circuits]');

check('Điện trở nối tiếp: 5V qua 1kΩ + 1kΩ → I = V/(R1+R2)', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r1 = comp('resistor', { resistance: 1000 });
  const r2 = comp('resistor', { resistance: 1000 });
  const res = simulateBehavior(doc([s, r1, r2], [wire(s, 'vcc', r1, 'pin1'), wire(r1, 'pin2', r2, 'pin1'), wire(r2, 'pin2', s, 'gnd')]));
  assert.equal(res.status, 'running');
  assert.equal(res.solver, 'mna-dc');
  const I = 5 / (2000 + RS);
  close(res.components[r1.instanceId].currentA, I, 1e-6, 'I(R1)');
  close(res.components[r2.instanceId].currentA, I, 1e-6, 'I(R2)');
  close(res.components[r1.instanceId].voltageV, I * 1000, 1e-6, 'V(R1)');
  close(res.components[s.instanceId].currentA, I, 1e-6, 'I(source)');
  close(5 / 2000, I, 1e-3, 'textbook value 2.5 mA');
});

check('Điện trở song song: 5V // 1kΩ, 1kΩ → mỗi nhánh V/R, tổng = 2·V/R (KCL)', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r1 = comp('resistor', { resistance: 1000 });
  const r2 = comp('resistor', { resistance: 1000 });
  const res = simulateBehavior(
    doc([s, r1, r2], [wire(s, 'vcc', r1, 'pin1'), wire(s, 'vcc', r2, 'pin1'), wire(r1, 'pin2', s, 'gnd'), wire(r2, 'pin2', s, 'gnd')])
  );
  const Itotal = 5 / (500 + RS);
  close(res.components[s.instanceId].currentA, Itotal, 1e-6, 'I total');
  close(res.components[r1.instanceId].currentA, Itotal / 2, 1e-6, 'I(R1)');
  close((res.components[r1.instanceId].currentA || 0) + (res.components[r2.instanceId].currentA || 0), Itotal, 1e-9, 'KCL');
});

check('Mạch chia áp: 1kΩ / 2kΩ → V_out = V·R2/(R1+R2) ≈ 3.333V', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r1 = comp('resistor', { resistance: 1000 });
  const r2 = comp('resistor', { resistance: 2000 });
  const res = simulateBehavior(doc([s, r1, r2], [wire(s, 'vcc', r1, 'pin1'), wire(r1, 'pin2', r2, 'pin1'), wire(r2, 'pin2', s, 'gnd')]));
  close(res.components[r2.instanceId].voltageV, (5 * 2000) / 3000, 1e-4, 'Vout');
  // KVL: sum of drops = source emf minus internal drop
  const sum = (res.components[r1.instanceId].voltageV || 0) + (res.components[r2.instanceId].voltageV || 0);
  close(sum, 5 - RS * (5 / (3000 + RS)), 1e-9, 'KVL');
});

check('Mạch chia dòng: 1kΩ // 3kΩ → I1 = 3·I2', () => {
  const s = comp('dc-source', { voltage: 6 });
  const r1 = comp('resistor', { resistance: 1000 });
  const r2 = comp('resistor', { resistance: 3000 });
  const res = simulateBehavior(
    doc([s, r1, r2], [wire(s, 'vcc', r1, 'pin1'), wire(s, 'vcc', r2, 'pin1'), wire(r1, 'pin2', s, 'gnd'), wire(r2, 'pin2', s, 'gnd')])
  );
  const i1 = res.components[r1.instanceId].currentA!;
  const i2 = res.components[r2.instanceId].currentA!;
  close(i1 / i2, 3, 1e-9, 'ratio');
  close(i1, 6 / 1000, 1e-3, 'I1 ≈ 6 mA');
});

check('Biến trở 10kΩ ở 50% → điện áp con trượt = V/2', () => {
  const s = comp('dc-source', { voltage: 5 });
  const pot = comp('potentiometer', { maxResistance: 10000, currentPosition: 0.5 });
  const res = simulateBehavior(doc([s, pot], [wire(s, 'vcc', pot, 'pin1'), wire(pot, 'pin2', s, 'gnd')]));
  assert.equal(res.status, 'running');
  const node = Object.entries(res.nodeVoltages || {}).find(([k]) => k.startsWith(`${pot.instanceId}:wiper`));
  close(node?.[1], 2.5, 1e-3, 'V(wiper)');
});

check('Mạch hở: điện trở chỉ nối VCC → không có dòng, trạng thái stopped', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r = comp('resistor', { resistance: 220 });
  const res = simulateBehavior(doc([s, r], [wire(s, 'vcc', r, 'pin1')]));
  assert.equal(res.status, 'stopped');
  assert.equal(res.isClosedLoop, false);
  assert.ok((res.components[r.instanceId].currentA || 0) < 1e-9);
});

check('Công tắc mở → hở mạch; đóng → mạch kín', () => {
  const s = comp('dc-source', { voltage: 5 });
  const sw = comp('switch');
  const r = comp('resistor', { resistance: 1000 });
  const conns = [wire(s, 'vcc', sw, 'pin1'), wire(sw, 'pin2', r, 'pin1'), wire(r, 'pin2', s, 'gnd')];
  const open = simulateBehavior(doc([s, sw, r], conns), { [sw.instanceId]: false });
  assert.equal(open.status, 'stopped');
  const closed = simulateBehavior(doc([s, sw, r], conns), { [sw.instanceId]: true });
  assert.equal(closed.status, 'running');
  close(closed.components[r.instanceId].currentA, 5 / (1000 + RS + SIM_CONSTANTS.CONTACT_RESISTANCE), 1e-6, 'I');
});

check('Ngắn mạch trực tiếp (dây VCC–GND) → error, DRC cũng báo SHORT_CIRCUIT', () => {
  const s = comp('dc-source', { voltage: 5 });
  const d = doc([s], [wire(s, 'vcc', s, 'gnd')]);
  const res = simulateBehavior(d);
  assert.equal(res.status, 'error');
  assert.ok(res.issues.some((i) => i.toLowerCase().includes('đoản mạch')), 'issue text matched by App warning logic');
  assert.ok(validateProjectDocument(d).some((i) => i.ruleId === 'SHORT_CIRCUIT'));
});

check('Ngắn mạch qua công tắc đóng (không có tải) → phát hiện theo dòng điện', () => {
  const s = comp('dc-source', { voltage: 5, maxCurrent: 1000 });
  const sw = comp('switch');
  const res = simulateBehavior(doc([s, sw], [wire(s, 'vcc', sw, 'pin1'), wire(sw, 'pin2', s, 'gnd')]), { [sw.instanceId]: true });
  assert.equal(res.status, 'error');
  assert.ok(res.issues.some((i) => i.toLowerCase().includes('đoản mạch')));
});

check('LED đỏ + 220Ω: I = (V − Vf)/(R + Rs), LED sáng', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r = comp('resistor', { resistance: 220 });
  const led = comp('led', { color: 'red', forwardVoltage: 2.0, maxCurrent: 20 });
  const d = doc([s, r, led], [wire(s, 'vcc', r, 'pin1'), wire(r, 'pin2', led, 'anode'), wire(led, 'cathode', s, 'gnd')]);
  const res = simulateBehavior(d);
  const expected = (5 - 2.0) / (220 + SIM_CONSTANTS.LED_SERIES_RESISTANCE + RS);
  assert.equal(res.status, 'running');
  assert.equal(res.components[led.instanceId].isOn, true);
  close(res.components[led.instanceId].currentA, expected, 1e-6, 'I(LED)');
  assert.ok(!res.issues.some((i) => i.includes('vượt dòng')), 'within rating');
  assert.ok(!validateProjectDocument(d).some((i) => i.ruleId === 'LED_OVERCURRENT_RISK'), 'DRC agrees: resistor present');
});

check('LED không có điện trở → quá dòng; DRC và mô phỏng cùng cảnh báo', () => {
  const s = comp('dc-source', { voltage: 5 });
  const led = comp('led', { color: 'red', forwardVoltage: 2.0, maxCurrent: 20 });
  const d = doc([s, led], [wire(s, 'vcc', led, 'anode'), wire(led, 'cathode', s, 'gnd')]);
  const res = simulateBehavior(d);
  assert.ok((res.components[led.instanceId].currentA || 0) > 0.02);
  assert.ok(res.issues.some((i) => i.includes('vượt dòng định mức')));
  assert.ok(validateProjectDocument(d).some((i) => i.ruleId === 'LED_OVERCURRENT_RISK'));
});

check('LED mắc ngược → không sáng, không có dòng; DRC báo REVERSE_POLARITY', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r = comp('resistor', { resistance: 220 });
  const led = comp('led', { color: 'red' });
  const d = doc([s, r, led], [wire(s, 'vcc', r, 'pin1'), wire(r, 'pin2', led, 'cathode'), wire(led, 'anode', s, 'gnd')]);
  const res = simulateBehavior(d);
  assert.equal(res.components[led.instanceId].isOn, false);
  assert.match(res.components[led.instanceId].stateLabel, /ngược/i);
  assert.equal(res.status, 'stopped');
  assert.ok(validateProjectDocument(d).some((i) => i.ruleId === 'REVERSE_POLARITY'));
});

check('Tụ điện ở DC xác lập: không có dòng, điện áp tụ ≈ nguồn', () => {
  const s = comp('dc-source', { voltage: 5 });
  const r = comp('resistor', { resistance: 1000 });
  const c = comp('capacitor', { capacitance: 100 });
  const res = simulateBehavior(doc([s, r, c], [wire(s, 'vcc', r, 'pin1'), wire(r, 'pin2', c, 'pin_pos'), wire(c, 'pin_neg', s, 'gnd')]));
  assert.equal(res.status, 'stopped', 'no DC loop through a capacitor');
  assert.ok((res.components[r.instanceId].currentA || 0) < 1e-6);
  close(res.components[c.instanceId].voltageV, 5, 1e-4, 'V(C)');
});

check('Không có nguồn → stopped với thông báo rõ ràng', () => {
  const r = comp('resistor', { resistance: 220 });
  const res = simulateBehavior(doc([r], []));
  assert.equal(res.status, 'stopped');
  assert.match(res.summary, /Chưa có nguồn/);
});

check('Hai nguồn 5V song song vẫn giải được (không suy biến)', () => {
  const s1 = comp('dc-source', { voltage: 5 });
  const s2 = comp('dc-source', { voltage: 5 });
  const r = comp('resistor', { resistance: 1000 });
  const res = simulateBehavior(
    doc([s1, s2, r], [wire(s1, 'vcc', s2, 'vcc'), wire(s1, 'gnd', s2, 'gnd'), wire(s1, 'vcc', r, 'pin1'), wire(r, 'pin2', s1, 'gnd')])
  );
  assert.equal(res.status, 'running');
  close(res.components[r.instanceId].currentA, 5 / (1000 + RS / 2), 1e-6, 'I');
});

check('Linh kiện chưa có mô hình điện được đánh dấu, không có số liệu giả', () => {
  const s = comp('dc-source', { voltage: 5 });
  // Every registered part now has a model (see capabilities.ts); an unregistered one stays unsupported
  const unknown = comp('pin-header');
  const servo = comp('servo-motor');
  const r = comp('resistor', { resistance: 1000 });
  const res = simulateBehavior(doc([s, unknown, servo, r], [wire(s, 'vcc', r, 'pin1'), wire(r, 'pin2', s, 'gnd')]));
  assert.ok(res.unsupportedComponents?.includes(unknown.instanceId));
  assert.equal(res.components[unknown.instanceId].stateLabel, 'Chưa hỗ trợ mô phỏng điện');
  assert.equal(res.components[unknown.instanceId].currentA, undefined);
  // An unwired servo gets no invented angle or current
  assert.equal(res.components[servo.instanceId].visual?.angleDeg, undefined);
  assert.equal(res.components[servo.instanceId].currentA, undefined);
  assert.equal(res.status, 'running');
});

check('Không còn trạng thái giả kiểu "ARDUINO CHẠY CHƯƠNG TRÌNH / NE555 DAO ĐỘNG"', () => {
  const s = comp('dc-source', { voltage: 5 });
  const ic = comp('ne555');
  const res = simulateBehavior(doc([s, ic], [wire(s, 'vcc', ic, 'vcc'), wire(ic, 'gnd', s, 'gnd')]));
  assert.ok(!JSON.stringify(res).includes('DAO ĐỘNG XUNG VUÔNG'));
  // Only VCC/GND wired: RESET floats and there is no RC network, so the 555 must not oscillate
  assert.match(res.components[ic.instanceId].stateLabel, /KHÔNG XÁC ĐỊNH/);
  assert.notEqual(res.components[ic.instanceId].mode, 'astable');
});

check('Arduino 5V → 220Ω → LED → GND: LED sáng, ghi chú rõ giới hạn (không chạy sketch)', () => {
  const uno = comp('arduino-uno');
  const r = comp('resistor', { resistance: 220 });
  const led = comp('led', { color: 'red' });
  const res = simulateBehavior(doc([uno, r, led], [wire(uno, 'pin_5v', r, 'pin1'), wire(r, 'pin2', led, 'anode'), wire(led, 'cathode', uno, 'pin_gnd2')]));
  assert.equal(res.components[led.instanceId].isOn, true);
  assert.match(res.components[uno.instanceId].note || '', /sketch/);
});

console.log('\n[Legacy component IDs – backward compatibility]');

check('Bản đồ ID cũ → ID chuẩn', () => {
  assert.equal(resolveDefinitionId('dc_power_supply'), 'dc-source');
  assert.equal(resolveDefinitionId('dc_source'), 'dc-source');
  assert.equal(resolveDefinitionId('switch_spst'), 'switch');
  assert.equal(resolveDefinitionId('resistor_axial'), 'resistor');
  assert.equal(resolveDefinitionId('led_basic'), 'led');
  assert.equal(resolvePinId('dc_power_supply', 'pin_pos'), 'vcc');
  assert.equal(resolvePinId('resistor', 'p1'), 'pin1');
  assert.equal(resolvePinId('terminal_block_2pin', 'pin_2'), 'gnd');
  assert.equal(resolvePinId('led', 'pin_anode'), 'anode');
});

check('Mạch dùng ID cũ cho kết quả giống hệt mạch ID chuẩn, tài liệu gốc không bị sửa', () => {
  const sl = comp('terminal_block_2pin', { voltage: 5 }, { instanceId: 'leg-src' });
  const rl = comp('resistor_axial', { resistance: 220 }, { instanceId: 'leg-r' });
  const ll = comp('led_basic', { color: 'red' }, { instanceId: 'leg-led' });
  const legacy = doc([sl, rl, ll], [wire(sl, 'pin_1', rl, 'pin_1'), wire(rl, 'pin_2', ll, 'anode'), wire(ll, 'cathode', sl, 'pin_2')]);
  const snapshot = JSON.stringify(legacy);
  const res = simulateBehavior(legacy);
  assert.equal(JSON.stringify(legacy), snapshot, 'stored document untouched');
  assert.equal(res.components['leg-led'].isOn, true);
  close(res.components['leg-led'].currentA, (5 - 2) / (220 + SIM_CONSTANTS.LED_SERIES_RESISTANCE + RS), 1e-6, 'I');
  const canon = toCanonicalDocument(legacy);
  assert.deepEqual(canon.components.map((c) => c.instanceId), ['leg-src', 'leg-r', 'leg-led'], 'ids preserved');
  assert.deepEqual(canon.components.map((c) => c.position), legacy.components.map((c) => c.position), 'coordinates preserved');
  assert.equal(canon.connections.length, legacy.connections.length, 'no wire lost');
});

check('Mọi định nghĩa linh kiện cũ vẫn được đăng ký để dựng 3D', () => {
  for (const id of ['terminal_block_2pin', 'resistor_axial', 'led_basic', 'arduino_uno']) {
    assert.ok(COMPONENT_DEFINITION_MAP.has(id), id);
  }
});

check('Toàn bộ dự án mẫu mô phỏng được không lỗi runtime', () => {
  for (const p of SAMPLE_PROJECTS as ProjectDocument[]) {
    const res = simulateBehavior(p);
    assert.ok(['running', 'stopped', 'error'].includes(res.status), p.name);
    validateProjectDocument(p);
  }
});

console.log('\n[AI proposal validation]');

const base = (() => {
  const s = comp('dc-source', { voltage: 5 }, { instanceId: 'src-existing' });
  return doc([s], []);
})();

check('Đề xuất hợp lệ được chuẩn hóa (ID cũ → chuẩn, tham số mặc định)', () => {
  const r = validateAIProposal(
    {
      proposalId: 'p1',
      explanation: 'LED',
      baseRevision: 1,
      componentsToAdd: [
        { instanceId: 'a-r', definitionId: 'resistor', name: 'R', position: { x: 0, y: 0, z: 0 }, parameters: { resistance: 220 } },
        { instanceId: 'a-led', definitionId: 'led_basic', position: { x: 10, y: 0, z: 0 } },
      ],
      connectionsToAdd: [
        { fromComponentId: 'src-existing', fromPinId: 'pin_pos', toComponentId: 'a-r', toPinId: 'p1' },
        { fromComponentId: 'a-r', fromPinId: 'pin2', toComponentId: 'a-led', toPinId: 'anode' },
      ],
    },
    base
  );
  assert.equal(r.valid, true, r.errors.join('; '));
  assert.equal(r.proposal!.componentsToAdd[1].definitionId, 'led');
  assert.equal(r.proposal!.connectionsToAdd[0].fromPinId, 'vcc');
  assert.equal(r.proposal!.connectionsToAdd[0].toPinId, 'pin1');
  assert.equal(r.proposal!.componentsToAdd[1].parameters.color, 'red', 'defaults merged');
});

check('Từ chối linh kiện không tồn tại trong thư viện', () => {
  const r = validateAIProposal({ componentsToAdd: [{ instanceId: 'x', definitionId: 'flux-capacitor' }], connectionsToAdd: [] }, base);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /không có trong thư viện/);
});

check('Từ chối chân không tồn tại và tham chiếu linh kiện không tồn tại', () => {
  const r1 = validateAIProposal(
    { componentsToAdd: [{ instanceId: 'r', definitionId: 'resistor' }], connectionsToAdd: [{ fromComponentId: 'r', fromPinId: 'pin9', toComponentId: 'src-existing', toPinId: 'gnd' }] },
    base
  );
  assert.equal(r1.valid, false);
  assert.match(r1.errors.join(' '), /chân "pin9"/);
  const r2 = validateAIProposal(
    { componentsToAdd: [], connectionsToAdd: [{ fromComponentId: 'ghost', fromPinId: 'pin1', toComponentId: 'src-existing', toPinId: 'gnd' }] },
    base
  );
  assert.equal(r2.valid, false);
});

check('ID trùng với mạch hiện có được đổi tên và dây nối trỏ theo', () => {
  const r = validateAIProposal(
    {
      componentsToAdd: [{ instanceId: 'src-existing', definitionId: 'resistor' }],
      connectionsToAdd: [{ fromComponentId: 'src-existing', fromPinId: 'pin1', toComponentId: 'src-existing', toPinId: 'pin2' }],
    },
    base
  );
  // the connection refers to the NEW resistor (renamed) on both ends -> pin1 to pin2 of itself is allowed
  assert.equal(r.valid, true, r.errors.join('; '));
  assert.notEqual(r.proposal!.componentsToAdd[0].instanceId, 'src-existing');
  assert.ok(r.warnings.some((w) => w.includes('bị trùng')));
});

check('Dây nối trùng lặp bị loại; đề xuất rỗng bị từ chối', () => {
  const r = validateAIProposal(
    {
      componentsToAdd: [{ instanceId: 'r', definitionId: 'resistor' }],
      connectionsToAdd: [
        { fromComponentId: 'r', fromPinId: 'pin1', toComponentId: 'src-existing', toPinId: 'vcc' },
        { fromComponentId: 'src-existing', fromPinId: 'vcc', toComponentId: 'r', toPinId: 'pin1' },
      ],
    },
    base
  );
  assert.equal(r.proposal!.connectionsToAdd.length, 1);
  const empty = validateAIProposal({ componentsToAdd: [], connectionsToAdd: [] }, base);
  assert.equal(empty.valid, false);
  const garbage = validateAIProposal('rm -rf /', base);
  assert.equal(garbage.valid, false);
});

check('Áp dụng đề xuất = 1 bước Undo; Redo khôi phục; đề xuất lỗi không đổi mạch', () => {
  const v = validateAIProposal(
    {
      componentsToAdd: [
        { instanceId: 'n-r', definitionId: 'resistor' },
        { instanceId: 'n-led', definitionId: 'led' },
      ],
      connectionsToAdd: [{ fromComponentId: 'n-r', fromPinId: 'pin2', toComponentId: 'n-led', toPinId: 'anode' }],
    },
    base
  );
  const history = new CommandHistory(base);
  const cmds = [
    ...v.proposal!.componentsToAdd.map((c) => new AddComponentCommand(c)),
    ...v.proposal!.connectionsToAdd.map((c) => new CreateConnectionCommand(c)),
  ];
  const after = history.execute(new BatchCommand('AI', cmds));
  assert.equal(after.components.length, 3);
  assert.equal(after.connections.length, 1);
  const undone = history.undo()!;
  assert.equal(undone.components.length, 1);
  assert.equal(undone.connections.length, 0);
  const redone = history.redo()!;
  assert.equal(redone.components.length, 3);

  const failing = { id: 'x', description: 'boom', execute: () => { throw new Error('boom'); }, undo: (d: ProjectDocument) => d };
  const beforeFail = history.currentDocument;
  const res = history.execute(new BatchCommand('bad', [new AddComponentCommand(comp('resistor')), failing as any]));
  assert.equal(res, beforeFail, 'atomic: document unchanged when a sub-command throws');
});

console.log('\n[AI request contract]');

check('Client gửi đủ linh kiện, tham số, dây/chân, DRC, ngôn ngữ, ngữ cảnh bài lab', () => {
  const s = comp('dc-source', { voltage: 5 }, { instanceId: 'cs' });
  const r = comp('resistor_axial', { resistance: 330 }, { instanceId: 'cr' });
  const d = doc([s, r], [wire(s, 'vcc', r, 'pin_1')]);
  const ctx = buildCircuitContext({
    project: d,
    issues: [{ ruleId: 'UNCONNECTED_COMPONENT', severity: 'info', message: 'x' }],
    simulation: { status: 'stopped', summary: 'Mạch hở', issues: [] },
    practiceContext: {
      courseTitle: 'Khóa A',
      lessonTitle: 'Bài 1',
      shortDescription: 'Thắp LED',
      targetProject: d,
      practiceStages: [{ title: 'GĐ1', steps: ['a'] }],
    },
    locale: 'en',
  });
  assert.equal(ctx.locale, 'en');
  assert.equal(ctx.components.length, 2);
  assert.equal(ctx.components[1].definitionId, 'resistor', 'canonical id sent to AI');
  assert.equal(ctx.components[1].parameters.resistance, 330);
  assert.equal(ctx.connections[0].to, 'cr.pin1', 'canonical pin sent to AI');
  assert.equal(ctx.issues[0].ruleId, 'UNCONNECTED_COMPONENT');
  assert.equal(ctx.practiceContext!.lessonSummary, 'Thắp LED');
  assert.equal(ctx.practiceContext!.stages![0].stageNumber, 1);
  assert.equal(ctx.practiceContext!.targetComponents!.length, 2);
  assert.ok(!JSON.stringify(ctx).match(/token|password|email/i), 'no secrets');
});

check('Server chuẩn hóa được cả payload mới và payload cũ', () => {
  const s = comp('dc-source', {}, { instanceId: 'ls' });
  const legacyBody = { prompt: 'hi', project: doc([s], []), issues: [], practiceContext: null };
  const n1 = normalizeChatRequest(legacyBody);
  assert.equal(n1.context!.components.length, 1);
  const n2 = normalizeChatRequest({ prompt: 'x'.repeat(10000), history: Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })), context: buildCircuitContext({ project: doc([s], []) }) });
  assert.equal(n2.prompt.length, 4000);
  assert.equal(n2.history.length, 12);
  assert.equal(n2.context!.components.length, 1);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFAILURES:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('🎉 DOMAIN SIMULATION & AI TESTS PASSED');
