/**
 * Units of the 3D asset library.
 *
 * Every spec and builder is authored in REAL MILLIMETRES (datasheet values). This file is the only
 * place where millimetres become scene units: `models/v2/buildComponent.ts` scales the finished
 * model by SCENE_UNITS_PER_MM once. ProjectDocument is in mm as well, so the factor is 1 today.
 */
export const SCENE_UNITS_PER_MM = 1;

export const mm = (millimetres: number): number => millimetres * SCENE_UNITS_PER_MM;

/** Standard 100 mil pitch (breadboard / perfboard / DIP). */
export const PITCH_MM = 2.54;

/** How far a through-hole lead continues below the board surface (into a hole or socket). */
export const LEAD_DEPTH_MM = 3.2;
