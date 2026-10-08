import {
  ProjectDocument,
  UserProfile,
  ProjectRepository,
  ProjectSummary,
  SaveProjectResult,
} from '../types/circuit.ts';
import {
  CURRENT_SCHEMA_VERSION,
  migrateProjectDocument,
  validateProjectDocument,
} from '../domain/schema.ts';
import { createEmptyProjectFixture } from '../domain/fixtures.ts';

const LOCAL_STORAGE_ACTIVE_KEY = 'circuitverse_active_project';
const LOCAL_STORAGE_CATALOG_KEY = 'circuitverse_projects_catalog';
const LOCAL_STORAGE_PROJECT_PREFIX = 'circuitverse_proj_';
const LOCAL_STORAGE_USER_KEY = 'circuitverse_auth_user';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements StorageBackend {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

function resolveStorage(customStorage?: StorageBackend): StorageBackend {
  if (customStorage) return customStorage;
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return new MemoryStorage();
}

/**
 * LocalStorage adapter implementing the ProjectRepository contract.
 * Backed by Web Storage (localStorage) in browser or MemoryStorage in Node/test environments.
 */
export class LocalStorageProjectRepository implements ProjectRepository {
  private storage: StorageBackend;

  constructor(storage?: StorageBackend) {
    this.storage = resolveStorage(storage);
  }

  public async getProject(id: string): Promise<ProjectDocument> {
    const raw = this.storage.getItem(`${LOCAL_STORAGE_PROJECT_PREFIX}${id}`);
    if (!raw) {
      // Fallback check in active project if ID matches
      const activeRaw = this.storage.getItem(LOCAL_STORAGE_ACTIVE_KEY);
      if (activeRaw) {
        try {
          const activeParsed = JSON.parse(activeRaw);
          if (activeParsed.id === id) {
            const migration = migrateProjectDocument(activeParsed);
            if (migration.success && migration.document) {
              return migration.document;
            }
            throw new Error(migration.error || 'Dự án hiện tại bị lỗi cấu trúc schema');
          }
        } catch (e: any) {
          throw new Error(`Lỗi đọc dữ liệu dự án: ${e.message}`);
        }
      }
      throw new Error(`Không tìm thấy dự án với ID "${id}"`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      throw new Error(`Tệp dữ liệu dự án "${id}" bị lỗi cú pháp JSON: ${e.message}`);
    }

    const migration = migrateProjectDocument(parsed);
    if (!migration.success || !migration.document) {
      throw new Error(migration.error || `Dự án "${id}" không hợp lệ.`);
    }

    return migration.document;
  }

  public async saveProject(
    doc: ProjectDocument,
    expectedRevision?: number
  ): Promise<SaveProjectResult> {
    // 1. Validate against schema
    const validation = validateProjectDocument(doc);
    if (!validation.isValid) {
      const errMsgs = validation.errors.map((e) => `[${e.path || 'root'}]: ${e.message}`).join('; ');
      return {
        success: false,
        revision: doc.revision,
        message: `Dữ liệu dự án không hợp lệ, từ chối lưu: ${errMsgs}`,
      };
    }

    // 2. Concurrency check (optimistic concurrency via expectedRevision)
    const existingRaw = this.storage.getItem(`${LOCAL_STORAGE_PROJECT_PREFIX}${doc.id}`);
    if (existingRaw && expectedRevision !== undefined) {
      try {
        const existing: ProjectDocument = JSON.parse(existingRaw);
        if (existing.revision > expectedRevision) {
          return {
            success: false,
            revision: existing.revision,
            conflict: true,
            message: `Xung đột phiên bản: Dự án đã được lưu ở Revision #${existing.revision}, cao hơn phiên bản kỳ vọng (#${expectedRevision}).`,
          };
        }
      } catch {
        // Ignore parse error on existing if corrupt
      }
    }

    try {
      const serialized = JSON.stringify(doc);
      // Save individual project
      this.storage.setItem(`${LOCAL_STORAGE_PROJECT_PREFIX}${doc.id}`, serialized);
      // Set as active project
      this.storage.setItem(LOCAL_STORAGE_ACTIVE_KEY, serialized);

      // Update project catalog index
      const catalog = this.getCatalog();
      const updatedCatalog = catalog.filter((p) => p.id !== doc.id);
      updatedCatalog.unshift({
        id: doc.id,
        name: doc.name,
        updatedAt: doc.updatedAt,
        revision: doc.revision,
      });
      this.storage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(updatedCatalog));

      return {
        success: true,
        revision: doc.revision,
      };
    } catch (err: any) {
      return {
        success: false,
        revision: doc.revision,
        message: err?.message || 'Lỗi lưu trữ cục bộ',
      };
    }
  }

  public async listProjects(_userId?: string): Promise<ProjectSummary[]> {
    return this.getCatalog();
  }

  public async deleteProject(id: string): Promise<boolean> {
    this.storage.removeItem(`${LOCAL_STORAGE_PROJECT_PREFIX}${id}`);

    // Update catalog
    const catalog = this.getCatalog();
    const updated = catalog.filter((p) => p.id !== id);
    this.storage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(updated));

    // Clear active project if it was the deleted one
    const activeRaw = this.storage.getItem(LOCAL_STORAGE_ACTIVE_KEY);
    if (activeRaw) {
      try {
        const active = JSON.parse(activeRaw);
        if (active.id === id) {
          this.storage.removeItem(LOCAL_STORAGE_ACTIVE_KEY);
        }
      } catch {
        this.storage.removeItem(LOCAL_STORAGE_ACTIVE_KEY);
      }
    }

    return true;
  }

  public loadActiveProject(): ProjectDocument | null {
    try {
      const raw = this.storage.getItem(LOCAL_STORAGE_ACTIVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const migration = migrateProjectDocument(parsed);
      if (migration.success && migration.document) {
        return migration.document;
      }
      console.warn('Active project corrupted or incompatible:', migration.error);
      return null;
    } catch (err) {
      console.error('Failed to load active project from storage', err);
      return null;
    }
  }

  public createProject(options?: {
    name?: string;
    authorName?: string;
    boardWidth?: number;
    boardDepth?: number;
  }): ProjectDocument {
    const base = createEmptyProjectFixture();
    const now = new Date().toISOString();
    return {
      ...base,
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: options?.name || 'Mạch điện mới',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      board: {
        ...base.board,
        width: options?.boardWidth || base.board.width,
        depth: options?.boardDepth || base.board.depth,
      },
      metadata: {
        ...base.metadata,
        authorName: options?.authorName || 'Kỹ sư thiết kế',
      },
    };
  }

  public exportProjectJson(doc: ProjectDocument): string {
    const json = JSON.stringify(doc, null, 2);
    if (typeof document !== 'undefined') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `${doc.name.replace(/\s+/g, '_')}_v${doc.revision}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
    return json;
  }

  /**
   * Imports and validates a JSON string.
   * Runs schema migration and full validation.
   * If parsing fails, schema is corrupt, or version is in the future:
   * Throws an error with clear explanation and leaves existing documents completely untouched.
   */
  public importProjectJson(jsonContent: string): ProjectDocument {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (err: any) {
      throw new Error(`Định dạng tệp tin không phải JSON hợp lệ: ${err.message}`);
    }

    const migration = migrateProjectDocument(parsed);
    if (!migration.success || !migration.document) {
      throw new Error(migration.error || 'Dữ liệu dự án không hợp lệ hoặc bị hỏng.');
    }

    return migration.document;
  }

  public async parseProjectJsonFile(file: File): Promise<ProjectDocument> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const doc = this.importProjectJson(content);
          resolve(doc);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Không thể đọc tệp tin từ thiết bị.'));
      reader.readAsText(file);
    });
  }

  private getCatalog(): ProjectSummary[] {
    try {
      const catalogRaw = this.storage.getItem(LOCAL_STORAGE_CATALOG_KEY);
      if (catalogRaw) return JSON.parse(catalogRaw);
    } catch {
      // ignore
    }
    return [];
  }
}

// Default singleton repository
export const defaultProjectRepository = new LocalStorageProjectRepository();

/**
 * Static facade for backward-compatibility with existing views.
 */
export class ProjectRepositoryFacade {
  public static getCurrentUser(): UserProfile | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }

  public static setCurrentUser(user: UserProfile | null): void {
    if (typeof localStorage === 'undefined') return;
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    }
  }

  public static loadActiveProject(): ProjectDocument | null {
    return defaultProjectRepository.loadActiveProject();
  }

  public static saveProject(doc: ProjectDocument, expectedRevision?: number): SaveProjectResult {
    // Synchronous wrapper using default repository's synchronous storage
    let result: SaveProjectResult = { success: false, revision: doc.revision };
    defaultProjectRepository
      .saveProject(doc, expectedRevision)
      .then((res) => {
        result = res;
      })
      .catch((err) => {
        result = { success: false, revision: doc.revision, message: err.message };
      });
    return result;
  }

  public static listProjects(): ProjectSummary[] {
    const list: ProjectSummary[] = [];
    defaultProjectRepository.listProjects().then((items) => {
      list.push(...items);
    });
    return list;
  }

  public static createNewProject(name?: string): ProjectDocument {
    return defaultProjectRepository.createProject({ name });
  }

  public static exportProjectJson(doc: ProjectDocument): string {
    return defaultProjectRepository.exportProjectJson(doc);
  }

  public static async parseProjectJson(file: File): Promise<ProjectDocument> {
    return defaultProjectRepository.parseProjectJsonFile(file);
  }
}

// Export as ProjectRepository to keep compatibility with existing imports
export { ProjectRepositoryFacade as ProjectRepository };
