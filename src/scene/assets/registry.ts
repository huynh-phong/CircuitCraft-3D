import { dcSourceSpec } from './specs/dcSource';
import { buzzerSpec } from './specs/buzzer';
import { capacitorSpec } from './specs/capacitor';
import { dcMotorSpec } from './specs/dcMotor';
import { diodeSpec } from './specs/diode';
import { ldrSpec } from './specs/ldr';
import { logicAndSpec } from './specs/logicAnd';
import { ne555Spec } from './specs/ne555';
import { oledI2cSpec } from './specs/oledI2c';
import { pushbuttonSpec } from './specs/pushbutton';
import { relaySpec } from './specs/relay';
import { rgbLedSpec } from './specs/rgbLed';
import { servoSg90Spec } from './specs/servoSg90';
import { sevenSegmentSpec } from './specs/sevenSegment';
import { tempSensorSpec } from './specs/tempSensor';
import { transistorNpnSpec } from './specs/transistorNpn';
import { ultrasonicSr04Spec } from './specs/ultrasonicSr04';
import { voltageReg7805Spec } from './specs/voltageReg7805';
import { led5mmSpec } from './specs/led5mm';
import { potentiometerSpec } from './specs/potentiometer';
import { resistorSpec } from './specs/resistor';
import { slideSwitchSpec } from './specs/slideSwitch';
import { terminalBlockSpec } from './specs/terminalBlock';
import type { ComponentModelSpec } from './specs/types';

/**
 * Registry of the v2 component models: spec -> existing component definition ids.
 *
 * To add a component: write `specs/<name>.ts`, import it here and add it to the list.
 * Nothing in the scene code has to change. A definition id that has no spec keeps its legacy model.
 */
const SPECS: ComponentModelSpec[] = [
  // Batch 1 (VISUAL-1)
  dcSourceSpec,
  resistorSpec,
  led5mmSpec,
  slideSwitchSpec,
  potentiometerSpec,
  terminalBlockSpec,
  // Batch 2 (VISUAL-1)
  capacitorSpec,
  pushbuttonSpec,
  diodeSpec,
  buzzerSpec,
  ldrSpec,
  relaySpec,
  ne555Spec,
  logicAndSpec,
  tempSensorSpec,
  transistorNpnSpec,
  rgbLedSpec,
  sevenSegmentSpec,
  oledI2cSpec,
  ultrasonicSr04Spec,
  servoSg90Spec,
  dcMotorSpec,
  voltageReg7805Spec,
];

const byDefinitionId = new Map<string, ComponentModelSpec>();

export function registerModelSpec(spec: ComponentModelSpec): void {
  for (const definitionId of spec.definitionIds) {
    const existing = byDefinitionId.get(definitionId);
    if (existing && existing !== spec) {
      throw new Error(`Model spec "${spec.id}" and "${existing.id}" both claim definition "${definitionId}"`);
    }
    byDefinitionId.set(definitionId, spec);
  }
}

for (const spec of SPECS) registerModelSpec(spec);

export function getModelSpec(definitionId: string): ComponentModelSpec | undefined {
  return byDefinitionId.get(definitionId);
}

export function listModelSpecs(): ComponentModelSpec[] {
  return [...new Set(byDefinitionId.values())];
}

export function listModelDefinitionIds(): string[] {
  return [...byDefinitionId.keys()];
}
