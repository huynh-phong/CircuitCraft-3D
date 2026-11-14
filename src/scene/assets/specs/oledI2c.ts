import { buildOledModule } from '../builders/displays';
import { defineSpec } from './types';

export const oledI2cSpec = defineSpec({
  id: 'oled-096-i2c',
  definitionIds: ['oled-i2c'],
  reference: '0.96 inch SSD1306 I2C OLED module: PCB 27 x 27 mm, 4-pin 2.54 mm header',
  builder: buildOledModule,
  params: (_instance, options) => ({
    pcbSize: 27,
    pcbHex: 0x0f3b5f,
    glassWidth: 24.7,
    glassDepth: 16.6,
    // Lit only when the solver reports display data (I2C itself is not simulated)
    displayOn: Boolean(options.visual?.displayOn),
    silk: 'GND VCC SCL SDA',
  }),
  pins: {},
});
