import type { ProjectDocument } from '../domain/project/types';

/**
 * Projects of the signed-in user as stored by the server. Browser storage is only a local copy, so
 * another device, or this one after its storage was cleared, sees the same projects.
 * Returns null when the server cannot answer, so callers keep showing the local copy.
 */
export async function fetchServerProjects(): Promise<ProjectDocument[] | null> {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.projects)) return null;
    return data.projects.map((p: any) => p.document || p).filter((doc: any) => doc?.projectId);
  } catch {
    return null;
  }
}

export async function fetchServerProject(id: string): Promise<ProjectDocument | null> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.project?.document || null;
  } catch {
    return null;
  }
}

function isNewer(a: ProjectDocument, b: ProjectDocument): boolean {
  if ((a.revision || 0) !== (b.revision || 0)) return (a.revision || 0) > (b.revision || 0);
  return new Date(a.updatedAt || 0).getTime() > new Date(b.updatedAt || 0).getTime();
}

/** One entry per project, the newest version of each. Newest projects first. */
export function mergeProjects(local: ProjectDocument[], server: ProjectDocument[]): ProjectDocument[] {
  const byId = new Map<string, ProjectDocument>();
  for (const doc of [...local, ...server]) {
    const current = byId.get(doc.projectId);
    if (!current || isNewer(doc, current)) byId.set(doc.projectId, doc);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}
