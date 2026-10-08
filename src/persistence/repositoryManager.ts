import { ProjectRepository } from './repository';
import { localProjectRepository } from './localRepository';
import { supabaseProjectRepository } from './supabaseRepository';
import { authService } from './authService';
import { getSupabase } from './supabaseClient';
import { ProjectDocument } from '../domain/project/types';

export class ProjectRepositoryManager {
  /**
   * Returns the active repository based on authentication status and Supabase availability.
   */
  public getActiveRepository(): ProjectRepository {
    const isCloudReady = Boolean(getSupabase() && authService.isAuthenticated());
    if (isCloudReady) {
      return supabaseProjectRepository;
    }
    return localProjectRepository;
  }

  /**
   * Determine whether current workspace is running with real Cloud synchronization.
   */
  public isCloudMode(): boolean {
    return Boolean(getSupabase() && authService.isAuthenticated());
  }

  /**
   * Sync projects created in local guest mode to the user's Supabase Cloud database.
   */
  public async syncLocalProjectsToCloud(): Promise<{ synced: number; failed: number }> {
    const user = authService.getCurrentUser();
    if (!this.isCloudMode() || !user) {
      return { synced: 0, failed: 0 };
    }

    const localProjects = await localProjectRepository.listProjects();
    let synced = 0;
    let failed = 0;

    for (const project of localProjects) {
      try {
        const userDoc: ProjectDocument = { ...project, authorId: user.id };
        const res = await supabaseProjectRepository.saveProject(userDoc, { force: true });
        if (res.success) {
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  }
}

export const projectRepositoryManager = new ProjectRepositoryManager();
