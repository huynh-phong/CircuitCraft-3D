import { ProjectDocument } from '../domain/project/types';

export interface ProjectVersionSnapshot {
  id: string;
  projectId: string;
  revision: number;
  note?: string;
  createdAt: string;
  document: ProjectDocument;
}

export interface ProjectSaveResult {
  success: boolean;
  conflict?: boolean;
  remoteRevision?: number;
  error?: string;
}

export interface ProjectRepository {
  listProjects(): Promise<ProjectDocument[]>;
  getProject(id: string): Promise<ProjectDocument | null>;
  saveProject(project: ProjectDocument, options?: { force?: boolean }): Promise<ProjectSaveResult>;
  deleteProject(id: string): Promise<boolean>;
  duplicateProject(id: string): Promise<ProjectDocument | null>;
  saveVersion(id: string, note?: string): Promise<boolean>;
  listVersions(id: string): Promise<ProjectVersionSnapshot[]>;
}
