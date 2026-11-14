/**
 * Level of detail of the asset library. It follows the workspace "Chất lượng" setting
 * (low / balanced / high), which already starts at `low` on low-memory phones (see App.tsx).
 */
export type DetailLevel = 'low' | 'balanced' | 'high';

/** Segments around a round part (cylinders, lathes, tubes use a fraction of it). */
export const RADIAL_SEGMENTS: Record<DetailLevel, number> = { low: 8, balanced: 14, high: 24 };

/** Maximum triangles of ONE component model, hit targets excluded. Enforced by test/visual_assets.test.ts. */
export const COMPONENT_TRIANGLE_BUDGET: Record<DetailLevel, number> = { low: 700, balanced: 2600, high: 6500 };

/** Maximum triangles of the whole workbench (mat, desk and decoration). */
export const WORKBENCH_TRIANGLE_BUDGET: Record<DetailLevel, number> = { low: 6000, balanced: 40000, high: 80000 };

export const radial = (detail: DetailLevel, factor = 1): number =>
  Math.max(4, Math.round(RADIAL_SEGMENTS[detail] * factor));

export const pick = <T>(detail: DetailLevel, low: T, balanced: T, high: T): T =>
  detail === 'low' ? low : detail === 'high' ? high : balanced;
