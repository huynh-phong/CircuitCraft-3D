import { ComponentInstance, Connection, ProjectDocument } from '../project/types';
import { COMPONENT_DEFINITION_MAP } from '../components/definitions';
import { resolveDefinitionId, resolvePinId } from '../components/aliases';

/**
 * Validation of AI circuit proposals BEFORE they are previewed / applied.
 *
 * AI output is untrusted structured data: every component id, definition id, pin id and
 * connection is checked against the component library and the current document. Nothing is
 * executed; an invalid proposal is never applied and the project stays untouched.
 */

export const PROPOSAL_LIMITS = { maxComponents: 40, maxConnections: 80 };

export interface NormalizedProposal {
  proposalId: string;
  explanation: string;
  baseRevision: number;
  layoutDescription: string;
  componentsToAdd: ComponentInstance[];
  connectionsToAdd: Connection[];
  suggestedActions?: string[];
  source?: 'ai' | 'template';
}

export interface ProposalValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  proposal: NormalizedProposal | null;
}

const HEX_COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function finite(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function vec(v: any) {
  return { x: finite(v?.x), y: finite(v?.y), z: finite(v?.z) };
}

/**
 * @param raw   proposal as received from the AI service (any shape)
 * @param doc   current project document, or null for structural-only validation (server side)
 */
export function validateAIProposal(raw: any, doc: ProjectDocument | null): ProposalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Đề xuất AI không đúng định dạng JSON.'], warnings, proposal: null };
  }
  const rawComps: any[] = Array.isArray(raw.componentsToAdd) ? raw.componentsToAdd : [];
  const rawConns: any[] = Array.isArray(raw.connectionsToAdd) ? raw.connectionsToAdd : [];
  if (!Array.isArray(raw.componentsToAdd) || !Array.isArray(raw.connectionsToAdd)) {
    errors.push('Đề xuất phải có danh sách componentsToAdd và connectionsToAdd.');
  }
  if (rawComps.length > PROPOSAL_LIMITS.maxComponents) {
    errors.push(`Đề xuất có quá nhiều linh kiện (${rawComps.length} > ${PROPOSAL_LIMITS.maxComponents}).`);
  }
  if (rawConns.length > PROPOSAL_LIMITS.maxConnections) {
    errors.push(`Đề xuất có quá nhiều dây nối (${rawConns.length} > ${PROPOSAL_LIMITS.maxConnections}).`);
  }

  const existingComponents = new Map((doc?.components || []).map((c) => [c.instanceId, c]));
  const usedIds = new Set(existingComponents.keys());
  const renamed = new Map<string, string>();
  const proposedComponents = new Map<string, ComponentInstance>();
  const componentsToAdd: ComponentInstance[] = [];

  rawComps.slice(0, PROPOSAL_LIMITS.maxComponents).forEach((rc, idx) => {
    const label = `Linh kiện #${idx + 1}`;
    const rawDefId = typeof rc?.definitionId === 'string' ? rc.definitionId : typeof rc?.type === 'string' ? rc.type : '';
    const definitionId = resolveDefinitionId(rawDefId);
    const def = COMPONENT_DEFINITION_MAP.get(definitionId);
    if (!def) {
      errors.push(`${label}: loại linh kiện "${rawDefId || '(trống)'}" không có trong thư viện.`);
      return;
    }
    if (rawDefId !== definitionId) {
      warnings.push(`${label}: đã chuẩn hóa mã linh kiện "${rawDefId}" → "${definitionId}".`);
    }

    let instanceId = typeof rc?.instanceId === 'string' && rc.instanceId.trim() ? rc.instanceId.trim() : '';
    const originalId = instanceId;
    if (!instanceId || usedIds.has(instanceId)) {
      let n = 1;
      const base = (instanceId || `ai-${definitionId}`).replace(/[^a-zA-Z0-9_-]/g, '-');
      while (usedIds.has(`${base}-${n}`)) n += 1;
      instanceId = `${base}-${n}`;
      if (originalId) {
        warnings.push(`${label}: mã "${originalId}" bị trùng, đã đổi thành "${instanceId}".`);
        renamed.set(originalId, instanceId);
      }
    }
    usedIds.add(instanceId);

    const params = rc?.parameters && typeof rc.parameters === 'object' && !Array.isArray(rc.parameters)
      ? rc.parameters
      : rc?.properties && typeof rc.properties === 'object'
      ? rc.properties
      : {};

    const comp: ComponentInstance = {
      instanceId,
      definitionId,
      name: typeof rc?.name === 'string' && rc.name.trim() ? rc.name.trim().slice(0, 80) : def.name,
      position: vec(rc?.position),
      rotation: vec(rc?.rotation),
      parameters: { ...def.defaultParameters, ...params },
    };
    proposedComponents.set(originalId || instanceId, comp);
    if (originalId && originalId !== instanceId) proposedComponents.set(instanceId, comp);
    componentsToAdd.push(comp);
  });

  const lookupComponent = (id: string): ComponentInstance | undefined => {
    if (proposedComponents.has(id)) return proposedComponents.get(id);
    if (renamed.has(id)) return proposedComponents.get(renamed.get(id)!);
    return existingComponents.get(id);
  };

  const resolvePin = (comp: ComponentInstance, pinId: string): string | null => {
    const stored = COMPONENT_DEFINITION_MAP.get(comp.definitionId) || COMPONENT_DEFINITION_MAP.get(resolveDefinitionId(comp.definitionId));
    if (!stored || typeof pinId !== 'string' || !pinId) return null;
    if (stored.pins.some((p) => p.id === pinId)) return pinId;
    const canonical = resolvePinId(comp.definitionId, pinId);
    return stored.pins.some((p) => p.id === canonical) ? canonical : null;
  };

  const usedConnIds = new Set((doc?.connections || []).map((c) => c.id));
  const seenPairs = new Set(
    (doc?.connections || []).map((c) => [`${c.fromComponentId}:${c.fromPinId}`, `${c.toComponentId}:${c.toPinId}`].sort().join('|'))
  );
  const connectionsToAdd: Connection[] = [];

  rawConns.slice(0, PROPOSAL_LIMITS.maxConnections).forEach((rc, idx) => {
    const label = `Dây nối #${idx + 1}`;
    const from = lookupComponent(String(rc?.fromComponentId || ''));
    const to = lookupComponent(String(rc?.toComponentId || ''));
    if (!from) {
      errors.push(`${label}: linh kiện nguồn "${rc?.fromComponentId}" không tồn tại.`);
      return;
    }
    if (!to) {
      errors.push(`${label}: linh kiện đích "${rc?.toComponentId}" không tồn tại.`);
      return;
    }
    const fromPin = resolvePin(from, rc?.fromPinId);
    const toPin = resolvePin(to, rc?.toPinId);
    if (!fromPin) {
      errors.push(`${label}: chân "${rc?.fromPinId}" không tồn tại trên ${from.name} (${from.definitionId}).`);
      return;
    }
    if (!toPin) {
      errors.push(`${label}: chân "${rc?.toPinId}" không tồn tại trên ${to.name} (${to.definitionId}).`);
      return;
    }
    if (from.instanceId === to.instanceId && fromPin === toPin) {
      errors.push(`${label}: không thể nối một chân với chính nó.`);
      return;
    }
    const pairKey = [`${from.instanceId}:${fromPin}`, `${to.instanceId}:${toPin}`].sort().join('|');
    if (seenPairs.has(pairKey)) {
      warnings.push(`${label}: dây nối trùng lặp đã bị bỏ qua.`);
      return;
    }
    seenPairs.add(pairKey);

    let id = typeof rc?.id === 'string' && rc.id.trim() ? rc.id.trim() : '';
    if (!id || usedConnIds.has(id)) {
      let n = 1;
      while (usedConnIds.has(`ai-wire-${n}`)) n += 1;
      id = `ai-wire-${n}`;
    }
    usedConnIds.add(id);
    connectionsToAdd.push({
      id,
      fromComponentId: from.instanceId,
      fromPinId: fromPin,
      toComponentId: to.instanceId,
      toPinId: toPin,
      wireColor: typeof rc?.wireColor === 'string' && HEX_COLOR.test(rc.wireColor) ? rc.wireColor : '#06b6d4',
    });
  });

  if (componentsToAdd.length === 0 && connectionsToAdd.length === 0 && errors.length === 0) {
    errors.push('Đề xuất không chứa thay đổi nào để áp dụng.');
  }

  const baseRevision = finite(raw.baseRevision, NaN);
  if (doc && Number.isFinite(baseRevision) && baseRevision !== doc.revision) {
    warnings.push(
      `Mạch đã thay đổi kể từ khi AI tạo đề xuất (revision ${baseRevision} → ${doc.revision}); đề xuất đã được kiểm tra lại với mạch hiện tại.`
    );
  }

  const proposal: NormalizedProposal = {
    proposalId: typeof raw.proposalId === 'string' && raw.proposalId ? raw.proposalId : `prop_${Date.now()}`,
    explanation: typeof raw.explanation === 'string' ? raw.explanation.slice(0, 2000) : '',
    layoutDescription: typeof raw.layoutDescription === 'string' ? raw.layoutDescription.slice(0, 1000) : '',
    baseRevision: Number.isFinite(baseRevision) ? baseRevision : doc?.revision ?? 0,
    componentsToAdd,
    connectionsToAdd,
    suggestedActions: Array.isArray(raw.suggestedActions) ? raw.suggestedActions.map(String).slice(0, 10) : undefined,
    source: raw.source === 'template' ? 'template' : 'ai',
  };

  return { valid: errors.length === 0, errors, warnings, proposal };
}
