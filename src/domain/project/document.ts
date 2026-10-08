import { ProjectDocument } from './types';

export const CURRENT_SCHEMA_VERSION = 1;

export function createDefaultProjectDocument(
  name = 'Mạch điện mới',
  options?: { width?: number; depth?: number; description?: string }
): ProjectDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId: `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    description: options?.description || 'Dự án mạch điện 3D được thiết kế trên CircuitCraft 3D',
    revision: 1,
    units: 'mm',
    board: {
      width: options?.width || 80, // mm
      depth: options?.depth || 60, // mm
      thickness: 1.6, // mm standard PCB
      solderMaskColor: '#114a36', // Deep emerald solder mask
      copperLayerCount: 2,
      gridSpacing: 2.54, // 100 mil standard pitch
    },
    components: [],
    connections: [],
    wireRoutes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneProjectDocument(doc: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(doc));
}

export function serializeProjectDocument(doc: ProjectDocument): string {
  return JSON.stringify(doc, null, 2);
}

export interface ParseResult {
  success: boolean;
  data?: ProjectDocument;
  error?: string;
}

export function deserializeProjectDocument(jsonStr: string): ParseResult {
  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Dữ liệu JSON không hợp lệ' };
    }

    if (typeof parsed.schemaVersion !== 'number') {
      return { success: false, error: 'Thiếu schemaVersion trong file dự án' };
    }

    if (parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        success: false,
        error: `Dự án này được tạo bởi phiên bản mới hơn (Schema v${parsed.schemaVersion}). Vui lòng cập nhật ứng dụng để mở.`,
      };
    }

    if (!parsed.projectId || !parsed.board || !Array.isArray(parsed.components) || !Array.isArray(parsed.connections)) {
      return { success: false, error: 'Cấu trúc ProjectDocument không đúng chuẩn của CircuitCraft 3D' };
    }

    return {
      success: true,
      data: parsed as ProjectDocument,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Lỗi đọc file JSON: ${err?.message || 'Không thể phân tích cú pháp'}`,
    };
  }
}
