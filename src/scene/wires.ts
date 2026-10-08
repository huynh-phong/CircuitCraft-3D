import * as THREE from 'three';
import { Connection, ComponentInstance, Vector3D } from '../domain/project/types';
import { calculatePinWorldPosition } from '../domain/project/coordinates';
import { COMPONENT_DEFINITION_MAP } from '../domain/components/definitions';
import { computeOrthogonalWireRoute } from '../domain/project/wireRouting';

export function createWireMesh(
  connection: Connection,
  components: ComponentInstance[],
  isSelected = false
): THREE.Group | null {
  const fromComp = components.find((c) => c.instanceId === connection.fromComponentId);
  const toComp = components.find((c) => c.instanceId === connection.toComponentId);

  if (!fromComp || !toComp) return null;

  const fromDef = COMPONENT_DEFINITION_MAP.get(fromComp.definitionId);
  const toDef = COMPONENT_DEFINITION_MAP.get(toComp.definitionId);
  if (!fromDef || !toDef) return null;

  const fromPin = fromDef.pins.find((p) => p.id === connection.fromPinId);
  const toPin = toDef.pins.find((p) => p.id === connection.toPinId);
  if (!fromPin || !toPin) return null;

  const p1 = calculatePinWorldPosition(fromComp, fromPin.localOffset);
  const p2 = calculatePinWorldPosition(toComp, toPin.localOffset);

  const start = new THREE.Vector3(p1.x, p1.y, p1.z);
  const end = new THREE.Vector3(p2.x, p2.y, p2.z);

  const dist = start.distanceTo(end);
  // Default to orthogonal routing for neat, realistic circuit board wiring
  const wireStyle = connection.wireStyle || 'orthogonal';
  const sagFactor = typeof connection.sag === 'number' ? connection.sag : 1.0;
  const wireRadius = Math.max(0.25, Math.min(2.5, connection.thickness || 0.55));

  let curve: THREE.Curve<THREE.Vector3>;

  if (wireStyle === 'straight') {
    // Direct point-to-point line
    curve = new THREE.LineCurve3(start, end);
  } else if (wireStyle === 'orthogonal') {
    // Obstacle-avoiding 90-degree Manhattan routing
    const routePoints = computeOrthogonalWireRoute(
      p1,
      p2,
      components,
      fromComp.instanceId,
      toComp.instanceId
    );
    const v3Points = routePoints.map((pt) => new THREE.Vector3(pt.x, pt.y, pt.z));
    curve = new THREE.CatmullRomCurve3(v3Points, false, 'centripetal', 0.15);
  } else {
    // Natural catenary arch (curved)
    const archHeight = Math.max(3.0, Math.min(28.0, dist * 0.28)) * sagFactor;
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y = Math.max(start.y, end.y) + archHeight;

    const p1Up = new THREE.Vector3(p1.x, p1.y + 2.0, p1.z);
    const p2Up = new THREE.Vector3(p2.x, p2.y + 2.0, p2.z);

    curve = new THREE.CatmullRomCurve3([start, p1Up, mid, p2Up, end], false, 'centripetal', 0.2);
  }

  // Tube geometry
  const segments = wireStyle === 'straight' ? 4 : 32;
  const tubeGeom = new THREE.TubeGeometry(curve, segments, wireRadius, 10, false);

  // Wire color determination
  let colorHex = connection.wireColor ? parseInt(connection.wireColor.replace('#', ''), 16) : 0x06b6d4;
  if (!connection.wireColor) {
    if (fromPin.id === 'vcc' || toPin.id === 'vcc') {
      colorHex = 0xef4444; // Red for VCC
    } else if (fromPin.id === 'gnd' || toPin.id === 'gnd') {
      colorHex = 0x1e293b; // Dark graphite for GND
    }
  }

  const mat = new THREE.MeshStandardMaterial({
    color: isSelected ? 0x38bdf8 : colorHex,
    roughness: 0.35,
    metalness: 0.25,
    emissive: isSelected ? 0x0284c7 : 0x000000,
    emissiveIntensity: isSelected ? 0.7 : 0,
  });

  const wireMesh = new THREE.Mesh(tubeGeom, mat);
  wireMesh.castShadow = true;

  // Group container for wire + hit box
  const wireGroup = new THREE.Group();
  wireGroup.name = `wire-${connection.id}`;
  wireGroup.userData = {
    type: 'wire',
    connectionId: connection.id,
    connection,
  };

  wireMesh.userData = { ...wireGroup.userData };
  wireGroup.add(wireMesh);

  // Enlarged invisible hit tube for effortless mouse click selection
  const hitRadius = Math.max(wireRadius * 2.2, 1.8);
  const hitGeom = new THREE.TubeGeometry(curve, Math.min(segments, 16), hitRadius, 6, false);
  const hitMat = new THREE.MeshBasicMaterial({
    visible: false,
    wireframe: false,
  });
  const hitMesh = new THREE.Mesh(hitGeom, hitMat);
  hitMesh.userData = { ...wireGroup.userData };
  wireGroup.add(hitMesh);

  // Add terminal rubber boot / crimp rings at start and end
  const bootGeom = new THREE.CylinderGeometry(wireRadius * 1.35, wireRadius * 1.35, 1.2, 8);
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
  });

  const boot1 = new THREE.Mesh(bootGeom, bootMat);
  boot1.position.copy(start);
  boot1.position.y += 0.6;
  boot1.userData = { ...wireGroup.userData };
  wireGroup.add(boot1);

  const boot2 = new THREE.Mesh(bootGeom, bootMat);
  boot2.position.copy(end);
  boot2.position.y += 0.6;
  boot2.userData = { ...wireGroup.userData };
  wireGroup.add(boot2);

  return wireGroup;
}

/**
 * Generates interactive preview wire while dragging/aiming from a pin to mouse cursor
 */
export function createPreviewWireMesh(
  startPos: Vector3D,
  currentMousePos: Vector3D,
  colorHex = 0x38bdf8,
  wireStyle: 'curved' | 'orthogonal' | 'straight' = 'curved'
): THREE.Mesh {
  const start = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
  const end = new THREE.Vector3(currentMousePos.x, currentMousePos.y, currentMousePos.z);

  const dist = start.distanceTo(end);
  let curve: THREE.Curve<THREE.Vector3>;

  if (wireStyle === 'straight') {
    curve = new THREE.LineCurve3(start, end);
  } else if (wireStyle === 'orthogonal') {
    const traceY = Math.max(start.y, end.y) + 1.5;
    const midX = end.x;
    const midZ = start.z;
    const p1 = start;
    const p2 = new THREE.Vector3(start.x, traceY, start.z);
    const p3 = new THREE.Vector3(midX, traceY, midZ);
    const p4 = new THREE.Vector3(end.x, traceY, end.z);
    const p5 = end;
    curve = new THREE.CatmullRomCurve3([p1, p2, p3, p4, p5], false, 'centripetal', 0.2);
  } else {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += Math.max(3.0, dist * 0.25);
    curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  }

  const geom = new THREE.TubeGeometry(curve, 20, 0.45, 8, false);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.88,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'preview-wire';
  return mesh;
}
