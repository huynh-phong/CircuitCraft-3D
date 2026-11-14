import type { ComponentMeshOptions } from '../../models/types';
import { BLINK_MAX_HZ } from '../../models/types';

/**
 * Light level to draw for a SOLVED level: PWM faster than the blink rate is shown at its average,
 * slower PWM is animated by the scene (blinkOn / blinkOff). Never invents a value.
 */
export function drawLevel(level: number | undefined, options: ComponentMeshOptions): number {
  if (!level) return 0;
  const pwm = options.pwm;
  return pwm && pwm.frequencyHz > BLINK_MAX_HZ ? level * pwm.duty : level;
}
