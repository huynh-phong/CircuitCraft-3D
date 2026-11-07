import type { ProjectDocument } from '../domain/project/types';

export class ProductDesignError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

/** The complete design comes from the server, which checks free / purchased / owner access. */
export async function fetchProductDesign(productId: string): Promise<ProjectDocument> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}/design`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.design) {
    throw new ProductDesignError(data.error || 'Không thể tải bản thiết kế từ máy chủ.', data.code || 'DESIGN_FAILED', res.status);
  }
  return data.design as ProjectDocument;
}
