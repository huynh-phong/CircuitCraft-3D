import { ProjectRepository, ProjectVersionSnapshot, ProjectSaveResult } from './repository';
import { ProjectDocument } from '../domain/project/types';
import { SAMPLE_PROJECTS } from './sampleProjects';
import { cloneProjectDocument } from '../domain/project/document';
import { getUserStorageKey, purgeLegacyGlobalStorage } from './storageNamespace';
import { authService } from './authService';

export class LocalProjectRepository implements ProjectRepository {
  private explicitUserId: string | null = null;

  constructor(userId?: string | null) {
    if (userId) {
      this.explicitUserId = userId;
    }
    purgeLegacyGlobalStorage();
    this.ensureInitialized();

    // Automatically sync storage namespace whenever auth state changes
    try {
      authService.onAuthStateChange((user) => {
        const newId = user?.id || null;
        if (newId !== this.explicitUserId) {
          this.explicitUserId = newId;
          this.ensureInitialized();
        }
      });
    } catch {}
  }

  public setUserId(userId: string | null): void {
    this.explicitUserId = userId;
    this.ensureInitialized();
  }

  private getEffectiveUserId(): string | null {
    if (this.explicitUserId !== null) {
      return this.explicitUserId;
    }
    return authService.getCurrentUser()?.id || null;
  }

  private getProjectsStorageKey(): string {
    return getUserStorageKey('projects', this.getEffectiveUserId());
  }

  private getVersionsStorageKey(projectId: string): string {
    return getUserStorageKey(`versions:${projectId}`, this.getEffectiveUserId());
  }

  private ensureInitialized(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this.getProjectsStorageKey();
      const existing = localStorage.getItem(key);
      const isGuest = !this.getEffectiveUserId();

      // Only seed sample projects for guest users who have no existing projects
      if (!existing && isGuest) {
        localStorage.setItem(key, JSON.stringify(SAMPLE_PROJECTS));
      }
    } catch (e) {
      console.warn('LocalStorage không khả dụng hoặc bị giới hạn', e);
    }
  }

  async listProjects(): Promise<ProjectDocument[]> {
    try {
      const effectiveId = this.getEffectiveUserId();
      const key = this.getProjectsStorageKey();
      const raw = localStorage.getItem(key);

      if (!raw) {
        // If guest (not logged in), return sample circuits to explore;
        // If authenticated user, return empty array (fresh account has 0 projects until explicitly created/saved).
        return !effectiveId ? [...SAMPLE_PROJECTS] : [];
      }

      const parsed: ProjectDocument[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return !effectiveId ? [...SAMPLE_PROJECTS] : [];
      }

      // Deduplicate projects by projectId (keep the latest updated version)
      const seen = new Set<string>();
      const deduplicated: ProjectDocument[] = [];
      for (const p of parsed) {
        if (!p || !p.projectId) continue;
        if (!seen.has(p.projectId)) {
          seen.add(p.projectId);
          // If logged in, ensure project reflects current user authorId if unset
          deduplicated.push({
            ...p,
            authorId: effectiveId || p.authorId,
          });
        }
      }

      return deduplicated;
    } catch (err) {
      console.error('Lỗi khi đọc danh sách dự án từ LocalStorage', err);
      return !this.getEffectiveUserId() ? [...SAMPLE_PROJECTS] : [];
    }
  }

  async getProject(id: string): Promise<ProjectDocument | null> {
    const list = await this.listProjects();
    const found = list.find((p) => p.projectId === id);
    return found ? cloneProjectDocument(found) : null;
  }

  async saveProject(
    project: ProjectDocument,
    _options?: { force?: boolean }
  ): Promise<ProjectSaveResult> {
    try {
      const effectiveId = this.getEffectiveUserId();
      const key = this.getProjectsStorageKey();
      const list = await this.listProjects();
      const index = list.findIndex((p) => p.projectId === project.projectId);
      const updatedProject: ProjectDocument = {
        ...project,
        authorId: effectiveId || project.authorId || undefined,
        updatedAt: new Date().toISOString(),
      };

      if (index >= 0) {
        list[index] = updatedProject;
      } else {
        list.unshift(updatedProject);
      }

      // Enforce unique projectId deduplication before saving
      const seen = new Set<string>();
      const cleanList: ProjectDocument[] = [];
      for (const p of list) {
        if (p.projectId && !seen.has(p.projectId)) {
          seen.add(p.projectId);
          cleanList.push(p);
        }
      }

      localStorage.setItem(key, JSON.stringify(cleanList));

      // Also ensure that if user is currently guest, guest key has it
      if (!effectiveId) {
        try {
          const guestKey = getUserStorageKey('projects', null);
          localStorage.setItem(guestKey, JSON.stringify(list));
        } catch {}
      }

      // Sync project metadata & snapshot to backend store for Admin synchronization
      if (typeof fetch !== 'undefined') {
        const profile = authService.getCurrentProfile();
        const user = authService.getCurrentUser();
        fetch('/api/projects/sync', {
          method: 'POST',
          headers: authService.getAuthHeaders(),
          body: JSON.stringify({
            project: updatedProject,
            userId: profile?.id || user?.id || updatedProject.authorId,
            userEmail: profile?.email || user?.email,
            userName: profile?.fullName,
          }),
        }).catch(() => {});
      }

      return { success: true };
    } catch (err: any) {
      console.error('Lỗi khi lưu dự án vào LocalStorage', err);
      return { success: false, error: err?.message || 'Không thể lưu dự án vào LocalStorage' };
    }
  }

  async deleteProject(id: string): Promise<boolean> {
    try {
      const key = this.getProjectsStorageKey();
      const list = await this.listProjects();
      const filtered = list.filter((p) => p.projectId !== id);
      localStorage.setItem(key, JSON.stringify(filtered));
      localStorage.removeItem(this.getVersionsStorageKey(id));
      if (typeof fetch !== 'undefined') {
        fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: authService.getAuthHeaders(),
        }).catch(() => {});
      }
      return true;
    } catch (err) {
      console.error('Lỗi khi xóa dự án khỏi LocalStorage', err);
      return false;
    }
  }

  async duplicateProject(id: string): Promise<ProjectDocument | null> {
    const original = await this.getProject(id);
    if (!original) return null;

    const copy: ProjectDocument = {
      ...cloneProjectDocument(original),
      projectId: `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${original.name} (Bản sao)`,
      authorId: this.getEffectiveUserId() || original.authorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
    };

    await this.saveProject(copy);
    return copy;
  }

  async saveVersion(id: string, note?: string): Promise<boolean> {
    const project = await this.getProject(id);
    if (!project) return false;

    try {
      const key = this.getVersionsStorageKey(id);
      const raw = localStorage.getItem(key);
      const versions: ProjectVersionSnapshot[] = raw ? JSON.parse(raw) : [];

      const snapshot: ProjectVersionSnapshot = {
        id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        projectId: id,
        revision: project.revision,
        note: note || `Điểm lưu revision #${project.revision}`,
        createdAt: new Date().toISOString(),
        document: cloneProjectDocument(project),
      };

      versions.unshift(snapshot);
      if (versions.length > 20) versions.pop();

      localStorage.setItem(key, JSON.stringify(versions));
      return true;
    } catch (err) {
      console.error('Lỗi khi lưu phiên bản lịch sử', err);
      return false;
    }
  }

  async listVersions(id: string): Promise<ProjectVersionSnapshot[]> {
    try {
      const key = this.getVersionsStorageKey(id);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  public clearStorage(): void {
    try {
      const key = this.getProjectsStorageKey();
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('Error clearing local project storage:', err);
    }
  }

  public syncGuestProjectsToUser(userId: string): void {
    if (typeof localStorage === 'undefined' || !userId) return;
    try {
      const guestKey = getUserStorageKey('projects', null);
      const userKey = getUserStorageKey('projects', userId);
      const guestRaw = localStorage.getItem(guestKey);
      if (!guestRaw) return;

      const guestProjects: ProjectDocument[] = JSON.parse(guestRaw);
      if (!Array.isArray(guestProjects) || guestProjects.length === 0) return;

      const userRaw = localStorage.getItem(userKey);
      const userProjects: ProjectDocument[] = userRaw ? JSON.parse(userRaw) : [];

      for (const gp of guestProjects) {
        const exists = userProjects.some((up) => up.projectId === gp.projectId);
        if (!exists) {
          userProjects.unshift({
            ...gp,
            authorId: userId,
          });
        }
      }

      localStorage.setItem(userKey, JSON.stringify(userProjects));
    } catch (e) {
      console.warn('Error syncing guest projects to user:', e);
    }
  }
}

export const localProjectRepository = new LocalProjectRepository();
