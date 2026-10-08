import { ProjectDocument } from '../project/types';

export interface Command {
  id: string;
  description: string;
  execute(doc: ProjectDocument): ProjectDocument;
  undo(doc: ProjectDocument): ProjectDocument;
}
