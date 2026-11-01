import test from "node:test";
import assert from "node:assert/strict";

import { triangulate, signedArea, isSimple, EPSILON } from "../src/core.js";

/**
 * Sum of triangle areas from an index triangulation, compared against the
 * polygon's own area. This is the invariant that actually matters: a
 * triangulation is correct when the pieces tile the polygon exactly, regardless
 * of the order the ears happened to come off in.
 */
function triangulatedArea(polygon, triangles) {
  let sum = 0;
  for (const [i, j, k] of triangles) {
    sum += Math.abs(signedArea([polygon[i], polygon[j], polygon[k]]));
  }
  return sum / 2;
}

function polygonArea(polygon) {
  return Math.abs(signedArea(polygon)) / 2;
}

test("signedArea is positive for counter-clockwise input", () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.ok(signedArea(square) > 0);
  assert.equal(signedArea(square), 2);
});

test("signedArea is negative for clockwise input", () => {
  const square = [[0, 0], [0, 1], [1, 1], [1, 0]];
  assert.ok(signedArea(square) < 0);
  assert.equal(signedArea(square), -2);
});

test("signedArea is zero for degenerate input", () => {
  assert.equal(signedArea([]), 0);
  assert.equal(signedArea([[0, 0], [1, 1]]), 0);
  assert.equal(signedArea([[0, 0], [1, 1], [2, 2]]), 0);
});

test("triangulate turns a square into two triangles", () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const tris = triangulate(square);
  assert.equal(tris.length, 2);
  assert.ok(Math.abs(triangulatedArea(square, tris) - polygonArea(square)) < EPSILON);
});

test("triangulate handles clockwise input and still returns original indices", () => {
  const square = [[0, 0], [0, 1], [1, 1], [1, 0]];
  const tris = triangulate(square);
  assert.equal(tris.length, 2);
  for (const tri of tris) {
    for (const idx of tri) {
      assert.ok(Number.isInteger(idx));
      assert.ok(idx >= 0 && idx < square.length);
    }
  }
  assert.ok(Math.abs(triangulatedArea(square, tris) - polygonArea(square)) < EPSILON);
});

test("triangulate handles a concave polygon", () => {
  // An arrowhead: the vertex at (1, 0.5) is reflex and must not be clipped
  // until a neighbour has been removed.
  const arrow = [[0, 0], [2, 0], [1, 0.5], [2, 2], [0, 2]];
  const tris = triangulate(arrow);
  assert.equal(tris.length, arrow.length - 2);
  assert.ok(Math.abs(triangulatedArea(arrow, tris) - polygonArea(arrow)) < EPSILON);
});

test("triangulate handles a polygon with collinear vertices on an edge", () => {
  // The midpoint (1, 0) is collinear with its neighbours. It must not be
  // clipped as an ear (zero area), but it also must not block the diagonal.
  const poly = [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1]];
  const tris = triangulate(poly);
  assert.equal(tris.length, poly.length - 2);
  assert.ok(Math.abs(triangulatedArea(poly, tris) - polygonArea(poly)) < EPSILON);
});

test("triangulate rejects fewer than three vertices", () => {
  assert.throws(() => triangulate([]), RangeError);
  assert.throws(() => triangulate([[0, 0]]), RangeError);
  assert.throws(() => triangulate([[0, 0], [1, 1]]), RangeError);
});

test("triangulate rejects a self-intersecting polygon", () => {
  const bowtie = [[0, 0], [1, 1], [1, 0], [0, 1]];
  assert.throws(() => triangulate(bowtie), RangeError);
  assert.equal(isSimple(bowtie), false);
});

test("triangulate rejects an all-collinear polygon", () => {
  const line = [[0, 0], [1, 1], [2, 2], [3, 3]];
  assert.throws(() => triangulate(line), RangeError);
});

test("isSimple accepts a plain triangle and a square", () => {
  assert.equal(isSimple([[0, 0], [1, 0], [0, 1]]), true);
  assert.equal(isSimple([[0, 0], [1, 0], [1, 1], [0, 1]]), true);
});

test("isSimple rejects a T-junction where a vertex lies on another edge", () => {
  const t = [[0, 0], [2, 0], [1, 0], [1, 1]];
  assert.equal(isSimple(t), false);
});

test("triangulate does not mutate the input polygon", () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const snapshot = square.map((p) => [p[0], p[1]]);
  triangulate(square);
  assert.deepEqual(square, snapshot);
});
