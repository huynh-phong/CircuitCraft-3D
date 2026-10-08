/**
 * Resistor 4-Band Electronic Color Code Calculator
 * Standard EIA-RS-279 calculation.
 */

export interface ResistorBandColors {
  band1: string; // 1st significant digit
  band2: string; // 2nd significant digit
  multiplier: string; // Multiplier
  tolerance: string; // Tolerance
  hex1: string;
  hex2: string;
  hexMultiplier: string;
  hexTolerance: string;
}

const DIGIT_COLORS = [
  { name: 'Black', hex: '#1c1917', digit: 0, mult: 1 },
  { name: 'Brown', hex: '#78350f', digit: 1, mult: 10 },
  { name: 'Red', hex: '#dc2626', digit: 2, mult: 100 },
  { name: 'Orange', hex: '#ea580c', digit: 3, mult: 1000 },
  { name: 'Yellow', hex: '#ca8a04', digit: 4, mult: 10000 },
  { name: 'Green', hex: '#16a34a', digit: 5, mult: 100000 },
  { name: 'Blue', hex: '#2563eb', digit: 6, mult: 1000000 },
  { name: 'Violet', hex: '#7c3aed', digit: 7, mult: 10000000 },
  { name: 'Gray', hex: '#64748b', digit: 8, mult: 100000000 },
  { name: 'White', hex: '#f8fafc', digit: 9, mult: 1000000000 },
];

export function getResistorColorBands(resistanceInOhms: number, tolerancePct = 5): ResistorBandColors {
  const r = Math.max(1, Math.round(resistanceInOhms));
  const rStr = r.toString();

  let d1 = 1;
  let d2 = 0;
  let exponent = 0;

  if (rStr.length === 1) {
    d1 = Number(rStr[0]);
    d2 = 0;
    exponent = -1; // 0.1 gold
  } else {
    d1 = parseInt(rStr[0], 10);
    d2 = parseInt(rStr[1], 10);
    exponent = rStr.length - 2;
  }

  const band1Obj = DIGIT_COLORS[d1] || DIGIT_COLORS[1];
  const band2Obj = DIGIT_COLORS[d2] || DIGIT_COLORS[0];
  const multObj = DIGIT_COLORS[Math.min(9, Math.max(0, exponent))] || DIGIT_COLORS[2];

  // Tolerance band: 5% is Gold (#d4af37), 1% is Brown (#78350f), 2% is Red (#dc2626)
  let toleranceName = 'Gold';
  let toleranceHex = '#d4af37';
  if (tolerancePct === 1) {
    toleranceName = 'Brown';
    toleranceHex = '#78350f';
  } else if (tolerancePct === 2) {
    toleranceName = 'Red';
    toleranceHex = '#dc2626';
  }

  return {
    band1: band1Obj.name,
    band2: band2Obj.name,
    multiplier: multObj.name,
    tolerance: toleranceName,
    hex1: band1Obj.hex,
    hex2: band2Obj.hex,
    hexMultiplier: multObj.hex,
    hexTolerance: toleranceHex,
  };
}
