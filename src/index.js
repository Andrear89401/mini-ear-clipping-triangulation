/**
 * Public entry point for mini-ear-clipping-triangulation.
 *
 * Everything that callers are expected to use is re-exported from here so the
 * package has exactly one import surface. Keeping core.js free of side effects
 * means the algorithm can be tested in isolation without dragging in the
 * package-level re-exports.
 */
export { triangulate, signedArea, isSimple, EPSILON } from "./core.js";
