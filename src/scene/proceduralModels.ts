/**
 * Compatibility entry point. The component models now live in:
 *   - ./models/index.ts     registry that picks the model set ('legacy' | 'v2')
 *   - ./models/legacy/      the previous procedural models, unchanged
 *   - ./assets/             the v2 asset library (see assets/README.md)
 */
export * from './models';
