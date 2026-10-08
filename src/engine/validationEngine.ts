import { ProjectDocument, ValidationResult, ValidationDiagnostic } from '../types/circuit.ts';

export class ValidationEngine {
  public static validate(doc: ProjectDocument): ValidationResult {
    const diagnostics: ValidationDiagnostic[] = [];

    const { components, connections } = doc;

    if (components.length === 0) {
      return {
        timestamp: Date.now(),
        isValid: true,
        diagnostics: [],
        stats: { errorsCount: 0, warningsCount: 0, infosCount: 0 },
      };
    }

    const powerSources = components.filter((c) => c.type === 'dc_power_supply');
    const leds = components.filter((c) => c.type === 'led');
    const resistors = components.filter((c) => c.type === 'resistor');

    // Rule 1: No power source
    if (powerSources.length === 0) {
      diagnostics.push({
        ruleId: 'WARN_NO_POWER',
        severity: 'warning',
        message: 'Mạch chưa có nguồn điện DC để cung cấp năng lượng.',
        details: 'Hãy kéo thêm một khối "Nguồn DC" từ thanh linh kiện vào bo mạch.',
        objectRefs: [],
      });
    }

    // Rule 2: Short Circuit Detection
    for (const source of powerSources) {
      const posWires = connections.filter(
        (w) =>
          (w.fromComponentId === source.id && w.fromPinId === 'pin_pos') ||
          (w.toComponentId === source.id && w.toPinId === 'pin_pos')
      );
      const negWires = connections.filter(
        (w) =>
          (w.fromComponentId === source.id && w.fromPinId === 'pin_neg') ||
          (w.toComponentId === source.id && w.toPinId === 'pin_neg')
      );

      // Check direct short: wire directly connecting pin_pos to pin_neg
      const directShort = connections.some(
        (w) =>
          (w.fromComponentId === source.id &&
            w.fromPinId === 'pin_pos' &&
            w.toComponentId === source.id &&
            w.toPinId === 'pin_neg') ||
          (w.fromComponentId === source.id &&
            w.fromPinId === 'pin_neg' &&
            w.toComponentId === source.id &&
            w.toPinId === 'pin_pos')
      );

      if (directShort) {
        diagnostics.push({
          ruleId: 'ERR_SHORT_CIRCUIT',
          severity: 'error',
          message: 'Cảnh báo đoản mạch: Cực (+) và cực (-) của nguồn nối trực tiếp với nhau!',
          details: 'Dòng điện đoản mạch cực lớn sẽ làm hỏng nguồn điện và gây cháy nổ linh kiện.',
          objectRefs: [{ type: 'component', id: source.id }],
        });
      }

      // Check LED directly connected to power source without resistor
      for (const led of leds) {
        const hasDirectPos = posWires.some(
          (w) =>
            (w.fromComponentId === led.id && w.fromPinId === 'pin_anode') ||
            (w.toComponentId === led.id && w.toPinId === 'pin_anode')
        );
        const hasDirectNeg = negWires.some(
          (w) =>
            (w.fromComponentId === led.id && w.fromPinId === 'pin_cathode') ||
            (w.toComponentId === led.id && w.toPinId === 'pin_cathode')
        );

        if (hasDirectPos && hasDirectNeg && resistors.length === 0) {
          diagnostics.push({
            ruleId: 'ERR_LED_NO_RESISTOR',
            severity: 'error',
            message: `LED "${led.name}" nối trực tiếp nguồn không có điện trở hạn dòng!`,
            details: 'Điện áp 5V sẽ gây quá dòng qua diode LED (>100mA), làm cháy LED ngay lập tức.',
            objectRefs: [
              { type: 'component', id: led.id },
              { type: 'component', id: source.id },
            ],
          });
        }

        // Check Reverse Polarity (Cathode to Pos and Anode to Neg)
        const reversePos = posWires.some(
          (w) =>
            (w.fromComponentId === led.id && w.fromPinId === 'pin_cathode') ||
            (w.toComponentId === led.id && w.toPinId === 'pin_cathode')
        );
        const reverseNeg = negWires.some(
          (w) =>
            (w.fromComponentId === led.id && w.fromPinId === 'pin_anode') ||
            (w.toComponentId === led.id && w.toPinId === 'pin_anode')
        );

        if (reversePos || reverseNeg) {
          diagnostics.push({
            ruleId: 'WARN_LED_REVERSE_POLARITY',
            severity: 'warning',
            message: `LED "${led.name}" đang bị nối ngược cực tính (Anode phải nối về phía dương).`,
            details: 'LED là linh kiện bán dẫn chỉ cho dòng điện chạy theo 1 chiều từ Anode (+) sang Cathode (-).',
            objectRefs: [{ type: 'component', id: led.id }],
          });
        }
      }
    }

    // Rule 3: Unconnected components
    components.forEach((comp) => {
      const compWires = connections.filter(
        (w) => w.fromComponentId === comp.id || w.toComponentId === comp.id
      );
      if (compWires.length === 0) {
        diagnostics.push({
          ruleId: 'INFO_UNCONNECTED_COMPONENT',
          severity: 'info',
          message: `Linh kiện "${comp.name}" chưa được nối dây với bất kỳ chân nào.`,
          objectRefs: [{ type: 'component', id: comp.id }],
        });
      }
    });

    const errorsCount = diagnostics.filter((d) => d.severity === 'error').length;
    const warningsCount = diagnostics.filter((d) => d.severity === 'warning').length;
    const infosCount = diagnostics.filter((d) => d.severity === 'info').length;

    return {
      timestamp: Date.now(),
      isValid: errorsCount === 0,
      diagnostics,
      stats: {
        errorsCount,
        warningsCount,
        infosCount,
      },
    };
  }
}
