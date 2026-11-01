/**
 * Ear clipping triangulation for simple polygons.
 *
 * A polygon is a closed chain of vertices; the closing edge from the last
 * vertex back to the first is implicit. We accept the vertex list in either
 * winding order and normalise internally to counter-clockwise (positive signed
 * area) because the ear test is stated for CCW input. Rather than mutating the
 * caller's array we keep an index list, which also makes removal O(1) per ear.
 *
 * The algorithm is O(n^2) in the number of vertices. That is the honest cost of
 * the naive ear test: for each candidate ear we scan every remaining vertex.
 * Faster algorithms exist but they need a balanced structure for the reflex
 * vertices, and the point of this library is to stay small enough to read.
 */

/**
 * Tolerance used for orientation and point-in-triangle tests.
 *
 * Coordinates are treated as doubles, so exact zero is not something we can
 * rely on. A fixed absolute epsilon is appropriate here because the predicates
 * are only ever used to classify a value that is either genuinely zero or well
 * away from zero for non-degenerate input. Callers with coordinates scaled far
 * from unity should scale their input instead of relying on this constant.
 */
export const EPSILON = 1e-9;

/**
 * Twice the signed area of the closed polygon.
 *
 * Positive means counter-clockwise in a y-up coordinate system, negative means
 * clockwise. We return twice the area so the result stays exact for integer
 * input: no division by two, no rounding. Degenerate polygons (fewer than three
 * vertices, or all points collinear) return zero.
 *
 * @param {ReadonlyArray<readonly [number, number]>} polygon
 * @returns {number}
 */
export function signedArea(polygon) {
  const n = polygon.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % n];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/**
 * Orientation of the ordered triple (a, b, c).
 *
 * Returns a positive number when the turn a -> b -> c is counter-clockwise, a
 * negative number when it is clockwise, and a value within EPSILON of zero when
 * the three points are collinear. The magnitude is twice the area of the
 * triangle, which is convenient for reuse in the containment test.
 *
 * @param {readonly [number, number]} a
 * @param {readonly [number, number]} b
 * @param {readonly [number, number]} c
 * @returns {number}
 */
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * Strict point-in-triangle test for a counter-clockwise triangle.
 *
 * Points exactly on an edge are reported as outside. That choice matters for
 * ear clipping: a vertex lying on the ear's diagonal is not a blocking vertex,
 * and treating it as one would stall the algorithm on polygons that have
 * collinear vertices along a diagonal. Only strictly interior vertices block an
 * ear.
 *
 * @param {readonly [number, number]} p
 * @param {readonly [number, number]} a
 * @param {readonly [number, number]} b
 * @param {readonly [number, number]} c
 * @returns {boolean}
 */
function pointInTriangle(p, a, b, c) {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  return d1 > EPSILON && d2 > EPSILON && d3 > EPSILON;
}

/**
 * Decide whether the vertex at index i is a convex corner of the polygon.
 *
 * The polygon is assumed to be counter-clockwise, so a convex corner is one
 * where the turn is strictly counter-clockwise. Collinear corners are reported
 * as non-convex; clipping them produces zero-area triangles, so we skip them and
 * let a neighbouring corner be clipped first.
 *
 * @param {ReadonlyArray<readonly [number, number]>} polygon
 * @param {number} i
 * @returns {boolean}
 */
function isConvex(polygon, i) {
  const n = polygon.length;
  const prev = polygon[(i + n - 1) % n];
  const curr = polygon[i];
  const next = polygon[(i + 1) % n];
  return cross(prev, curr, next) > EPSILON;
}

/**
 * Check whether the polygon is simple: no two non-adjacent edges intersect.
 *
 * This is a defensive check, not part of the ear clipping loop. Ear clipping
 * silently produces garbage on self-intersecting input, so we refuse it up
 * front instead of returning a plausible-looking wrong triangulation. The test
 * is the straightforward O(n^2) pairwise edge comparison; it is only run once.
 *
 * Shared endpoints are allowed between edges that are adjacent in the chain,
 * and between the first and last edge, since those are the same vertex. Any
 * other intersection, including a T-junction where an endpoint lies on another
 * edge, is rejected.
 *
 * @param {ReadonlyArray<readonly [number, number]>} polygon
 * @returns {boolean}
 */
export function isSimple(polygon) {
  const n = polygon.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = polygon[i];
    const a2 = polygon[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Skip edges that share a vertex in the chain.
      if (j === i) continue;
      if ((j + 1) % n === i) continue;
      if ((i + 1) % n === j) continue;
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/**
 * Segment intersection that treats touching endpoints as an intersection.
 *
 * We use orientation tests rather than solving for the intersection point: no
 * division, no infinities, and collinear overlap is handled by an explicit
 * on-segment check. The EPSILON slack is applied to the orientation signs so
 * that near-collinear edges are not reported as crossing spuriously.
 *
 * @param {readonly [number, number]} p1
 * @param {readonly [number, number]} p2
 * @param {readonly [number, number]} p3
 * @param {readonly [number, number]} p4
 * @returns {boolean}
 */
function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);

  if (((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
      ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))) {
    return true;
  }

  if (Math.abs(d1) <= EPSILON && onSegment(p3, p4, p1)) return true;
  if (Math.abs(d2) <= EPSILON && onSegment(p3, p4, p2)) return true;
  if (Math.abs(d3) <= EPSILON && onSegment(p1, p2, p3)) return true;
  if (Math.abs(d4) <= EPSILON && onSegment(p1, p2, p4)) return true;

  return false;
}

/**
 * Whether collinear point p lies within the bounding box of segment a-b.
 *
 * Callers must already have established that p is collinear with a and b; this
 * only decides whether it is inside the segment rather than on its extension.
 *
 * @param {readonly [number, number]} a
 * @param {readonly [number, number]} b
 * @param {readonly [number, number]} p
 * @returns {boolean}
 */
function onSegment(a, b, p) {
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  return p[0] >= minX - EPSILON && p[0] <= maxX + EPSILON &&
         p[1] >= minY - EPSILON && p[1] <= maxY + EPSILON;
}

/**
 * Triangulate a simple polygon by repeatedly clipping ears.
 *
 * The returned array holds triangles as triples of vertex indices into the
 * input polygon. Indices, not points, are returned because the caller usually
 * owns the vertex data and wants to map triangles back onto it; emitting fresh
 * points would throw away that identity.
 *
 * Input may be clockwise or counter-clockwise. Clockwise input is reversed
 * internally and the returned indices refer to the original array, so callers
 * never have to think about winding. A polygon with n vertices yields n - 2
 * triangles when it is a valid simple polygon.
 *
 * Throws a RangeError for fewer than three vertices, for a self-intersecting
 * polygon, and for a polygon whose vertices are all collinear. These are inputs
 * for which no triangulation exists, and returning an empty array would hide
 * the caller's bug.
 *
 * @param {ReadonlyArray<readonly [number, number]>} polygon
 * @returns {Array<[number, number, number]>}
 */
export function triangulate(polygon) {
  const n = polygon.length;
  if (n < 3) {
    throw new RangeError("triangulate needs at least three vertices");
  }
  if (!isSimple(polygon)) {
    throw new RangeError("triangulate needs a simple polygon");
  }

  const area = signedArea(polygon);
  if (Math.abs(area) <= EPSILON) {
    throw new RangeError("triangulate needs a non-degenerate polygon");
  }

  // Work on indices so the result refers to the caller's original array even
  // after we reverse the winding order for clockwise input.
  const indices = [];
  if (area > 0) {
    for (let i = 0; i < n; i++) indices.push(i);
  } else {
    for (let i = n - 1; i >= 0; i--) indices.push(i);
  }

  const triangles = [];
  // Each successful clip removes one vertex, so at most n - 2 clips happen.
  // The guard bounds the loop even if a pathological polygon somehow fails to
  // make progress, which turns a hang into a clear error.
  let guard = n * n;

  while (indices.length > 3) {
    let clipped = false;
    const m = indices.length;

    for (let i = 0; i < m; i++) {
      const prev = polygon[indices[(i + m - 1) % m]];
      const curr = polygon[indices[i]];
      const next = polygon[indices[(i + 1) % m]];

      if (cross(prev, curr, next) <= EPSILON) continue;

      let blocked = false;
      for (let j = 0; j < m; j++) {
        if (j === i || j === (i + m - 1) % m || j === (i + 1) % m) continue;
        if (pointInTriangle(polygon[indices[j]], prev, curr, next)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      triangles.push([indices[(i + m - 1) % m], indices[i], indices[(i + 1) % m]]);
      indices.splice(i, 1);
      clipped = true;
      break;
    }

    if (!clipped) {
      throw new RangeError("triangulate could not clip an ear; polygon may be degenerate");
    }
    if (--guard < 0) {
      throw new RangeError("triangulate made no progress");
    }
  }

  // The final three vertices form the last triangle. Its orientation is already
  // counter-clockwise because every clip preserved the winding of the chain.
  triangles.push([indices[0], indices[1], indices[2]]);
  return triangles;
}
