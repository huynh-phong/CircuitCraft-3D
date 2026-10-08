import * as THREE from 'three';

export class SceneMaterialRegistry {
  private static instance: SceneMaterialRegistry;

  // PCB Board Materials
  public pcbTopMaterial: THREE.MeshStandardMaterial;
  public pcbEdgeMaterial: THREE.MeshStandardMaterial;
  public pcbPadMaterial: THREE.MeshStandardMaterial;
  public pcbSilkscreenMaterial: THREE.MeshBasicMaterial;

  // Metal Leads and Pins
  public pinLeadMaterial: THREE.MeshStandardMaterial;
  public pinLeadHighlightMaterial: THREE.MeshStandardMaterial;
  public pinHoverMaterial: THREE.MeshBasicMaterial;

  // Component Bodies
  public resistorBodyMaterial: THREE.MeshStandardMaterial;
  public switchMetalMaterial: THREE.MeshStandardMaterial;
  public switchPlasticMaterial: THREE.MeshStandardMaterial;
  public batteryBodyMaterial: THREE.MeshStandardMaterial;
  public batteryCellMaterial: THREE.MeshStandardMaterial;
  public connectorBodyMaterial: THREE.MeshStandardMaterial;
  public potentiometerBodyMaterial: THREE.MeshStandardMaterial;
  public potentiometerKnobMaterial: THREE.MeshStandardMaterial;
  public icBodyMaterial: THREE.MeshStandardMaterial;

  // LED Materials
  private ledMaterials = new Map<string, { off: THREE.MeshPhysicalMaterial; on: THREE.MeshPhysicalMaterial }>();

  // Selection outline
  public selectionBoxMaterial: THREE.LineBasicMaterial;
  public hoverBoxMaterial: THREE.LineBasicMaterial;

  private constructor() {
    // Board Materials
    this.pcbTopMaterial = new THREE.MeshStandardMaterial({
      color: 0x104a36, // Deep green solder mask
      roughness: 0.35,
      metalness: 0.1,
    });

    this.pcbEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xa38048, // FR-4 fiberglass core
      roughness: 0.8,
      metalness: 0.05,
    });

    this.pcbPadMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfb44a, // Gold immersion ENIG / tinned copper pad
      roughness: 0.25,
      metalness: 0.85,
    });

    this.pcbSilkscreenMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });

    // Pin materials
    this.pinLeadMaterial = new THREE.MeshStandardMaterial({
      color: 0xd1d5db, // Tin-plated silver copper wire
      metalness: 0.9,
      roughness: 0.25,
    });

    this.pinLeadHighlightMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Cyan glow when wiring
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
    });

    this.pinHoverMaterial = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
    });

    // Component generic materials
    this.resistorBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7b88e, // Light tan axial ceramic body
      roughness: 0.5,
      metalness: 0.05,
    });

    this.switchMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0xb0b8c0,
      metalness: 0.85,
      roughness: 0.3,
    });

    this.switchPlasticMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.1,
    });

    this.batteryBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Matte black housing
      roughness: 0.7,
      metalness: 0.1,
    });

    this.batteryCellMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Blue industrial wrapper
      roughness: 0.4,
      metalness: 0.3,
    });

    this.connectorBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x059669, // Emerald terminal block
      roughness: 0.5,
      metalness: 0.1,
    });

    this.potentiometerBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Metal body
      metalness: 0.8,
      roughness: 0.3,
    });

    this.potentiometerKnobMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.2,
    });

    this.icBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181b, // Matte dark epoxy package
      roughness: 0.65,
      metalness: 0.1,
    });

    // Selection indicators
    this.selectionBoxMaterial = new THREE.LineBasicMaterial({
      color: 0x06b6d4, // Vibrant cyan
      linewidth: 2,
    });

    this.hoverBoxMaterial = new THREE.LineBasicMaterial({
      color: 0x64748b,
      linewidth: 1,
      transparent: true,
      opacity: 0.5,
    });

    this.initLedMaterials();
  }

  private initLedMaterials() {
    const colors: Record<string, { hex: number; emissive: number }> = {
      red: { hex: 0xef4444, emissive: 0xff0000 },
      green: { hex: 0x22c55e, emissive: 0x00ff44 },
      blue: { hex: 0x3b82f6, emissive: 0x0088ff },
      yellow: { hex: 0xeab308, emissive: 0xffcc00 },
      white: { hex: 0xf8fafc, emissive: 0xffffff },
    };

    for (const [key, val] of Object.entries(colors)) {
      const offMat = new THREE.MeshPhysicalMaterial({
        color: val.hex,
        transmission: 0.65,
        opacity: 0.85,
        transparent: true,
        roughness: 0.2,
        metalness: 0.05,
        ior: 1.5,
      });

      const onMat = new THREE.MeshPhysicalMaterial({
        color: val.hex,
        transmission: 0.3,
        opacity: 0.95,
        transparent: true,
        roughness: 0.1,
        metalness: 0.05,
        emissive: val.emissive,
        emissiveIntensity: 1.8,
        ior: 1.5,
      });

      this.ledMaterials.set(key, { off: offMat, on: onMat });
    }
  }

  public getLedMaterial(colorKey = 'red', isOn = false): THREE.Material {
    const pair = this.ledMaterials.get(colorKey) || this.ledMaterials.get('red')!;
    return isOn ? pair.on : pair.off;
  }

  public static getInstance(): SceneMaterialRegistry {
    if (!SceneMaterialRegistry.instance) {
      SceneMaterialRegistry.instance = new SceneMaterialRegistry();
    }
    return SceneMaterialRegistry.instance;
  }
}
