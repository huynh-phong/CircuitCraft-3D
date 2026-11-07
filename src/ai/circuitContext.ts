import { ProjectDocument } from '../domain/project/types';
import { toCanonicalDocument } from '../domain/components/aliases';

/**
 * Canonical request contract for POST /api/ai/chat (shared by client and server).
 *
 * {
 *   prompt: string,
 *   history: [{ role: 'user' | 'assistant', content: string }],
 *   context: AICircuitContext
 * }
 *
 * Only design data is sent: no tokens, e-mails or account data.
 */

export interface AICircuitContext {
  locale: 'vi' | 'en';
  projectName?: string;
  revision: number;
  components: Array<{
    instanceId: string;
    definitionId: string;
    name: string;
    parameters: Record<string, unknown>;
    position: { x: number; y: number; z: number };
  }>;
  connections: Array<{ id: string; from: string; to: string }>;
  connectionsCount: number;
  issues: Array<{ ruleId?: string; severity?: string; message: string }>;
  simulation?: { status: string; summary: string; issues: string[]; unsupportedComponents?: string[] } | null;
  selectedComponentId?: string | null;
  practiceContext?: AIPracticeContext | null;
}

export interface AIPracticeContext {
  courseTitle?: string;
  lessonTitle?: string;
  lessonSummary?: string;
  targetComponents?: Array<{ id: string; type: string; name: string }>;
  targetConnections?: Array<{ from: string; to: string }>;
  stages?: Array<{ stageNumber: number; title: string; steps: string[] }>;
}

export const AI_CONTEXT_LIMITS = {
  maxComponents: 150,
  maxConnections: 300,
  maxIssues: 30,
  maxHistory: 12,
  maxMessageChars: 4000,
  maxParamKeys: 12,
};

function safeParams(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>).slice(0, AI_CONTEXT_LIMITS.maxParamKeys)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 60);
  }
  return out;
}

export function buildCircuitContext(params: {
  project: ProjectDocument | null | undefined;
  issues?: Array<{ ruleId?: string; severity?: string; message?: string }>;
  simulation?: { status: string; summary: string; issues: string[]; unsupportedComponents?: string[] } | null;
  selectedComponentId?: string | null;
  practiceContext?: any;
  locale?: string;
}): AICircuitContext {
  const doc = params.project ? toCanonicalDocument(params.project) : null;
  const components = (doc?.components || []).slice(0, AI_CONTEXT_LIMITS.maxComponents).map((c) => ({
    instanceId: c.instanceId,
    definitionId: c.definitionId,
    name: c.name,
    parameters: safeParams(c.parameters),
    position: { x: Math.round(c.position.x * 10) / 10, y: Math.round(c.position.y * 10) / 10, z: Math.round(c.position.z * 10) / 10 },
  }));
  const connections = (doc?.connections || []).slice(0, AI_CONTEXT_LIMITS.maxConnections).map((cn) => ({
    id: cn.id,
    from: `${cn.fromComponentId}.${cn.fromPinId}`,
    to: `${cn.toComponentId}.${cn.toPinId}`,
  }));
  return {
    locale: params.locale === 'en' ? 'en' : 'vi',
    projectName: doc?.name,
    revision: doc?.revision ?? 1,
    components,
    connections,
    connectionsCount: doc?.connections.length ?? 0,
    issues: (params.issues || []).slice(0, AI_CONTEXT_LIMITS.maxIssues).map((i) => ({
      ruleId: i.ruleId,
      severity: i.severity,
      message: String(i.message || '').slice(0, 300),
    })),
    simulation: params.simulation
      ? {
          status: params.simulation.status,
          summary: String(params.simulation.summary || '').slice(0, 400),
          issues: (params.simulation.issues || []).slice(0, 10).map((s) => String(s).slice(0, 300)),
          unsupportedComponents: params.simulation.unsupportedComponents,
        }
      : null,
    selectedComponentId: params.selectedComponentId || null,
    practiceContext: normalizePracticeContext(params.practiceContext),
  };
}

/** Accepts both the client practice-lab shape and the canonical shape. */
export function normalizePracticeContext(pc: any): AIPracticeContext | null {
  if (!pc || typeof pc !== 'object') return null;
  const target = pc.targetProject;
  const targetComponents = Array.isArray(pc.targetComponents)
    ? pc.targetComponents
    : Array.isArray(target?.components)
    ? target.components.map((c: any) => ({ id: c.instanceId, type: c.definitionId, name: c.name }))
    : [];
  const targetConnections = Array.isArray(pc.targetConnections)
    ? pc.targetConnections
    : Array.isArray(target?.connections)
    ? target.connections.map((c: any) => ({ from: `${c.fromComponentId}.${c.fromPinId}`, to: `${c.toComponentId}.${c.toPinId}` }))
    : [];
  const rawStages = Array.isArray(pc.stages) ? pc.stages : Array.isArray(pc.practiceStages) ? pc.practiceStages : [];
  return {
    courseTitle: pc.courseTitle ? String(pc.courseTitle).slice(0, 200) : undefined,
    lessonTitle: pc.lessonTitle ? String(pc.lessonTitle).slice(0, 200) : undefined,
    lessonSummary: String(pc.lessonSummary || pc.shortDescription || pc.practiceSummary || '').slice(0, 1000) || undefined,
    targetComponents: targetComponents.slice(0, AI_CONTEXT_LIMITS.maxComponents),
    targetConnections: targetConnections.slice(0, AI_CONTEXT_LIMITS.maxConnections),
    stages: rawStages.slice(0, 3).map((st: any, i: number) => ({
      stageNumber: Number(st.stageNumber) || i + 1,
      title: String(st.title || `Giai đoạn ${i + 1}`).slice(0, 200),
      steps: Array.isArray(st.steps) ? st.steps.map((x: any) => String(x).slice(0, 300)).slice(0, 20) : [],
    })),
  };
}

/**
 * Server-side normaliser: accepts the canonical body and the legacy body shape
 * (`{ prompt, project, issues, simResult, selectedObjectId, practiceContext }`).
 */
export function normalizeChatRequest(body: any): {
  prompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: AICircuitContext | null;
} {
  const prompt = String(body?.prompt || '').slice(0, AI_CONTEXT_LIMITS.maxMessageChars);
  const history = (Array.isArray(body?.history) ? body.history : [])
    .filter((h: any) => h && typeof h.content === 'string' && h.content.trim())
    .slice(-AI_CONTEXT_LIMITS.maxHistory)
    .map((h: any) => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: String(h.content).slice(0, AI_CONTEXT_LIMITS.maxMessageChars),
    }));

  let context: AICircuitContext | null = null;
  if (body?.context && typeof body.context === 'object' && Array.isArray(body.context.components)) {
    const c = body.context;
    context = {
      ...c,
      locale: c.locale === 'en' ? 'en' : 'vi',
      components: c.components.slice(0, AI_CONTEXT_LIMITS.maxComponents),
      connections: Array.isArray(c.connections) ? c.connections.slice(0, AI_CONTEXT_LIMITS.maxConnections) : [],
      issues: Array.isArray(c.issues) ? c.issues.slice(0, AI_CONTEXT_LIMITS.maxIssues) : [],
      practiceContext: normalizePracticeContext(c.practiceContext),
    };
  } else if (body?.project && typeof body.project === 'object') {
    context = buildCircuitContext({
      project: body.project,
      issues: body.issues,
      simulation: body.simResult,
      selectedComponentId: body.selectedObjectId,
      practiceContext: body.practiceContext,
      locale: body.locale || body.context?.locale,
    });
  } else if (body?.context && typeof body.context === 'object') {
    context = {
      locale: body.context.locale === 'en' ? 'en' : 'vi',
      revision: Number(body.context.revision) || 1,
      components: [],
      connections: [],
      connectionsCount: 0,
      issues: [],
      practiceContext: normalizePracticeContext(body.context.practiceContext),
    };
  }
  return { prompt, history, context };
}
