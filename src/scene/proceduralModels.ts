import * as THREE from 'three';
import { ComponentInstance, ComponentDefinition } from '../domain/project/types';
import { SceneMaterialRegistry } from './materials';
import { getResistorColorBands } from '../domain/components/colorCode';

/**
 * Creates 3D Procedural Mesh groups for each electronic component type.
 * Y=0 is the PCB top surface plane.
 */
export function createComponentMesh(
  instance: ComponentInstance,
  definition: ComponentDefinition,
  options?: { isSimulationOn?: boolean; switchClosed?: boolean }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `comp-${instance.instanceId}`;
  group.userData = {
    type: 'component',
    instanceId: instance.instanceId,
    definitionId: definition.definitionId,
  };

  const matReg = SceneMaterialRegistry.getInstance();

  switch (definition.definitionId) {
    case 'dc-source':
    case 'dc_power_supply':
      buildDCSource(group, instance, matReg);
      break;
    case 'resistor':
    case 'resistor_axial':
      buildResistor(group, instance, matReg);
      break;
    case 'led':
    case 'led_basic':
      buildLED(group, instance, matReg, options?.isSimulationOn || false);
      break;
    case 'switch':
    case 'switch_spst':
      buildSwitch(group, instance, matReg, options?.switchClosed);
      break;
    case 'connector':
    case 'pin-header':
    case 'terminal_block_2pin':
      buildConnector(group, instance, matReg);
      break;
    case 'potentiometer':
      buildPotentiometer(group, instance, matReg);
      break;
    case 'capacitor':
      buildCapacitor(group, instance, matReg);
      break;
    case 'pushbutton':
      buildPushbutton(group, instance, matReg);
      break;
    case 'diode':
      buildDiode(group, instance, matReg);
      break;
    case 'buzzer':
      buildBuzzer(group, instance, matReg, options?.isSimulationOn || false);
      break;
    case 'ldr':
      buildLDR(group, instance, matReg);
      break;
    case 'relay':
      buildRelay(group, instance, matReg);
      break;
    case 'ne555':
    case 'ic-dip8':
      buildNE555(group, instance, matReg);
      break;
    case 'logic-and':
    case 'logic_and':
      buildLogicGate(group, instance, matReg, 'AND');
      break;
    case 'arduino-uno':
    case 'arduino_uno':
      buildArduinoUno(group, instance, matReg, options?.isSimulationOn || false);
      break;
    case 'temp-sensor':
    case 'temp_sensor':
      buildTempSensor(group, instance, matReg);
      break;
    case 'transistor-npn':
      buildTransistorNPN(group, instance, matReg);
      break;
    case 'ultrasonic-sensor':
    case 'ultrasonic-sr04':
      buildUltrasonicSensor(group, instance, matReg);
      break;
    case 'servo-motor':
    case 'servo-sg90':
      buildServoMotor(group, instance, matReg);
      break;
    case 'rgb-led':
      buildRgbLed(group, instance, matReg, options?.isSimulationOn || false);
      break;
    case '7seg-display':
      buildSevenSegment(group, instance, matReg, options?.isSimulationOn || false);
      break;
    case 'oled-i2c':
      buildOledDisplay(group, instance, matReg, options?.isSimulationOn || false);
      break;
    case 'dc-motor':
      buildDcMotor(group, instance, matReg);
      break;
    case 'voltage-reg-7805':
      buildVoltageReg7805(group, instance, matReg);
      break;
    default:
      buildGenericComponent(group, instance, definition, matReg);
  }

  // Ensure 100% of defined pins have prominent, easily clickable pin targets
  for (const pin of definition.pins) {
    const existing = group.getObjectByName(`pin-${instance.instanceId}-${pin.id}`);
    if (!existing) {
      const pinTarget = createPinTarget(
        pin.localOffset.x,
        pin.localOffset.y,
        pin.localOffset.z,
        instance.instanceId,
        pin.id,
        pin.name
      );
      group.add(pinTarget);
    }
  }

  // Position and rotate
  group.position.set(instance.position.x, instance.position.y, instance.position.z);
  group.rotation.set(
    (instance.rotation.x * Math.PI) / 180,
    (instance.rotation.y * Math.PI) / 180,
    (instance.rotation.z * Math.PI) / 180
  );

  return group;
}

/**
 * DC Power Source (Battery Pack 5V)
 */
function buildDCSource(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Battery enclosure base
  const baseGeom = new THREE.BoxGeometry(26, 8, 16);
  const baseMesh = new THREE.Mesh(baseGeom, mats.batteryBodyMaterial);
  baseMesh.position.set(0, 4, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Two cylindrical battery cells inside tray
  const cellGeom = new THREE.CylinderGeometry(3.2, 3.2, 22, 16);
  cellGeom.rotateZ(Math.PI / 2);

  const cell1 = new THREE.Mesh(cellGeom, mats.batteryCellMaterial);
  cell1.position.set(0, 7.5, -4);
  cell1.castShadow = true;
  group.add(cell1);

  const cell2 = new THREE.Mesh(cellGeom, mats.batteryCellMaterial);
  cell2.position.set(0, 7.5, 4);
  cell2.castShadow = true;
  group.add(cell2);

  // Metal Terminal Pins
  const pinVcc = createPinTarget(-8, 3, 0, instance.instanceId, 'vcc', 'VCC (+)');
  group.add(pinVcc);

  const pinGnd = createPinTarget(8, 3, 0, instance.instanceId, 'gnd', 'GND (-)');
  group.add(pinGnd);
}

/**
 * Resistor (4-Band Axial Resistor with true color code)
 */
function buildResistor(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  const ohms = instance.parameters?.resistance || 220;
  const bands = getResistorColorBands(ohms);

  // Main ceramic cylinder body
  const bodyGeom = new THREE.CylinderGeometry(1.8, 1.8, 8, 16);
  bodyGeom.rotateZ(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeom, mats.resistorBodyMaterial);
  bodyMesh.position.set(0, 3, 0);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Rounded end caps
  const capGeom = new THREE.SphereGeometry(1.8, 12, 12);
  const capLeft = new THREE.Mesh(capGeom, mats.resistorBodyMaterial);
  capLeft.position.set(-4, 3, 0);
  capLeft.scale.set(0.6, 1, 1);
  group.add(capLeft);

  const capRight = new THREE.Mesh(capGeom, mats.resistorBodyMaterial);
  capRight.position.set(4, 3, 0);
  capRight.scale.set(0.6, 1, 1);
  group.add(capRight);

  // 4 Color Bands
  const bandGeom = new THREE.CylinderGeometry(1.84, 1.84, 0.7, 16);
  bandGeom.rotateZ(Math.PI / 2);

  const hexColors = [bands.hex1, bands.hex2, bands.hexMultiplier, bands.hexTolerance];
  const xPositions = [-2.5, -1.0, 0.8, 2.8];

  hexColors.forEach((hex, idx) => {
    const bandMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.3,
      metalness: idx === 3 ? 0.8 : 0.1, // Metallic for gold tolerance
    });
    const bMesh = new THREE.Mesh(bandGeom, bandMat);
    bMesh.position.set(xPositions[idx], 3, 0);
    group.add(bMesh);
  });

  // Wire leads going down into PCB
  // Pin 1 at x = -7, pin 2 at x = +7
  const leadMat = mats.pinLeadMaterial;

  // Left lead: from body (-4, 3, 0) -> bend to (-7, 3, 0) -> down to (-7, 0, 0)
  const leftLead = createBentAxialLead(leadMat, -4, -7);
  group.add(leftLead);

  // Right lead: from body (4, 3, 0) -> bend to (7, 3, 0) -> down to (7, 0, 0)
  const rightLead = createBentAxialLead(leadMat, 4, 7);
  group.add(rightLead);

  // Pin interaction targets
  const pin1 = createPinTarget(-7, 1, 0, instance.instanceId, 'pin1', 'Chân 1');
  const pin2 = createPinTarget(7, 1, 0, instance.instanceId, 'pin2', 'Chân 2');
  group.add(pin1);
  group.add(pin2);
}

/**
 * 5mm LED (Translucent lens, reflector cup, leads)
 */
function buildLED(
  group: THREE.Group,
  instance: ComponentInstance,
  mats: SceneMaterialRegistry,
  isSimulationOn: boolean
) {
  const color = instance.parameters?.color || 'red';
  const ledMat = mats.getLedMaterial(color, isSimulationOn);

  // Cylindrical base with lower rim lip
  const rimGeom = new THREE.CylinderGeometry(2.8, 2.8, 1.0, 20);
  const rimMesh = new THREE.Mesh(rimGeom, ledMat);
  rimMesh.position.set(0, 3.5, 0);
  group.add(rimMesh);

  // Main cylinder
  const cylGeom = new THREE.CylinderGeometry(2.5, 2.5, 4.5, 20);
  const cylMesh = new THREE.Mesh(cylGeom, ledMat);
  cylMesh.position.set(0, 6.25, 0);
  group.add(cylMesh);

  // Hemispherical dome
  const domeGeom = new THREE.SphereGeometry(2.5, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMesh = new THREE.Mesh(domeGeom, ledMat);
  domeMesh.position.set(0, 8.5, 0);
  group.add(domeMesh);

  // Flat notch on cathode side (pin 2 = cathode at +2.54)
  const notchGeom = new THREE.BoxGeometry(0.6, 1.1, 1.5);
  const notchMesh = new THREE.Mesh(notchGeom, ledMat);
  notchMesh.position.set(2.6, 3.5, 0);
  group.add(notchMesh);

  // Wire leads going down into board
  const wireGeom = new THREE.CylinderGeometry(0.3, 0.3, 3.5, 8);

  // Anode (+) at x = -2.54
  const anodeLead = new THREE.Mesh(wireGeom, mats.pinLeadMaterial);
  anodeLead.position.set(-2.54, 1.75, 0);
  group.add(anodeLead);

  // Cathode (-) at x = +2.54
  const cathodeLead = new THREE.Mesh(wireGeom, mats.pinLeadMaterial);
  cathodeLead.position.set(2.54, 1.75, 0);
  group.add(cathodeLead);

  // If simulation is on, add point light glow effect
  if (isSimulationOn) {
    const hexColors: Record<string, number> = {
      red: 0xff0000,
      green: 0x00ff44,
      blue: 0x0088ff,
      yellow: 0xffcc00,
      white: 0xffffff,
    };
    const lightColor = hexColors[color] || 0xff0000;
    const glowLight = new THREE.PointLight(lightColor, 2.5, 40, 1.5);
    glowLight.position.set(0, 8, 0);
    group.add(glowLight);

    // Glowing halo sprite / sphere
    const haloGeom = new THREE.SphereGeometry(3.5, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({
      color: lightColor,
      transparent: true,
      opacity: 0.35,
    });
    const halo = new THREE.Mesh(haloGeom, haloMat);
    halo.position.set(0, 7.5, 0);
    group.add(halo);
  }

  // Pin targets
  const pinAnode = createPinTarget(-2.54, 1, 0, instance.instanceId, 'anode', 'Anode (+)');
  const pinCathode = createPinTarget(2.54, 1, 0, instance.instanceId, 'cathode', 'Cathode (-)');
  group.add(pinAnode);
  group.add(pinCathode);
}

/**
 * Slide Switch (SPST)
 */
function buildSwitch(
  group: THREE.Group,
  instance: ComponentInstance,
  mats: SceneMaterialRegistry,
  switchClosedOverride?: boolean
) {
  // Metallic rectangular enclosure
  const bodyGeom = new THREE.BoxGeometry(10, 5, 6);
  const bodyMesh = new THREE.Mesh(bodyGeom, mats.switchMetalMaterial);
  bodyMesh.position.set(0, 3.5, 0);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Slider slot
  const slotGeom = new THREE.BoxGeometry(7, 0.5, 1.8);
  const slotMesh = new THREE.Mesh(slotGeom, mats.switchPlasticMaterial);
  slotMesh.position.set(0, 6.1, 0);
  group.add(slotMesh);

  // Slider knob (shifts left when open, shifts right when closed)
  const isClosed = switchClosedOverride ?? (instance.state?.open === false);
  const knobX = isClosed ? 2.0 : -2.0;

  const knobGeom = new THREE.BoxGeometry(2.2, 3.5, 2.0);
  const knobMesh = new THREE.Mesh(knobGeom, mats.switchPlasticMaterial);
  knobMesh.position.set(knobX, 7.5, 0);
  knobMesh.castShadow = true;
  knobMesh.name = 'switch-toggle-knob';
  knobMesh.userData = { type: 'switch-toggle', componentId: instance.instanceId };
  group.add(knobMesh);

  // Bottom leads to PCB
  const leadGeom = new THREE.CylinderGeometry(0.35, 0.35, 2.0, 8);

  const l1 = new THREE.Mesh(leadGeom, mats.pinLeadMaterial);
  l1.position.set(-4, 1, 0);
  group.add(l1);

  const l2 = new THREE.Mesh(leadGeom, mats.pinLeadMaterial);
  l2.position.set(4, 1, 0);
  group.add(l2);

  const pin1 = createPinTarget(-4, 1, 0, instance.instanceId, 'pin1', 'Tiếp điểm 1');
  const pin2 = createPinTarget(4, 1, 0, instance.instanceId, 'pin2', 'Tiếp điểm 2');
  group.add(pin1);
  group.add(pin2);
}

/**
 * Terminal Connector
 */
function buildConnector(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Green plastic block
  const blockGeom = new THREE.BoxGeometry(10, 8, 9);
  const blockMesh = new THREE.Mesh(blockGeom, mats.connectorBodyMaterial);
  blockMesh.position.set(0, 4, 0);
  blockMesh.castShadow = true;
  group.add(blockMesh);

  // Two metallic clamp screws on top
  const screwGeom = new THREE.CylinderGeometry(1.2, 1.2, 1.0, 12);
  const screw1 = new THREE.Mesh(screwGeom, mats.switchMetalMaterial);
  screw1.position.set(-2.54, 8.2, 0);
  group.add(screw1);

  const screw2 = new THREE.Mesh(screwGeom, mats.switchMetalMaterial);
  screw2.position.set(2.54, 8.2, 0);
  group.add(screw2);

  const pin1 = createPinTarget(-2.54, 2, 0, instance.instanceId, 'pin1', 'Terminal 1');
  const pin2 = createPinTarget(2.54, 2, 0, instance.instanceId, 'pin2', 'Terminal 2');
  group.add(pin1);
  group.add(pin2);
}

/**
 * Rotary Potentiometer
 */
function buildPotentiometer(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Round metallic base
  const baseGeom = new THREE.CylinderGeometry(5.5, 5.5, 5, 20);
  const baseMesh = new THREE.Mesh(baseGeom, mats.potentiometerBodyMaterial);
  baseMesh.position.set(0, 3.5, 0);
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // Rotating central shaft
  const shaftGeom = new THREE.CylinderGeometry(1.5, 1.5, 6, 16);
  const shaft = new THREE.Mesh(shaftGeom, mats.switchMetalMaterial);
  shaft.position.set(0, 8, 0);
  group.add(shaft);

  // Plastic rotary knob
  const knobGeom = new THREE.CylinderGeometry(4.0, 4.5, 4, 20);
  const knob = new THREE.Mesh(knobGeom, mats.potentiometerKnobMaterial);
  knob.position.set(0, 10, 0);
  group.add(knob);

  // Notch indicator on knob
  const notchGeom = new THREE.BoxGeometry(0.8, 4.1, 1.2);
  const notchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const notch = new THREE.Mesh(notchGeom, notchMat);
  notch.position.set(0, 10, -4.0);
  group.add(notch);

  // 3 Pins (Pin 1, Wiper, Pin 2)
  const pin1 = createPinTarget(-4, 1, 3, instance.instanceId, 'pin1', 'Chân 1');
  const wiper = createPinTarget(0, 1, -3, instance.instanceId, 'wiper', 'Con chạy (Wiper)');
  const pin2 = createPinTarget(4, 1, 3, instance.instanceId, 'pin2', 'Chân 2');
  group.add(pin1);
  group.add(wiper);
  group.add(pin2);
}

/**
 * Electrolytic Capacitor (Aluminum Can with Negative Stripe)
 */
function buildCapacitor(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Can cylinder
  const canGeom = new THREE.CylinderGeometry(4.0, 4.0, 12, 20);
  const canMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
    roughness: 0.3,
  });
  const can = new THREE.Mesh(canGeom, canMat);
  can.position.set(0, 7, 0);
  can.castShadow = true;
  group.add(can);

  // Top aluminum vent cap
  const ventGeom = new THREE.CylinderGeometry(3.9, 3.9, 0.4, 20);
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
  const vent = new THREE.Mesh(ventGeom, ventMat);
  vent.position.set(0, 13, 0);
  group.add(vent);

  // Negative polarity white stripe on one side
  const stripeGeom = new THREE.CylinderGeometry(4.05, 4.05, 11.6, 20, 1, false, Math.PI * 0.75, Math.PI * 0.5);
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const stripe = new THREE.Mesh(stripeGeom, stripeMat);
  stripe.position.set(0, 7, 0);
  group.add(stripe);
}

/**
 * Pushbutton (Tactile Switch 4-pin)
 */
function buildPushbutton(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Metal/Plastic enclosure base
  const baseGeom = new THREE.BoxGeometry(10, 4.5, 10);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.set(0, 2.25, 0);
  base.castShadow = true;
  group.add(base);

  // Metal cover plate
  const plateGeom = new THREE.BoxGeometry(9.6, 0.4, 9.6);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.8, roughness: 0.2 });
  const plate = new THREE.Mesh(plateGeom, plateMat);
  plate.position.set(0, 4.6, 0);
  group.add(plate);

  // Round tactile actuator button (pressed down if pressed)
  const isPressed = Boolean(instance.parameters?.pressed);
  const btnHeight = isPressed ? 1.5 : 3.0;
  const btnGeom = new THREE.CylinderGeometry(2.4, 2.4, btnHeight, 16);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }); // Red button
  const btn = new THREE.Mesh(btnGeom, btnMat);
  btn.position.set(0, 4.6 + btnHeight / 2, 0);
  btn.castShadow = true;
  group.add(btn);
}

/**
 * Diode 1N4007 (DO-41 package with cathode silver band)
 */
function buildDiode(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Black molded body
  const bodyGeom = new THREE.CylinderGeometry(2.2, 2.2, 9, 16);
  bodyGeom.rotateZ(Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 3, 0);
  body.castShadow = true;
  group.add(body);

  // Cathode stripe (Silver band near cathode pin)
  const bandGeom = new THREE.CylinderGeometry(2.25, 2.25, 1.8, 16);
  bandGeom.rotateZ(Math.PI / 2);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 });
  const band = new THREE.Mesh(bandGeom, bandMat);
  band.position.set(3.2, 3, 0);
  group.add(band);

  // Metal axial leads bent down
  const lead1 = createBentAxialLead(mats.pinLeadMaterial, -4.5, -6.5);
  const lead2 = createBentAxialLead(mats.pinLeadMaterial, 4.5, 6.5);
  group.add(lead1 as any);
  group.add(lead2 as any);
}

/**
 * Buzzer (Active 5V round acoustic transducer)
 */
function buildBuzzer(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry, isSimOn: boolean) {
  // Cylindrical black housing
  const cylGeom = new THREE.CylinderGeometry(5.5, 5.5, 9, 24);
  const cylMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
  const cyl = new THREE.Mesh(cylGeom, cylMat);
  cyl.position.set(0, 5, 0);
  cyl.castShadow = true;
  group.add(cyl);

  // Center acoustic port hole
  const holeGeom = new THREE.CylinderGeometry(1.6, 1.6, 0.5, 16);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
  const hole = new THREE.Mesh(holeGeom, holeMat);
  hole.position.set(0, 9.6, 0);
  group.add(hole);

  // Polarity "+" embossed marker
  const plusGeom = new THREE.BoxGeometry(2, 0.4, 0.6);
  const plusMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const plus = new THREE.Mesh(plusGeom, plusMat);
  plus.position.set(-3, 9.6, 0);
  group.add(plus);

  // Acoustic sound waves when buzzer active
  if (isSimOn) {
    const waveGeom = new THREE.RingGeometry(2.5, 3.2, 16);
    waveGeom.rotateX(-Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const wave = new THREE.Mesh(waveGeom, waveMat);
    wave.position.set(0, 11, 0);
    group.add(wave);
  }
}

/**
 * Light Dependent Resistor (LDR)
 */
function buildLDR(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Ceramic disc base
  const discGeom = new THREE.CylinderGeometry(4.0, 4.0, 2.0, 20);
  const discMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }); // Amber ceramic
  const disc = new THREE.Mesh(discGeom, discMat);
  disc.position.set(0, 6, 0);
  disc.castShadow = true;
  group.add(disc);

  // Clear resin top window
  const topGeom = new THREE.CylinderGeometry(3.8, 3.8, 0.5, 20);
  const topMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.7, roughness: 0.1 });
  const top = new THREE.Mesh(topGeom, topMat);
  top.position.set(0, 7.2, 0);
  group.add(top);

  // Cadmium Sulfide serpentine track lines
  const trackGeom = new THREE.BoxGeometry(4.5, 0.1, 1.2);
  const trackMat = new THREE.MeshBasicMaterial({ color: 0xb45309 });
  const track = new THREE.Mesh(trackGeom, trackMat);
  track.position.set(0, 7.4, 0);
  group.add(track);
}

/**
 * 5V Relay (Electromechanical sealed cube)
 */
function buildRelay(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Sealed blue cube (Songle type)
  const cubeGeom = new THREE.BoxGeometry(18, 14, 15);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Vibrant electric blue
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(cubeGeom, cubeMat);
  cube.position.set(0, 7, 0);
  cube.castShadow = true;
  group.add(cube);

  // Top label print
  const labelGeom = new THREE.BoxGeometry(14, 0.2, 11);
  const labelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const label = new THREE.Mesh(labelGeom, labelMat);
  label.position.set(0, 14.1, 0);
  group.add(label);
}

/**
 * NE555 Timer IC (DIP-8 Package)
 */
function buildNE555(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // DIP-8 Black plastic epoxy body
  const bodyGeom = new THREE.BoxGeometry(12, 4.5, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 3, 0);
  body.castShadow = true;
  group.add(body);

  // Pin 1 Index Notch (Half-cylinder indentation at front end)
  const notchGeom = new THREE.CylinderGeometry(0.8, 0.8, 4.6, 12, 1, false, 0, Math.PI);
  notchGeom.rotateX(Math.PI / 2);
  const notchMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
  const notch = new THREE.Mesh(notchGeom, notchMat);
  notch.position.set(-6, 3, 0);
  group.add(notch);

  // White text silkscreen indicator
  const textGeom = new THREE.BoxGeometry(6, 0.1, 3);
  const textMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
  const text = new THREE.Mesh(textGeom, textMat);
  text.position.set(0, 5.3, 0);
  group.add(text);
}

/**
 * Logic Gate IC (DIP-14 Package)
 */
function buildLogicGate(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry, type: string) {
  // DIP-14 longer body
  const bodyGeom = new THREE.BoxGeometry(18, 4.5, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 3, 0);
  body.castShadow = true;
  group.add(body);

  // Silkscreen gate logo
  const gateGeom = new THREE.BoxGeometry(8, 0.1, 3.5);
  const gateMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const gate = new THREE.Mesh(gateGeom, gateMat);
  gate.position.set(0, 5.3, 0);
  group.add(gate);
}

/**
 * Arduino UNO R3 (Full Microcontroller Board)
 */
function buildArduinoUno(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry, isSimOn: boolean) {
  // Arduino Blue PCB Board
  const pcbGeom = new THREE.BoxGeometry(68, 2.0, 53);
  const pcbMat = new THREE.MeshStandardMaterial({
    color: 0x00838f, // Authentic Teal/Arduino Blue
    roughness: 0.3,
    metalness: 0.1,
  });
  const pcb = new THREE.Mesh(pcbGeom, pcbMat);
  pcb.position.set(0, 1.0, 0);
  pcb.castShadow = true;
  pcb.receiveShadow = true;
  group.add(pcb);

  // Silver USB Type-B Port
  const usbGeom = new THREE.BoxGeometry(16, 11, 12);
  const usbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.15 });
  const usb = new THREE.Mesh(usbGeom, usbMat);
  usb.position.set(-27, 7.5, -15);
  usb.castShadow = true;
  group.add(usb);

  // Black DC Power Barrel Jack
  const dcGeom = new THREE.BoxGeometry(14, 11, 9);
  const dcMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const dc = new THREE.Mesh(dcGeom, dcMat);
  dc.position.set(-27, 7.5, 18);
  dc.castShadow = true;
  group.add(dc);

  // ATmega328P DIP-28 Chip
  const mcuGeom = new THREE.BoxGeometry(34, 4.5, 8);
  const mcuMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const mcu = new THREE.Mesh(mcuGeom, mcuMat);
  mcu.position.set(10, 4.25, 6);
  mcu.castShadow = true;
  group.add(mcu);

  // Female Pin Header strips (Black)
  const headerMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.8 });

  // Top digital header
  const dHeaderGeom = new THREE.BoxGeometry(42, 8.5, 3.5);
  const dHeader = new THREE.Mesh(dHeaderGeom, headerMat);
  dHeader.position.set(10, 6.25, -23);
  group.add(dHeader);

  // Bottom analog & power header
  const pHeaderGeom = new THREE.BoxGeometry(46, 8.5, 3.5);
  const pHeader = new THREE.Mesh(pHeaderGeom, headerMat);
  pHeader.position.set(6, 6.25, 23);
  group.add(pHeader);

  // D13 Onboard LED (Orange/Amber)
  const ledD13Geom = new THREE.BoxGeometry(2, 1, 1.5);
  const isD13Lit = isSimOn;
  const ledD13Mat = new THREE.MeshStandardMaterial({
    color: isD13Lit ? 0xf59e0b : 0x78350f,
    emissive: isD13Lit ? 0xf59e0b : 0x000000,
    emissiveIntensity: isD13Lit ? 1.8 : 0,
  });
  const ledD13 = new THREE.Mesh(ledD13Geom, ledD13Mat);
  ledD13.position.set(-4, 2.5, -8);
  group.add(ledD13);

  // Power ON LED (Green)
  const onLedGeom = new THREE.BoxGeometry(1.5, 1, 1.5);
  const onLedMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 1.2,
  });
  const onLed = new THREE.Mesh(onLedGeom, onLedMat);
  onLed.position.set(-8, 2.5, -4);
  group.add(onLed);
}

/**
 * LM35 Temperature Sensor (TO-92 package)
 */
function buildTempSensor(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // TO-92 Semi-cylindrical body
  const bodyGeom = new THREE.CylinderGeometry(2.5, 2.5, 5.5, 16, 1, false, 0, Math.PI);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 4.5, 0);
  body.castShadow = true;
  group.add(body);

  // Flat front face
  const faceGeom = new THREE.BoxGeometry(5.0, 5.5, 0.4);
  const face = new THREE.Mesh(faceGeom, bodyMat);
  face.position.set(0, 4.5, 0);
  group.add(face);
}

/**
 * Generic Fallback Component
 */
function buildGenericComponent(
  group: THREE.Group,
  instance: ComponentInstance,
  def: ComponentDefinition,
  mats: SceneMaterialRegistry
) {
  const geom = new THREE.BoxGeometry(def.dimensions.x, def.dimensions.y, def.dimensions.z);
  const mesh = new THREE.Mesh(geom, mats.resistorBodyMaterial);
  mesh.position.set(0, def.dimensions.y / 2, 0);
  group.add(mesh);

  for (const p of def.pins) {
    const pinTarget = createPinTarget(
      p.localOffset.x,
      p.localOffset.y,
      p.localOffset.z,
      instance.instanceId,
      p.id,
      p.name
    );
    group.add(pinTarget);
  }
}

/**
 * Helper to build interactive, highly visible pin terminal target for raycasting and wiring
 */
function createPinTarget(
  x: number,
  y: number,
  z: number,
  componentId: string,
  pinId: string,
  name: string
): THREE.Group {
  const pinGroup = new THREE.Group();
  pinGroup.name = `pin-${componentId}-${pinId}`;
  pinGroup.position.set(x, 0, z);

  const sharedUserData = {
    type: 'pin',
    componentId,
    pinId,
    name,
    isPin: true,
    localOffset: { x, y, z },
  };
  pinGroup.userData = sharedUserData;

  const matReg = SceneMaterialRegistry.getInstance();

  // 1. Pad collar ring at board surface (gold/copper PCB pad)
  const padGeom = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 16);
  const padMesh = new THREE.Mesh(padGeom, matReg.pcbPadMaterial);
  padMesh.position.set(0, 0.15, 0);
  padMesh.userData = sharedUserData;
  pinGroup.add(padMesh);

  // 2. Vertical pin post / lead
  const postHeight = Math.max(1.0, y);
  const postGeom = new THREE.CylinderGeometry(0.45, 0.45, postHeight, 10);
  const postMesh = new THREE.Mesh(postGeom, matReg.pinLeadMaterial);
  postMesh.position.set(0, postHeight / 2, 0);
  postMesh.userData = sharedUserData;
  pinGroup.add(postMesh);

  // 3. Shiny spherical contact terminal head at designated pin height
  const sphereGeom = new THREE.SphereGeometry(0.85, 12, 12);
  const sphereMesh = new THREE.Mesh(sphereGeom, matReg.pinLeadMaterial);
  sphereMesh.position.set(0, y, 0);
  sphereMesh.userData = sharedUserData;
  pinGroup.add(sphereMesh);

  // 4. Color identification ring
  let collarHex = 0x38bdf8; // Cyan default
  if (pinId === 'vcc' || pinId === 'anode' || pinId.includes('+')) {
    collarHex = 0xef4444; // Red
  } else if (pinId === 'gnd' || pinId === 'cathode' || pinId.includes('-')) {
    collarHex = 0x0f172a; // Dark slate
  } else if (pinId === 'wiper' || pinId.includes('sig')) {
    collarHex = 0xf59e0b; // Amber
  }

  const ringGeom = new THREE.CylinderGeometry(0.7, 0.7, 0.35, 12);
  const ringMat = new THREE.MeshStandardMaterial({
    color: collarHex,
    roughness: 0.3,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.position.set(0, Math.max(0.4, y - 0.6), 0);
  ringMesh.userData = sharedUserData;
  pinGroup.add(ringMesh);

  // 5. Enlarged invisible collider sphere for effortless raycast clicking (3.8mm radius)
  const hitGeom = new THREE.SphereGeometry(3.8, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({
    visible: false,
    wireframe: false,
  });
  const hitMesh = new THREE.Mesh(hitGeom, hitMat);
  hitMesh.position.set(0, y, 0);
  hitMesh.userData = sharedUserData;
  pinGroup.add(hitMesh);

  return pinGroup;
}

/**
 * Creates bent wire lead for axial through-hole resistor
 */
function createBentAxialLead(mat: THREE.Material, fromX: number, toX: number): THREE.Line {
  const points = [
    new THREE.Vector3(fromX, 3, 0),
    new THREE.Vector3(toX, 3, 0),
    new THREE.Vector3(toX, 0, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
  const geom = new THREE.TubeGeometry(curve, 16, 0.3, 8, false);
  const mesh = new THREE.Mesh(geom, mat);
  return mesh as any;
}

function createPinLeadMesh(mat: THREE.Material, ringHex?: number): THREE.Group {
  const grp = new THREE.Group();
  const wireGeom = new THREE.CylinderGeometry(0.4, 0.4, 2.5, 8);
  const wireMesh = new THREE.Mesh(wireGeom, mat);
  grp.add(wireMesh);

  if (ringHex !== undefined) {
    const ringGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.6, 12);
    const ringMat = new THREE.MeshStandardMaterial({ color: ringHex, roughness: 0.5 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.set(0, 1.2, 0);
    grp.add(ring);
  }
  return grp;
}

/**
 * NPN Transistor (TO-92 package)
 */
function buildTransistorNPN(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  const bodyGeom = new THREE.CylinderGeometry(2.5, 2.5, 6, 16, 1, false, 0, Math.PI);
  const bodyMesh = new THREE.Mesh(bodyGeom, mats.icBodyMaterial);
  bodyMesh.position.set(0, 5, 0);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const flatFaceGeom = new THREE.PlaneGeometry(5, 6);
  const flatMesh = new THREE.Mesh(flatFaceGeom, mats.icBodyMaterial);
  flatMesh.position.set(0, 5, 0);
  flatMesh.rotation.y = Math.PI / 2;
  group.add(flatMesh);

  // 3 leads
  const pinOffsets = [-2.54, 0, 2.54];
  for (const px of pinOffsets) {
    const leadGeom = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    const lead = new THREE.Mesh(leadGeom, mats.pinLeadMaterial);
    lead.position.set(px, 1.5, px === 0 ? 1.5 : 0);
    group.add(lead);
  }
}

/**
 * Ultrasonic Sensor (HC-SR04)
 */
function buildUltrasonicSensor(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // PCB Substrate
  const pcbGeom = new THREE.BoxGeometry(45, 1.6, 20);
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
  const pcb = new THREE.Mesh(pcbGeom, pcbMat);
  pcb.position.set(0, 10, 0);
  pcb.rotation.x = Math.PI / 2;
  group.add(pcb);

  // Transducer Cans (Transmitter & Receiver)
  const canGeom = new THREE.CylinderGeometry(8, 8, 12, 24);
  canGeom.rotateX(Math.PI / 2);
  const canMat = new THREE.MeshStandardMaterial({ color: 0xc0c4cc, metalness: 0.8, roughness: 0.25 });

  const canLeft = new THREE.Mesh(canGeom, canMat);
  canLeft.position.set(-13, 10, -6);
  group.add(canLeft);

  const canRight = new THREE.Mesh(canGeom, canMat);
  canRight.position.set(13, 10, -6);
  group.add(canRight);

  // Crystal oscillator
  const oscGeom = new THREE.BoxGeometry(8, 3, 3);
  const oscMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });
  const osc = new THREE.Mesh(oscGeom, oscMat);
  osc.position.set(0, 10, 2);
  group.add(osc);
}

/**
 * SG90 Micro Servo Motor
 */
function buildServoMotor(group: THREE.Group, instance: ComponentInstance, mats: SceneMaterialRegistry) {
  // Blue translucent plastic casing
  const bodyGeom = new THREE.BoxGeometry(23, 22, 12);
  const servoMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const body = new THREE.Mesh(bodyGeom, servoMat);
  body.position.set(0, 12, 0);
  group.add(body);

  // Top gear output turret
  const gearGeom = new THREE.CylinderGeometry(4.5, 4.5, 4, 16);
  const gearMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const gear = new THREE.Mesh(gearGeom, gearMat);
  gear.position.set(5, 25, 0);
  group.add(gear);

  // White horn arm
  const hornGeom = new THREE.BoxGeometry(16, 1.5, 5);
  const horn = new THREE.Mesh(hornGeom, gearMat);
  horn.position.set(5, 27, 0);
  group.add(horn);

  // Mounting tabs
  const tabGeom = new THREE.BoxGeometry(32, 2, 12);
  const tabs = new THREE.Mesh(tabGeom, servoMat);
  tabs.position.set(0, 16, 0);
  group.add(tabs);
}

/**
 * 4-Pin RGB LED (5mm common cathode)
 */
function buildRgbLed(
  group: THREE.Group,
  instance: ComponentInstance,
  mats: SceneMaterialRegistry,
  isSimulating: boolean
) {
  const colorState = instance.parameters?.colorState || 'green';
  let emissiveHex = 0x22c55e;
  if (colorState === 'red') emissiveHex = 0xef4444;
  else if (colorState === 'blue') emissiveHex = 0x3b82f6;

  const domeGeom = new THREE.SphereGeometry(3.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const cylGeom = new THREE.CylinderGeometry(3.2, 3.2, 4.5, 16);

  const ledMat = new THREE.MeshStandardMaterial({
    color: isSimulating ? emissiveHex : 0xf1f5f9,
    emissive: isSimulating ? emissiveHex : 0x000000,
    emissiveIntensity: isSimulating ? 1.2 : 0,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.88,
  });

  const dome = new THREE.Mesh(domeGeom, ledMat);
  dome.position.set(0, 8.5, 0);
  group.add(dome);

  const cyl = new THREE.Mesh(cylGeom, ledMat);
  cyl.position.set(0, 6, 0);
  group.add(cyl);

  // Rim flange
  const rimGeom = new THREE.CylinderGeometry(3.6, 3.6, 0.8, 16);
  const rim = new THREE.Mesh(rimGeom, ledMat);
  rim.position.set(0, 3.6, 0);
  group.add(rim);

  // 4 through-hole leads
  const pinXs = [-3.81, -1.27, 1.27, 3.81];
  for (const px of pinXs) {
    const leadGeom = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    const lead = new THREE.Mesh(leadGeom, mats.pinLeadMaterial);
    lead.position.set(px, 1.5, 0);
    group.add(lead);
  }
}

/**
 * 7-Segment LED Display
 */
function buildSevenSegment(
  group: THREE.Group,
  instance: ComponentInstance,
  mats: SceneMaterialRegistry,
  isSimulating: boolean
) {
  const bodyGeom = new THREE.BoxGeometry(12.6, 7.0, 19.0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 4.5, 0);
  body.castShadow = true;
  group.add(body);

  const faceGeom = new THREE.BoxGeometry(11.6, 0.3, 17.6);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.2 });
  const face = new THREE.Mesh(faceGeom, faceMat);
  face.position.set(0, 8.05, 0);
  group.add(face);

  const colorName = instance.parameters?.color || 'red';
  const segHex = colorName === 'green' ? 0x22c55e : colorName === 'blue' ? 0x3b82f6 : 0xef4444;
  const segMat = new THREE.MeshStandardMaterial({
    color: isSimulating ? segHex : 0x475569,
    emissive: isSimulating ? segHex : 0x000000,
    emissiveIntensity: isSimulating ? 1.1 : 0,
    roughness: 0.2,
  });

  const hSeg = new THREE.BoxGeometry(5.6, 0.35, 1.2);
  const vSeg = new THREE.BoxGeometry(1.2, 0.35, 5.6);

  const positions: Array<{ geom: THREE.BufferGeometry; x: number; z: number }> = [
    { geom: hSeg, x: 0, z: -6.0 },
    { geom: hSeg, x: 0, z: 0 },
    { geom: hSeg, x: 0, z: 6.0 },
    { geom: vSeg, x: -2.8, z: -3.0 },
    { geom: vSeg, x: 2.8, z: -3.0 },
    { geom: vSeg, x: -2.8, z: 3.0 },
    { geom: vSeg, x: 2.8, z: 3.0 },
  ];

  for (const s of positions) {
    const m = new THREE.Mesh(s.geom, segMat);
    m.position.set(s.x, 8.22, s.z);
    group.add(m);
  }
}

/**
 * OLED 0.96" I2C Display
 */
function buildOledDisplay(
  group: THREE.Group,
  _instance: ComponentInstance,
  mats: SceneMaterialRegistry,
  isSimulating: boolean
) {
  const pcbGeom = new THREE.BoxGeometry(27, 1.6, 27);
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0f3b5f, roughness: 0.35, metalness: 0.15 });
  const pcb = new THREE.Mesh(pcbGeom, pcbMat);
  pcb.position.set(0, 3.0, 0);
  pcb.castShadow = true;
  group.add(pcb);

  const glassGeom = new THREE.BoxGeometry(24, 1.2, 18);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x020617,
    emissive: isSimulating ? 0x06b6d4 : 0x000000,
    emissiveIntensity: isSimulating ? 0.45 : 0,
    roughness: 0.1,
    metalness: 0.3,
  });
  const glass = new THREE.Mesh(glassGeom, glassMat);
  glass.position.set(0, 4.3, 1.5);
  group.add(glass);

  for (const px of [-3.81, -1.27, 1.27, 3.81]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), mats.pinLeadMaterial);
    pin.position.set(px, 2.0, -11);
    group.add(pin);
  }
}

/**
 * DC Motor 3-6V
 */
function buildDcMotor(
  group: THREE.Group,
  _instance: ComponentInstance,
  mats: SceneMaterialRegistry
) {
  const cylGeom = new THREE.CylinderGeometry(8.5, 8.5, 22, 24);
  cylGeom.rotateX(Math.PI / 2);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
  const body = new THREE.Mesh(cylGeom, metalMat);
  body.position.set(0, 9.5, 0);
  body.castShadow = true;
  group.add(body);

  const capGeom = new THREE.CylinderGeometry(8.2, 8.2, 3, 20);
  capGeom.rotateX(Math.PI / 2);
  const capMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
  const cap = new THREE.Mesh(capGeom, capMat);
  cap.position.set(0, 9.5, 11);
  group.add(cap);

  const shaftGeom = new THREE.CylinderGeometry(1.0, 1.0, 8, 12);
  shaftGeom.rotateX(Math.PI / 2);
  const shaft = new THREE.Mesh(shaftGeom, mats.pinLeadMaterial);
  shaft.position.set(0, 9.5, -14);
  group.add(shaft);
}

/**
 * Voltage Regulator LM7805 TO-220
 */
function buildVoltageReg7805(
  group: THREE.Group,
  _instance: ComponentInstance,
  mats: SceneMaterialRegistry
) {
  const pkgGeom = new THREE.BoxGeometry(10, 9, 4.2);
  const pkg = new THREE.Mesh(pkgGeom, mats.icBodyMaterial);
  pkg.position.set(0, 7.5, 0);
  pkg.castShadow = true;
  group.add(pkg);

  const tabGeom = new THREE.BoxGeometry(10, 6, 1.2);
  const tabMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
  const tab = new THREE.Mesh(tabGeom, tabMat);
  tab.position.set(0, 14, -1.5);
  group.add(tab);

  for (const px of [-2.54, 0, 2.54]) {
    const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), mats.pinLeadMaterial);
    lead.position.set(px, 2.0, 0);
    group.add(lead);
  }
}

