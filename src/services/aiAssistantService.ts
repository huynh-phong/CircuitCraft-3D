import { ProjectDocument, AIProposal, Command } from '../types/circuit.ts';
import { AddComponentCommand, AddConnectionCommand, UpdatePropertyCommand } from '../engine/commandEngine.ts';
import { COMPONENT_CATALOG } from '../domain/componentLibrary.ts';

const WHITELIST_COMPONENTS = ['dc_power_supply', 'resistor', 'led', 'switch_spst'];

export class AIAssistantService {
  public static async requestCircuitProposal(
    prompt: string,
    doc: ProjectDocument,
    mode: 'explain' | 'suggest_fix' | 'generate_circuit' = 'suggest_fix'
  ): Promise<AIProposal> {
    const payload = {
      prompt,
      mode,
      circuitSnapshot: {
        id: doc.id,
        revision: doc.revision,
        componentCount: doc.components.length,
        components: doc.components.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          properties: c.properties,
        })),
        connections: doc.connections.map((w) => ({
          from: `${w.fromComponentId}:${w.fromPinId}`,
          to: `${w.toComponentId}:${w.toPinId}`,
        })),
      },
    };

    const response = await fetch('/api/ai/circuit-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Lỗi kết nối máy chủ AI (${response.status})`);
    }

    const data: AIProposal = await response.json();

    // Whitelist and Safety Sanitizer
    const sanitizedChanges = (data.changes || []).filter((ch) => {
      if (ch.action === 'add_component') {
        return WHITELIST_COMPONENTS.includes(ch.payload?.type);
      }
      if (ch.action === 'add_connection') {
        return Boolean(ch.payload?.fromComponentId && ch.payload?.toComponentId);
      }
      if (ch.action === 'update_property') {
        return Boolean(ch.payload?.componentId && ch.payload?.properties);
      }
      return true;
    });

    return {
      ...data,
      baseRevision: doc.revision,
      changes: sanitizedChanges,
    };
  }

  public static buildProposalCommands(proposal: AIProposal, _currentDoc: ProjectDocument): Command[] {
    const commands: Command[] = [];

    for (const change of proposal.changes) {
      if (change.action === 'add_component') {
        const type = change.payload.type;
        const meta = COMPONENT_CATALOG[type as keyof typeof COMPONENT_CATALOG];
        if (meta) {
          commands.push(
            new AddComponentCommand({
              id: 'comp_ai_' + Math.random().toString(36).substring(2, 7),
              type,
              name: change.payload.name || meta.title,
              position: change.payload.position || { x: 0, y: 0, z: 0 },
              rotation: change.payload.rotation || 0,
              properties: { ...meta.defaultProperties, ...(change.payload.properties || {}) },
              pins: [...meta.pins],
            })
          );
        }
      } else if (change.action === 'add_connection') {
        commands.push(
          new AddConnectionCommand({
            id: 'wire_ai_' + Math.random().toString(36).substring(2, 7),
            fromComponentId: change.payload.fromComponentId,
            fromPinId: change.payload.fromPinId,
            toComponentId: change.payload.toComponentId,
            toPinId: change.payload.toPinId,
            color: change.payload.color || '#3b82f6',
          })
        );
      } else if (change.action === 'update_property') {
        commands.push(
          new UpdatePropertyCommand(
            change.payload.componentId,
            change.payload.properties,
            change.payload.prevProperties || {}
          )
        );
      }
    }

    return commands;
  }
}
