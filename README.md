# mini-ear-clipping-triangulation

Triangulates a simple polygon by iteratively clipping ears, returning triangles as
index triples into the input vertex array.

```js
import { triangulate } from "mini-ear-clipping-triangulation";

// A concave arrowhead, counter-clockwise.
const polygon = [
  [0, 0],
  [2, 0],
  [1, 0.5],
  [2, 2],
  [0, 2],
];

const triangles = triangulate(polygon);
// triangles.length === polygon.length - 2
// e.g. [ [ 0, 1, 2 ], [ 0, 2, 3 ], [ 0, 3, 4 ] ]
```

## Why this exists

Ear clipping is the shortest correct path from a polygon to triangles when you
do not need the speed of a sweep-line or monotone-decomposition approach. It is
about eighty lines of geometry, easy to audit, and good enough for the polygon
sizes that show up in tooling and small renderers. The trade-off is deliberate:
O(n^2) in the vertex count, in exchange for no auxiliary data structures and no
dependencies. If you are triangulating tens of thousands of vertices per frame,
this is the wrong library.

The other decision worth knowing about is that `triangulate` returns **indices**,
not points. Callers almost always own the vertex data already and want to map the
result back onto it, so emitting copied coordinates would throw away that
identity for no benefit.

## API

### `triangulate(polygon)`

`polygon` is an array of `[x, y]` pairs forming a closed chain; the edge from the
last vertex back to the first is implicit. Returns an array of `[i, j, k]` index
triples into `polygon`. A valid input of `n` vertices yields `n - 2` triangles.

Input may be clockwise or counter-clockwise. Clockwise input is reversed
internally, and the returned indices always refer to the array you passed in.

The input array is never mutated.

Throws `RangeError` when the polygon has fewer than three vertices, when it is
self-intersecting, or when it is degenerate (all vertices collinear).

### `signedArea(polygon)`

Returns twice the signed area of the closed polygon. Positive means
counter-clockwise, negative means clockwise, zero means degenerate. Twice the
area is returned so the result stays exact for integer coordinates.

### `isSimple(polygon)`

Returns `true` when no two non-adjacent edges of the chain intersect. Shared
endpoints between consecutive edges are fine; any other touch, including a
vertex lying on a non-adjacent edge, counts as an intersection.

### `EPSILON`

The tolerance (`1e-9`) used by the orientation and containment tests. It is
exported so callers can reason about the scale at which classification becomes
unreliable. Coordinates far from unity should be rescaled before triangulating
rather than relying on this constant.

## The awkward edge

Vertices that are collinear with both neighbours are not clipped as ears. They
have zero area, and clipping them would emit degenerate triangles. The
implementation skips them and lets a neighbouring corner come off first, so a
polygon like `[[0,0],[1,0],[2,0],[2,1],[0,1]]` still triangulates cleanly. The
consequence is that the *order* of the returned triangles is not stable across
small changes to the input: it depends on which ear happened to be clip-able at
each step. Rely on the count and the covered area, not on the sequence.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

