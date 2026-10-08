/**
 * CircuitCraft 3D - Domain Fixtures
 * Standard fixtures for testing and project initialization.
 * NO UI, NO Three.js dependencies.
 */

import { ProjectDocument } from '../types/circuit.ts';
import { COMPONENT_CATALOG } from './componentLibrary.ts';

/**
 * Creates a clean, empty ProjectDocument fixture.
 */
export function createEmptyProjectFixture(): ProjectDocument {
  return {
    schemaVersion: 1,
    revision: 1,
    id: 'proj_fixture_empty',
    name: 'Dự án rỗng mẫu',
    description: 'Fixture dự án rỗng không có linh kiện, cấu hình chuẩn bo mạch',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    board: {
      width: 180,
      depth: 120,
      thickness: 4,
      gridSize: 10,
      color: '#1e3a2f',
    },
    components: [],
    connections: [],
    metadata: {
      difficulty: 'beginner',
      tags: ['Empty', 'Fixture'],
    },
  };
}

/**
 * Creates a fully valid, closed-loop sample LED circuit fixture.
 * Circuit topology:
 * DC 5V (+) -> Switch S1 -> Resistor 220Ω -> LED (Anode) -> LED (Cathode) -> DC 5V (-)
 */
export function createSampleLedCircuitFixture(): ProjectDocument {
  return {
    schemaVersion: 1,
    revision: 1,
    id: 'proj_fixture_led_circuit',
    name: 'Mạch LED mẫu cơ bản',
    description: 'Mạch nguồn DC 5V có công tắc, điện trở hạn dòng 220Ω và LED đỏ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    board: {
      width: 180,
      depth: 120,
      thickness: 4,
      gridSize: 10,
      color: '#1e3a2f',
    },
    components: [
      {
        id: 'dc_1',
        type: 'dc_power_supply',
        name: 'V1',
        position: { x: -50, y: 0, z: -20 },
        rotation: 0,
        properties: {
          voltage: 5,
          label: 'Nguồn DC 5V',
        },
        pins: [
          {
            id: 'pin_pos',
            label: '+',
            type: 'power_pos',
            relativePosition: { x: -14, y: 6, z: 0 },
          },
          {
            id: 'pin_neg',
            label: '-',
            type: 'power_neg',
            relativePosition: { x: 14, y: 6, z: 0 },
          },
        ],
      },
      {
        id: 'sw_1',
        type: 'switch_spst',
        name: 'S1',
        position: { x: -10, y: 0, z: -20 },
        rotation: 0,
        properties: {
          isClosed: true,
          label: 'Công tắc S1',
        },
        pins: [
          {
            id: 'pin_1',
            label: '1',
            type: 'passive',
            relativePosition: { x: -14, y: 5, z: 0 },
          },
          {
            id: 'pin_2',
            label: '2',
            type: 'passive',
            relativePosition: { x: 14, y: 5, z: 0 },
          },
        ],
      },
      {
        id: 'res_1',
        type: 'resistor',
        name: 'R1',
        position: { x: 30, y: 0, z: -20 },
        rotation: 0,
        properties: {
          resistance: 220,
          label: '220 Ω',
        },
        pins: [
          {
            id: 'pin_1',
            label: '1',
            type: 'passive',
            relativePosition: { x: -18, y: 5, z: 0 },
          },
          {
            id: 'pin_2',
            label: '2',
            type: 'passive',
            relativePosition: { x: 18, y: 5, z: 0 },
          },
        ],
      },
      {
        id: 'led_1',
        type: 'led',
        name: 'LED1',
        position: { x: 30, y: 0, z: 20 },
        rotation: 0,
        properties: {
          forwardVoltage: 2.0,
          maxCurrent: 25,
          color: '#ef4444',
          label: 'LED Đỏ',
        },
        pins: [
          {
            id: 'pin_anode',
            label: '+ (A)',
            type: 'anode',
            relativePosition: { x: -8, y: 5, z: 0 },
          },
          {
            id: 'pin_cathode',
            label: '- (K)',
            type: 'cathode',
            relativePosition: { x: 8, y: 5, z: 0 },
          },
        ],
      },
    ],
    connections: [
      {
        id: 'wire_1',
        fromComponentId: 'dc_1',
        fromPinId: 'pin_pos',
        toComponentId: 'sw_1',
        toPinId: 'pin_1',
        color: '#ef4444',
      },
      {
        id: 'wire_2',
        fromComponentId: 'sw_1',
        fromPinId: 'pin_2',
        toComponentId: 'res_1',
        toPinId: 'pin_1',
        color: '#eab308',
      },
      {
        id: 'wire_3',
        fromComponentId: 'res_1',
        fromPinId: 'pin_2',
        toComponentId: 'led_1',
        toPinId: 'pin_anode',
        color: '#22c55e',
      },
      {
        id: 'wire_4',
        fromComponentId: 'led_1',
        fromPinId: 'pin_cathode',
        toComponentId: 'dc_1',
        toPinId: 'pin_neg',
        color: '#0f172a',
      },
    ],
    metadata: {
      difficulty: 'beginner',
      tags: ['DC', 'LED', 'Sample'],
    },
  };
}

export const emptyProjectFixture = createEmptyProjectFixture();
export const sampleLedCircuitFixture = createSampleLedCircuitFixture();
