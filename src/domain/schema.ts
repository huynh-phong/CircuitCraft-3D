/**
 * CircuitCraft 3D - Domain Runtime Schema Validation
 * Strictly pure domain logic: NO UI, NO Three.js dependencies.
 */

import {
  ProjectDocument,
  ComponentInstance,
  ConnectionWire,
  BoardConfig,
  SchemaValidationError,
  SchemaValidationResult,
} from '../types/circuit.ts';

export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;
export const CURRENT_SCHEMA_VERSION = 1;

export interface MigrationResult {
  success: boolean;
  document?: ProjectDocument;
  error?: string;
  isFutureVersion?: boolean;
  isCorrupted?: boolean;
  unmigratedRaw?: unknown;
}

export type MigrationFunction = (doc: any) => any;

/**
 * Migration registry: maps source version N -> (doc) => migratedDoc (version N+1).
 * Baseline is version 1. No historical versions exist prior to 1 (do not invent fake historical schemas).
 */
export const SCHEMA_MIGRATIONS: Record<number, MigrationFunction> = {};

/**
 * Migrates a raw JSON input according to its schemaVersion.
 * If data is corrupt or belongs to a future version, keeps raw intact and reports error.
 * Does NOT silently overwrite or mutate original source.
 */
export function migrateProjectDocument(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object') {
    return {
      success: false,
      error: 'Dữ liệu dự án không hợp lệ hoặc bị hỏng (phải là đối tượng JSON).',
      isCorrupted: true,
      unmigratedRaw: raw,
    };
  }

  const obj = raw as Record<string, any>;
  const version = obj.schemaVersion;

  if (typeof version !== 'number' || !Number.isFinite(version)) {
    return {
      success: false,
      error: 'Tài liệu dự án thiếu schemaVersion hoặc schemaVersion không hợp lệ.',
      isCorrupted: true,
      unmigratedRaw: raw,
    };
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      error: `Tài liệu sử dụng schemaVersion ${version}, mới hơn phiên bản ứng dụng hiện tại (${CURRENT_SCHEMA_VERSION}). Vui lòng cập nhật ứng dụng để mở tệp này. Giữ nguyên bản gốc và không ghi đè.`,
      isFutureVersion: true,
      unmigratedRaw: raw,
    };
  }

  let currentDoc = obj;
  let currentV = version;

  while (currentV < CURRENT_SCHEMA_VERSION) {
    const migrator = SCHEMA_MIGRATIONS[currentV];
    if (!migrator) {
      return {
        success: false,
        error: `Không tìm thấy trình chuyển đổi (migration) từ schema version ${currentV} lên ${currentV + 1}.`,
        isCorrupted: true,
        unmigratedRaw: raw,
      };
    }
    try {
      currentDoc = migrator(currentDoc);
      currentV = currentDoc.schemaVersion;
    } catch (err: any) {
      return {
        success: false,
        error: `Lỗi trong quá trình chuyển đổi schema từ version ${currentV}: ${err?.message}`,
        isCorrupted: true,
        unmigratedRaw: raw,
      };
    }
  }

  // Validate the final document against runtime schema
  const validation = validateProjectDocument(currentDoc);
  if (!validation.isValid) {
    const errorDetails = validation.errors.map((e) => `[${e.path || 'root'}]: ${e.message}`).join('; ');
    return {
      success: false,
      error: `Dữ liệu không đáp ứng runtime schema: ${errorDetails}`,
      isCorrupted: true,
      unmigratedRaw: raw,
    };
  }

  return {
    success: true,
    document: currentDoc as ProjectDocument,
  };
}

/**
 * Validates a ProjectDocument against the domain runtime schema.
 * Checks for:
 * 1. Supported schemaVersion
 * 2. Finite numeric values in board, positions, rotations, and properties
 * 3. Duplicate IDs in components, component pins, and connections
 * 4. Dangling pin or component references in connections
 * 5. Self-connecting pins
 */
export function validateProjectDocument(doc: unknown): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];

  if (!doc || typeof doc !== 'object') {
    return {
      isValid: false,
      errors: [
        {
          path: '',
          message: 'Tài liệu dự án phải là một object hợp lệ',
          code: 'INVALID_FIELD',
        },
      ],
    };
  }

  const project = doc as Partial<ProjectDocument>;

  // 1. Check schemaVersion
  if (project.schemaVersion === undefined || project.schemaVersion === null) {
    errors.push({
      path: 'schemaVersion',
      message: 'Thiếu schemaVersion trong tài liệu dự án',
      code: 'UNSUPPORTED_VERSION',
    });
  } else if (typeof project.schemaVersion !== 'number' || !SUPPORTED_SCHEMA_VERSIONS.includes(project.schemaVersion as any)) {
    errors.push({
      path: 'schemaVersion',
      message: `Phiên bản schema ${project.schemaVersion} không được hỗ trợ. Phiên bản hỗ trợ: [${SUPPORTED_SCHEMA_VERSIONS.join(', ')}]`,
      code: 'UNSUPPORTED_VERSION',
    });
  }

  // 2. Check basic fields
  if (!project.id || typeof project.id !== 'string') {
    errors.push({
      path: 'id',
      message: 'ID dự án không hợp lệ hoặc bị thiếu',
      code: 'INVALID_FIELD',
    });
  }

  // 3. Check board config
  if (!project.board || typeof project.board !== 'object') {
    errors.push({
      path: 'board',
      message: 'Thiếu cấu hình bo mạch (board config)',
      code: 'INVALID_FIELD',
    });
  } else {
    validateBoard(project.board, errors);
  }

  // 4. Check components
  const componentMap = new Map<string, ComponentInstance>();
  if (!Array.isArray(project.components)) {
    errors.push({
      path: 'components',
      message: 'Danh sách linh kiện phải là một mảng',
      code: 'INVALID_FIELD',
    });
  } else {
    const seenComponentIds = new Set<string>();

    project.components.forEach((comp, index) => {
      const compPath = `components[${index}]`;

      if (!comp || typeof comp !== 'object') {
        errors.push({
          path: compPath,
          message: 'Linh kiện không hợp lệ',
          code: 'INVALID_FIELD',
        });
        return;
      }

      // Check component ID
      if (!comp.id || typeof comp.id !== 'string') {
        errors.push({
          path: `${compPath}.id`,
          message: 'ID linh kiện không hợp lệ',
          code: 'INVALID_FIELD',
        });
      } else if (seenComponentIds.has(comp.id)) {
        errors.push({
          path: `${compPath}.id`,
          message: `ID linh kiện bị trùng lặp: "${comp.id}"`,
          code: 'DUPLICATE_ID',
        });
      } else {
        seenComponentIds.add(comp.id);
        componentMap.set(comp.id, comp);
      }

      // Check position finite
      if (!comp.position || typeof comp.position !== 'object') {
        errors.push({
          path: `${compPath}.position`,
          message: 'Thiếu tọa độ vị trí của linh kiện',
          code: 'INVALID_FIELD',
        });
      } else {
        (['x', 'y', 'z'] as const).forEach((axis) => {
          const val = comp.position[axis];
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            errors.push({
              path: `${compPath}.position.${axis}`,
              message: `Tọa độ vị trí ${axis} không phải số hữu hạn: ${val}`,
              code: 'NON_FINITE_VALUE',
            });
          }
        });
      }

      // Check rotation finite
      if (typeof comp.rotation !== 'number' || !Number.isFinite(comp.rotation)) {
        errors.push({
          path: `${compPath}.rotation`,
          message: `Góc xoay không phải số hữu hạn: ${comp.rotation}`,
          code: 'NON_FINITE_VALUE',
        });
      }

      // Check pins
      if (!Array.isArray(comp.pins) || comp.pins.length === 0) {
        errors.push({
          path: `${compPath}.pins`,
          message: 'Linh kiện phải có ít nhất một chân pin',
          code: 'INVALID_FIELD',
        });
      } else {
        const seenPinIds = new Set<string>();
        comp.pins.forEach((pin, pIndex) => {
          const pinPath = `${compPath}.pins[${pIndex}]`;
          if (!pin.id || typeof pin.id !== 'string') {
            errors.push({
              path: `${pinPath}.id`,
              message: 'ID chân pin không hợp lệ',
              code: 'INVALID_FIELD',
            });
          } else if (seenPinIds.has(pin.id)) {
            errors.push({
              path: `${pinPath}.id`,
              message: `ID chân pin bị trùng trong linh kiện "${comp.id}": "${pin.id}"`,
              code: 'DUPLICATE_ID',
            });
          } else {
            seenPinIds.add(pin.id);
          }

          // Pin relative position
          if (pin.relativePosition) {
            (['x', 'y', 'z'] as const).forEach((axis) => {
              const val = pin.relativePosition[axis];
              if (typeof val !== 'number' || !Number.isFinite(val)) {
                errors.push({
                  path: `${pinPath}.relativePosition.${axis}`,
                  message: `Tọa độ chân pin ${axis} không phải số hữu hạn: ${val}`,
                  code: 'NON_FINITE_VALUE',
                });
              }
            });
          }
        });
      }

      // Check numeric properties
      if (comp.properties && typeof comp.properties === 'object') {
        const numericPropertyKeys = ['voltage', 'resistance', 'forwardVoltage', 'maxCurrent', 'pinsCount'];
        numericPropertyKeys.forEach((key) => {
          const val = comp.properties[key];
          if (val !== undefined && (typeof val !== 'number' || !Number.isFinite(val))) {
            errors.push({
              path: `${compPath}.properties.${key}`,
              message: `Thông số ${key} phải là số hữu hạn: ${val}`,
              code: 'NON_FINITE_VALUE',
            });
          }
        });
      }
    });
  }

  // 5. Check connections
  if (!Array.isArray(project.connections)) {
    errors.push({
      path: 'connections',
      message: 'Danh sách kết nối phải là một mảng',
      code: 'INVALID_FIELD',
    });
  } else {
    const seenConnectionIds = new Set<string>();

    project.connections.forEach((conn, index) => {
      const connPath = `connections[${index}]`;

      if (!conn || typeof conn !== 'object') {
        errors.push({
          path: connPath,
          message: 'Kết nối không hợp lệ',
          code: 'INVALID_FIELD',
        });
        return;
      }

      // Connection ID
      if (!conn.id || typeof conn.id !== 'string') {
        errors.push({
          path: `${connPath}.id`,
          message: 'ID kết nối không hợp lệ',
          code: 'INVALID_FIELD',
        });
      } else if (seenConnectionIds.has(conn.id)) {
        errors.push({
          path: `${connPath}.id`,
          message: `ID kết nối bị trùng lặp: "${conn.id}"`,
          code: 'DUPLICATE_ID',
        });
      } else {
        seenConnectionIds.add(conn.id);
      }

      // Prevent self connection
      if (
        conn.fromComponentId &&
        conn.toComponentId &&
        conn.fromPinId &&
        conn.toPinId &&
        conn.fromComponentId === conn.toComponentId &&
        conn.fromPinId === conn.toPinId
      ) {
        errors.push({
          path: connPath,
          message: `Không thể nối chân pin "${conn.fromPinId}" vào chính nó trên linh kiện "${conn.fromComponentId}"`,
          code: 'SELF_CONNECTION',
        });
      }

      // Verify fromComponent exists
      const fromComp = componentMap.get(conn.fromComponentId);
      if (!fromComp) {
        errors.push({
          path: `${connPath}.fromComponentId`,
          message: `Linh kiện nguồn "${conn.fromComponentId}" không tồn tại`,
          code: 'COMPONENT_NOT_FOUND',
        });
      } else {
        // Verify fromPin exists
        const pinExists = fromComp.pins.some((p) => p.id === conn.fromPinId);
        if (!pinExists) {
          errors.push({
            path: `${connPath}.fromPinId`,
            message: `Chân pin nguồn "${conn.fromPinId}" không tồn tại trên linh kiện "${fromComp.id}"`,
            code: 'PIN_NOT_FOUND',
          });
        }
      }

      // Verify toComponent exists
      const toComp = componentMap.get(conn.toComponentId);
      if (!toComp) {
        errors.push({
          path: `${connPath}.toComponentId`,
          message: `Linh kiện đích "${conn.toComponentId}" không tồn tại`,
          code: 'COMPONENT_NOT_FOUND',
        });
      } else {
        // Verify toPin exists
        const pinExists = toComp.pins.some((p) => p.id === conn.toPinId);
        if (!pinExists) {
          errors.push({
            path: `${connPath}.toPinId`,
            message: `Chân pin đích "${conn.toPinId}" không tồn tại trên linh kiện "${toComp.id}"`,
            code: 'PIN_NOT_FOUND',
          });
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function validateBoard(board: BoardConfig, errors: SchemaValidationError[]): void {
  const fields = ['width', 'depth', 'thickness', 'gridSize'] as const;
  fields.forEach((field) => {
    const val = board[field];
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
      errors.push({
        path: `board.${field}`,
        message: `Thông số bo mạch ${field} phải là số dương hữu hạn: ${val}`,
        code: 'NON_FINITE_VALUE',
      });
    }
  });
}
