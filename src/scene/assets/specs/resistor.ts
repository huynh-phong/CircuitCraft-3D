import type { AxialBand } from '../builders/axial';
import { buildAxial } from '../builders/axial';
import { Materials } from '../materials';
import { defineSpec } from './types';

/** IEC 60062 colour code. Index = digit. */
const DIGIT_HEX = [0x1c1917, 0x7a4a1e, 0xdc2626, 0xea580c, 0xeab308, 0x16a34a, 0x2563eb, 0x7c3aed, 0x6b7280, 0xf8fafc];
const GOLD = 0xd4af37;
const SILVER = 0xc0c4cc;
const TOLERANCE_HEX: Record<string, number> = {
  '10': SILVER,
  '5': GOLD,
  '2': DIGIT_HEX[2],
  '1': DIGIT_HEX[1],
  '0.5': DIGIT_HEX[5],
  '0.25': DIGIT_HEX[6],
  '0.1': DIGIT_HEX[7],
};

export interface ResistorBand {
  hex: number;
  metallic: boolean;
  kind: 'digit' | 'multiplier' | 'tolerance';
}

/**
 * Colour bands of a resistor from its REAL resistance: 4 bands (2 digits) when two significant
 * digits are enough and the tolerance is wider than 2 %, otherwise 5 bands (3 digits).
 */
export function resistorBands(ohms: number, tolerancePct = 5): ResistorBand[] {
  // 0 ohm link: a single black band
  if (!Number.isFinite(ohms) || ohms <= 0) return [{ hex: DIGIT_HEX[0], metallic: false, kind: 'digit' }];

  const twoDigits = Number(ohms.toPrecision(2));
  const digits = Math.abs(twoDigits - ohms) <= ohms * 1e-9 && tolerancePct > 2 ? 2 : 3;
  let exponent = Math.floor(Math.log10(ohms)) - (digits - 1);
  let mantissa = Math.round(ohms / 10 ** exponent);
  if (mantissa >= 10 ** digits) {
    mantissa = Math.round(mantissa / 10);
    exponent += 1;
  }
  exponent = Math.max(-2, Math.min(9, exponent));

  const bands: ResistorBand[] = String(mantissa)
    .padStart(digits, '0')
    .split('')
    .map((ch) => ({ hex: DIGIT_HEX[Number(ch)], metallic: false, kind: 'digit' as const }));
  bands.push(
    exponent >= 0
      ? { hex: DIGIT_HEX[exponent], metallic: false, kind: 'multiplier' }
      : { hex: exponent === -1 ? GOLD : SILVER, metallic: true, kind: 'multiplier' }
  );
  bands.push({ hex: TOLERANCE_HEX[String(tolerancePct)] ?? GOLD, metallic: tolerancePct >= 5, kind: 'tolerance' });
  return bands;
}

const BODY_LENGTH = 6.5;

/** Bands spread from the pin-A end; the tolerance band sits apart at the pin-B end. */
function layoutBands(bands: ResistorBand[]): AxialBand[] {
  const five = bands.length >= 5;
  const first = -BODY_LENGTH / 2 + 0.95;
  return bands.map((band, i) => ({
    hex: band.hex,
    metallic: band.metallic,
    width: five ? 0.55 : 0.65,
    offset: band.kind === 'tolerance' ? BODY_LENGTH / 2 - 0.95 : first + i * (five ? 0.98 : 1.15),
  }));
}

export const resistorSpec = defineSpec({
  id: 'resistor-axial-quarter-watt',
  definitionIds: ['resistor', 'resistor_axial'],
  reference: 'Carbon/metal film resistor 0.25 W (CFR-25 / MFR-25): body 6.5 x 2.4 mm, lead 0.6 mm, 10.16 mm pitch',
  builder: buildAxial,
  params: (instance) => ({
    pinA: 'pin1',
    pinB: 'pin2',
    bodyLength: BODY_LENGTH,
    bodyDiameter: 2.4,
    leadDiameter: 0.6,
    standoff: 1.0,
    shape: 'dogbone' as const,
    bodyMaterial: Materials.resistorBody(),
    bands: layoutBands(resistorBands(Number(instance.parameters?.resistance) || 220, Number(instance.parameters?.tolerance) || 5)),
  }),
  pins: {
    pin1: { role: 'passive', direction: 'side' },
    pin2: { role: 'passive', direction: 'side' },
  },
});
