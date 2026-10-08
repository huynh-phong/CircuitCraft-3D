import * as THREE from 'three';

export type MinibotState = 'idle' | 'guiding' | 'thinking' | 'warning' | 'success';

export class Minibot3D {
  public group: THREE.Group;
  private visorMesh: THREE.Mesh;
  private visorMat: THREE.MeshBasicMaterial;
  private antennaLight: THREE.PointLight;
  private thrusterCone: THREE.Mesh;

  private state: MinibotState = 'idle';
  private targetPosition: THREE.Vector3 = new THREE.Vector3(50, 25, 30);
  private currentPosition: THREE.Vector3 = new THREE.Vector3(50, 25, 30);
  private timeOffset = 0;
  private isReducedMotion = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'minibot-3d';
    // Ensure Minibot is NOT raycasted by component pickers
    this.group.userData = { isMinibot: true, ignoreRaycast: true };

    // Robot Head / Body (Chubby futuristic egg/orb)
    const bodyGeom = new THREE.SphereGeometry(3.2, 24, 20);
    bodyGeom.scale(1, 1.15, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Ceramic white
      roughness: 0.25,
      metalness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.castShadow = true;
    this.group.add(bodyMesh);

    // Decorative graphite ear pads
    const earGeom = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
    earGeom.rotateZ(Math.PI / 2);
    const earMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });

    const earLeft = new THREE.Mesh(earGeom, earMat);
    earLeft.position.set(-3.2, 0.2, 0);
    this.group.add(earLeft);

    const earRight = new THREE.Mesh(earGeom, earMat);
    earRight.position.set(3.2, 0.2, 0);
    this.group.add(earRight);

    // Curved Glowing Visor (Eyes screen)
    const visorGeom = new THREE.SphereGeometry(2.2, 20, 16, 0, Math.PI, 0, Math.PI / 1.8);
    visorGeom.rotateX(Math.PI / 2);
    this.visorMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 }); // Cyan
    this.visorMesh = new THREE.Mesh(visorGeom, this.visorMat);
    this.visorMesh.position.set(0, 0.6, 1.6);
    this.visorMesh.scale.set(0.9, 0.6, 0.5);
    this.group.add(this.visorMesh);

    // Antenna on top
    const antennaStemGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8);
    const antennaStem = new THREE.Mesh(antennaStemGeom, earMat);
    antennaStem.position.set(0, 4.2, 0);
    this.group.add(antennaStem);

    const tipGeom = new THREE.SphereGeometry(0.4, 12, 12);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const tipMesh = new THREE.Mesh(tipGeom, tipMat);
    tipMesh.position.set(0, 5.0, 0);
    this.group.add(tipMesh);

    this.antennaLight = new THREE.PointLight(0x38bdf8, 1.2, 15);
    this.antennaLight.position.set(0, 5.0, 0);
    this.group.add(this.antennaLight);

    // Bottom hover thruster glow
    const thrusterGeom = new THREE.ConeGeometry(1.0, 2.0, 16, 1, true);
    thrusterGeom.rotateX(Math.PI);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.thrusterCone = new THREE.Mesh(thrusterGeom, thrusterMat);
    this.thrusterCone.position.set(0, -3.8, 0);
    this.group.add(this.thrusterCone);

    this.group.position.copy(this.currentPosition);

    // Check system prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  public setState(state: MinibotState): void {
    this.state = state;
    let colorHex = 0x06b6d4; // Default cyan

    switch (state) {
      case 'idle':
      case 'guiding':
        colorHex = 0x06b6d4; // Cyan
        break;
      case 'thinking':
        colorHex = 0xf59e0b; // Amber pulse
        break;
      case 'warning':
        colorHex = 0xef4444; // Warning Red
        break;
      case 'success':
        colorHex = 0x10b981; // Success Green
        break;
    }

    this.visorMat.color.setHex(colorHex);
    this.antennaLight.color.setHex(colorHex);
  }

  public getState(): MinibotState {
    return this.state;
  }

  public focusOn(target: THREE.Vector3, state: MinibotState = 'guiding'): void {
    // Hover slightly above and to the right of the target
    this.targetPosition.set(target.x + 16, Math.max(22, target.y + 18), target.z + 14);
    this.setState(state);
  }

  public update(delta: number): void {
    this.timeOffset += delta * 2.5;

    // Smooth movement interpolation
    const lerpSpeed = this.isReducedMotion ? 1.0 : 0.06;
    this.currentPosition.lerp(this.targetPosition, lerpSpeed);

    let hoverY = this.currentPosition.y;
    if (!this.isReducedMotion) {
      hoverY += Math.sin(this.timeOffset) * 0.9;
      // Slight gentle tilt bobbing
      this.group.rotation.z = Math.sin(this.timeOffset * 0.7) * 0.08;
      this.group.rotation.x = Math.cos(this.timeOffset * 0.5) * 0.05;
    }

    this.group.position.set(this.currentPosition.x, hoverY, this.currentPosition.z);

    // Thruster scale pulse
    if (!this.isReducedMotion) {
      const pulse = 1.0 + Math.sin(this.timeOffset * 4) * 0.15;
      this.thrusterCone.scale.set(pulse, pulse, pulse);
    }
  }

  public setReducedMotion(enabled: boolean): void {
    this.isReducedMotion = enabled;
  }
}
