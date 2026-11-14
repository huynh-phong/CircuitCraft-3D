import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cachedGeometry, cachedMaterial, cachedTexture } from '../cache';
import { DetailLevel, pick, radial } from '../quality';

/**
 * Reusable building blocks. Every function returns a CACHED geometry (shared between all the
 * instances that ask for the same parameters) and is placed with `part()`.
 *
 * Conventions (see ../README.md): millimetres, Y up, Y = 0 is the board surface.
 */

type V3 = [number, number, number];
type V2 = [number, number];

const key = (...values: Array<string | number | boolean>) =>
  values.map((v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v)).join('|');

// --------------------------------------------------------------------------------------
// Placement
// --------------------------------------------------------------------------------------

export interface PartOptions {
  at?: V3;
  rot?: V3;
  scale?: V3 | number;
  name?: string;
  /** Defaults to true. Turn off for tiny details. */
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Keep as its own mesh (animated, clickable or material-swapped parts): excluded from `bakeStatic`. */
  dynamic?: boolean;
  userData?: Record<string, unknown>;
}

function place(object: THREE.Object3D, o: PartOptions) {
  if (o.at) object.position.set(o.at[0], o.at[1], o.at[2]);
  if (o.rot) object.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale !== undefined) {
    if (typeof o.scale === 'number') object.scale.setScalar(o.scale);
    else object.scale.set(o.scale[0], o.scale[1], o.scale[2]);
  }
  if (o.name) object.name = o.name;
}

/** Adds a mesh of a cached geometry and a shared material to `parent`. */
export function part(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  options: PartOptions = {}
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  place(mesh, options);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? false;
  if (options.userData) Object.assign(mesh.userData, options.userData);
  if (options.dynamic) mesh.userData.bake = false;
  parent.add(mesh);
  return mesh;
}

/** Adds an empty transform group (e.g. a rotating shaft, a decoration item) to `parent`. */
export function group(parent: THREE.Object3D, options: PartOptions = {}): THREE.Group {
  const g = new THREE.Group();
  place(g, options);
  if (options.dynamic) g.userData.bake = false;
  parent.add(g);
  return g;
}

// --------------------------------------------------------------------------------------
// Solids
// --------------------------------------------------------------------------------------

export const box = (w: number, h: number, d: number) =>
  cachedGeometry(key('box', w, h, d), () => new THREE.BoxGeometry(w, h, d));

/** Box with rounded / chamfered edges. At `low` detail it is a plain box. */
export function chamferBox(w: number, h: number, d: number, r: number, detail: DetailLevel) {
  if (detail === 'low') return box(w, h, d);
  const segments = detail === 'high' ? 3 : 1;
  const radius = Math.min(r, w / 2, h / 2, d / 2);
  return cachedGeometry(key('rbox', w, h, d, radius, segments), () => new RoundedBoxGeometry(w, h, d, segments, radius));
}

export interface CylinderOptions {
  open?: boolean;
  /** Multiplies the radial segment count of the detail level. */
  radialFactor?: number;
  thetaStart?: number;
  thetaLength?: number;
}

/** Cylinder / cone along Y, centred on the origin. */
export function cylinder(rTop: number, rBottom: number, h: number, detail: DetailLevel, o: CylinderOptions = {}) {
  const seg = radial(detail, o.radialFactor ?? 1);
  return cachedGeometry(
    key('cyl', rTop, rBottom, h, seg, Boolean(o.open), o.thetaStart ?? 0, o.thetaLength ?? Math.PI * 2),
    () => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, Boolean(o.open), o.thetaStart ?? 0, o.thetaLength ?? Math.PI * 2)
  );
}

/** Cylinder whose axis is Z (motor shafts and other parts that spin with `rotation.z`). */
export function cylinderZ(r: number, length: number, detail: DetailLevel, radialFactor = 1) {
  const seg = radial(detail, radialFactor);
  return cachedGeometry(key('cylz', r, length, seg), () => {
    const g = new THREE.CylinderGeometry(r, r, length, seg);
    g.rotateX(Math.PI / 2);
    return g;
  });
}

export function sphere(r: number, detail: DetailLevel, thetaLength = Math.PI) {
  const w = radial(detail);
  const h = Math.max(3, Math.round(w * 0.6));
  return cachedGeometry(key('sph', r, w, h, thetaLength), () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, thetaLength));
}

export function torus(R: number, r: number, detail: DetailLevel, arc = Math.PI * 2) {
  const tubular = radial(detail, 1.4);
  const radialSeg = pick(detail, 4, 6, 8);
  return cachedGeometry(key('tor', R, r, tubular, radialSeg, arc), () => new THREE.TorusGeometry(R, r, radialSeg, tubular, arc));
}

/**
 * Body of revolution around Y from a profile of [radius, y] points (bottom to top).
 * Used for dog-bone resistor bodies, LED lenses, knobs, cans.
 */
export function lathe(id: string, profile: V2[], detail: DetailLevel, radialFactor = 1) {
  const seg = radial(detail, radialFactor);
  return cachedGeometry(
    key('lathe', id, seg, profile.flat().map((n) => n.toFixed(3)).join(',')),
    () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg)
  );
}

/** Quarter-circle dome profile for `lathe`: from (r, y0) up to (0, y0 + r). */
export function domeProfile(r: number, y0: number, steps: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    out.push([Math.max(0, r * Math.cos(a)), y0 + r * Math.sin(a)]);
  }
  return out;
}

export interface ExtrudeOptions {
  /** Rounded edge size; 0 = sharp. Dropped at `low` detail. */
  bevel?: number;
  /** 'y' (default): the outline lies in XZ and is extruded upwards from y = 0. 'x': outline in ZY, extruded along X, centred. */
  axis?: 'y' | 'x';
  curveSegments?: number;
}

/**
 * Extrusion of a closed 2D outline. `depth` is the overall size along the extrusion axis (bevel included).
 *  - axis 'y': outline points are [x, z].
 *  - axis 'x': outline points are [z, y].
 */
export function extrude(id: string, outline: V2[] | THREE.Shape, depth: number, detail: DetailLevel, o: ExtrudeOptions = {}) {
  const bevel = detail === 'low' ? 0 : o.bevel ?? 0;
  const axis = o.axis ?? 'y';
  const outlineKey = Array.isArray(outline) ? outline.flat().map((n) => n.toFixed(3)).join(',') : 'shape';
  return cachedGeometry(key('ext', id, depth, bevel, axis, o.curveSegments ?? 0, outlineKey), () => {
    let shape: THREE.Shape;
    if (Array.isArray(outline)) {
      // Shapes are drawn in XY; map the outline so that it ends up in the wanted plane after rotation
      shape = new THREE.Shape(outline.map(([a, b]) => (axis === 'y' ? new THREE.Vector2(a, -b) : new THREE.Vector2(-a, b))));
    } else {
      shape = outline;
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * bevel,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: detail === 'high' ? 2 : 1,
      curveSegments: o.curveSegments ?? radial(detail, 0.5),
    });
    if (axis === 'y') {
      geometry.rotateX(-Math.PI / 2); // extrusion +Z -> +Y, shape y -> -z
      geometry.translate(0, bevel, 0);
    } else {
      geometry.rotateY(Math.PI / 2); // extrusion +Z -> +X, shape x -> -z
      geometry.translate(-depth / 2 + bevel, 0, 0);
    }
    return geometry;
  });
}

/** Rounded rectangle outline (for `extrude`), centred, in the XZ plane. */
export function roundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const hw = w / 2;
  const hd = d / 2;
  const rr = Math.min(r, hw, hd);
  const s = new THREE.Shape();
  s.moveTo(-hw + rr, -hd);
  s.lineTo(hw - rr, -hd);
  s.absarc(hw - rr, -hd + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - rr);
  s.absarc(hw - rr, hd - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(-hw + rr, hd);
  s.absarc(-hw + rr, hd - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + rr);
  s.absarc(-hw + rr, -hd + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Flat rounded rectangle slab lying on y = 0, `h` thick. */
export function roundedSlab(w: number, d: number, h: number, r: number, detail: DetailLevel, bevel = 0) {
  const b = detail === 'low' ? 0 : bevel;
  return cachedGeometry(key('slab', w, d, h, r, b, detail), () => {
    const geometry = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
      depth: h - 2 * b,
      bevelEnabled: b > 0,
      bevelSize: b,
      bevelThickness: b,
      bevelSegments: detail === 'high' ? 3 : 2,
      curveSegments: pick(detail, 3, 6, 10),
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, b, 0);
    return geometry;
  });
}

/** Flat ring between two rounded rectangles on y = 0 (stitching line of the mat, silkscreen frames). */
export function roundedFrame(w: number, d: number, r: number, lineWidth: number, detail: DetailLevel) {
  return cachedGeometry(key('frame', w, d, r, lineWidth, detail), () => {
    const outer = roundedRectShape(w, d, r);
    const inner = roundedRectShape(w - 2 * lineWidth, d - 2 * lineWidth, Math.max(0.01, r - lineWidth));
    outer.holes.push(new THREE.Path(inner.getPoints(pick(detail, 3, 6, 10)).reverse()));
    const geometry = new THREE.ShapeGeometry(outer, pick(detail, 3, 6, 10));
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  });
}

export function disc(r: number, detail: DetailLevel) {
  return cachedGeometry(key('disc', r, detail), () => {
    const g = new THREE.CircleGeometry(r, radial(detail));
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

export function ring(rInner: number, rOuter: number, detail: DetailLevel) {
  return cachedGeometry(key('ring', rInner, rOuter, detail), () => {
    const g = new THREE.RingGeometry(rInner, rOuter, radial(detail));
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

/** Horizontal rectangle facing up (labels, printed marks, contact shadows). */
export function plane(w: number, d: number) {
  return cachedGeometry(key('plane', w, d), () => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    return g;
  });
}

// --------------------------------------------------------------------------------------
// Leads, wires, pins
// --------------------------------------------------------------------------------------

/** Tube along a smooth curve through `points`. Wires, cables, probe leads. */
export function cable(id: string, points: V3[], radius: number, detail: DetailLevel, tension = 0.5) {
  const tubular = Math.max(4, Math.round(points.length * pick(detail, 3, 5, 8)));
  const radialSeg = pick(detail, 4, 6, 8);
  return cachedGeometry(
    key('cable', id, radius, tubular, radialSeg, points.flat().map((n) => n.toFixed(2)).join(',')),
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', tension),
        tubular,
        radius,
        radialSeg,
        false
      )
  );
}

/** Round through-hole lead standing on the pin anchor: from `below` under the board up to `above`. */
export function leadRound(above: number, below: number, radius: number, detail: DetailLevel) {
  const seg = pick(detail, 5, 6, 8);
  return cachedGeometry(key('lead-r', above, below, radius, seg), () => {
    const g = new THREE.CylinderGeometry(radius, radius, above + below, seg);
    g.translate(0, (above - below) / 2, 0);
    return g;
  });
}

/** Square / flat stamped lead (LED legs, switch and potentiometer tabs, DIP legs). */
export function leadFlat(above: number, below: number, width: number, thickness: number) {
  return cachedGeometry(key('lead-f', above, below, width, thickness), () => {
    const g = new THREE.BoxGeometry(width, above + below, thickness);
    g.translate(0, (above - below) / 2, 0);
    return g;
  });
}

/**
 * Bent axial lead. Origin = pin anchor on the board surface. The lead leaves the component body at
 * (`run`, `bodyY`, 0) (so `run` is the signed distance from the pin to the body end), runs
 * horizontally to above the pin, bends with a rounded elbow and goes down to `below` under the board.
 */
export function leadBent(run: number, bodyY: number, below: number, radius: number, detail: DetailLevel) {
  const tubular = pick(detail, 8, 12, 20);
  const radialSeg = pick(detail, 5, 6, 8);
  return cachedGeometry(key('lead-b', run, bodyY, below, radius, tubular, radialSeg), () => {
    const sign = Math.sign(run) || 1;
    const bend = Math.min(Math.abs(run) * 0.8, bodyY * 0.6, radius * 4);
    const path = new THREE.CurvePath<THREE.Vector3>();
    const a = new THREE.Vector3(run, bodyY, 0);
    const b = new THREE.Vector3(sign * bend, bodyY, 0);
    const corner = new THREE.Vector3(0, bodyY, 0);
    const c = new THREE.Vector3(0, bodyY - bend, 0);
    const d = new THREE.Vector3(0, -below, 0);
    path.add(new THREE.LineCurve3(a, b));
    path.add(new THREE.QuadraticBezierCurve3(b, corner, c));
    path.add(new THREE.LineCurve3(c, d));
    return new THREE.TubeGeometry(path, tubular, radius, radialSeg, false);
  });
}

/** Square 0.64 mm header pin with pointed look: a plain flat lead today, kept as its own name for header builders. */
export const headerPin = (above: number, below: number) => leadFlat(above, below, 0.64, 0.64);

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private turns: number, private length: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, t * this.length, Math.sin(a) * this.r);
  }
}

/** Coil spring along +Y starting at the origin (battery contacts, soldering iron stand). */
export function spring(coilRadius: number, wireRadius: number, turns: number, length: number, detail: DetailLevel) {
  const tubular = Math.round(turns * pick(detail, 6, 10, 16));
  const radialSeg = pick(detail, 4, 5, 6);
  return cachedGeometry(
    key('spring', coilRadius, wireRadius, turns, length, tubular, radialSeg),
    () => new THREE.TubeGeometry(new HelixCurve(coilRadius, turns, length), tubular, wireRadius, radialSeg, false)
  );
}

/** Threaded rod / bushing along Y (centred): a lathe with a saw-tooth profile. */
export function thread(radius: number, length: number, pitch: number, detail: DetailLevel) {
  if (detail === 'low') return cylinder(radius, radius, length, detail);
  const n = Math.max(2, Math.round(length / pitch));
  const profile: V2[] = [[0, -length / 2]];
  for (let i = 0; i <= n; i++) {
    const y = -length / 2 + (i / n) * length;
    profile.push([radius * 0.9, y]);
    if (i < n) profile.push([radius, y + length / n / 2]);
  }
  profile.push([0, length / 2]);
  return lathe(`thread-${radius}-${length}-${pitch}`, profile, detail);
}

/** Knurled shaft / knob along Y from y = 0: a gear-like outline extruded upwards. Plain cylinder at `low`. */
export function knurled(radius: number, height: number, teeth: number, detail: DetailLevel) {
  if (detail === 'low') {
    return cachedGeometry(key('knurl-low', radius, height), () => {
      const g = new THREE.CylinderGeometry(radius, radius, height, radial(detail));
      g.translate(0, height / 2, 0);
      return g;
    });
  }
  const outline: V2[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.93;
    outline.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return extrude(`knurl-${radius}-${teeth}`, outline, height, detail);
}

/** Flat-head slotted screw seen from above: head + dark slot. Origin = top centre of the head. */
export function slottedScrew(
  parent: THREE.Object3D,
  at: V3,
  headRadius: number,
  detail: DetailLevel,
  metal: THREE.Material,
  slot: THREE.Material,
  slotAngle = 0.5
): void {
  const h = headRadius * 0.5;
  part(parent, cylinder(headRadius, headRadius, h, detail), metal, { at: [at[0], at[1] - h / 2, at[2]], castShadow: false });
  part(parent, box(headRadius * 1.7, 0.06, headRadius * 0.28), slot, {
    at: [at[0], at[1] + 0.02, at[2]],
    rot: [0, slotAngle, 0],
    castShadow: false,
  });
}

// --------------------------------------------------------------------------------------
// Printed labels
// --------------------------------------------------------------------------------------

export interface LabelOptions {
  color?: string;
  background?: string | null;
  /** Font weight + family; the size is fitted to the texture height. */
  font?: string;
  castShadow?: false;
}

/**
 * Printed text on a horizontal rectangle `w` x `d` mm facing up (rotate it with `rot` for other faces).
 * Texts must come from a fixed set (they are cached textures). Returns null where no canvas exists
 * (Node tests): labels are decoration only, never information the model depends on.
 */
export function label(
  parent: THREE.Object3D,
  text: string,
  w: number,
  d: number,
  options: PartOptions & LabelOptions = {}
): THREE.Mesh | null {
  const color = options.color ?? '#ffffff';
  const background = options.background ?? null;
  const font = options.font ?? '700 sans-serif';
  const id = key('label', text, color, background ?? 'none', font, (w / d).toFixed(2));
  const texture = cachedTexture(id, () => {
    if (typeof document === 'undefined') return null;
    const height = 64;
    const width = Math.max(16, Math.round((height * w) / d));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    const [weight, ...family] = font.split(' ');
    let size = height * 0.78;
    ctx.font = `${weight} ${size}px ${family.join(' ')}`;
    const measured = ctx.measureText(text).width;
    if (measured > width * 0.92) size *= (width * 0.92) / measured;
    ctx.font = `${weight} ${size}px ${family.join(' ')}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + size * 0.04);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
  if (!texture) return null;
  const material = cachedMaterial(
    id,
    () => new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  return part(parent, plane(w, d), material, { ...options, castShadow: false });
}

// --------------------------------------------------------------------------------------
// Baking
// --------------------------------------------------------------------------------------

/** Index-normalised copy of `source` in the space of `root`, with position / normal / uv only. */
function bakedCopy(mesh: THREE.Mesh, rootInverse: THREE.Matrix4): THREE.BufferGeometry {
  const source = mesh.geometry;
  const copy = new THREE.BufferGeometry();
  copy.setAttribute('position', source.getAttribute('position').clone());
  const normal = source.getAttribute('normal');
  if (normal) copy.setAttribute('normal', normal.clone());
  const count = source.getAttribute('position').count;
  const uv = source.getAttribute('uv');
  copy.setAttribute('uv', uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  if (source.index) {
    copy.setIndex(source.index.clone());
  } else {
    const index = new Uint32Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    copy.setIndex(new THREE.BufferAttribute(index, 1));
  }
  if (!normal) copy.computeVertexNormals();
  copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld));
  return copy;
}

/**
 * Merges all static meshes under `root` that share a material into one mesh per material, which
 * cuts the draw calls of a detailed model from "one per part" to "one per material".
 *
 * Meshes created with `dynamic: true` (or inside a `dynamic` group) are left untouched. The merged
 * geometries belong to this model only: they are NOT shared and are disposed with it.
 */
export function bakeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, THREE.Mesh[]>();

  const visit = (object: THREE.Object3D) => {
    if (object.userData.bake === false) return;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
      const id = `${mesh.material.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${mesh.renderOrder}`;
      const list = buckets.get(id);
      if (list) list.push(mesh);
      else buckets.set(id, [mesh]);
    }
    for (const child of object.children) visit(child);
  };
  for (const child of root.children) visit(child);

  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((m) => bakedCopy(m, rootInverse));
    const merged = mergeGeometries(copies, false);
    for (const c of copies) c.dispose();
    if (!merged) continue;
    const first = meshes[0];
    const baked = new THREE.Mesh(merged, first.material);
    baked.castShadow = first.castShadow;
    baked.receiveShadow = first.receiveShadow;
    baked.renderOrder = first.renderOrder;
    baked.name = `baked:${(first.material as THREE.Material).name}`;
    for (const m of meshes) m.removeFromParent();
    root.add(baked);
  }

  // Drop the groups that baking emptied
  const prune = (object: THREE.Object3D) => {
    for (const child of [...object.children]) {
      prune(child);
      if ((child as THREE.Group).isGroup && child.children.length === 0 && child.userData.bake !== false) child.removeFromParent();
    }
  };
  prune(root);
}

/** Makes every mesh under `root` transparent to the raycaster (decoration must never catch a pointer). */
export function ignoreRaycast(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.raycast = () => {};
  });
}

export function countTriangles(root: THREE.Object3D, include: (mesh: THREE.Mesh) => boolean = () => true): number {
  let total = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !include(mesh)) return;
    const g = mesh.geometry;
    const perInstance = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    const instances = (mesh as unknown as THREE.InstancedMesh).isInstancedMesh ? (mesh as unknown as THREE.InstancedMesh).count : 1;
    total += perInstance * instances;
  });
  return Math.round(total);
}
