import { ComponentInstance, Connection } from '../domain/project/types';

export interface AIProposal {
  proposalId: string;
  explanation: string;
  baseRevision: number;
  componentsToAdd: ComponentInstance[];
  connectionsToAdd: Connection[];
  layoutDescription: string;
  suggestedActions?: string[];
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  proposal?: AIProposal | any;
}
