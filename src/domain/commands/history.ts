import { Command } from './types';
import { ProjectDocument } from '../project/types';

export class CommandHistory {
  private past: Command[] = [];
  private future: Command[] = [];
  private maxHistory = 50;

  constructor(private document: ProjectDocument) {}

  public get currentDocument(): ProjectDocument {
    return this.document;
  }

  public setDocument(doc: ProjectDocument): void {
    this.document = doc;
    this.past = [];
    this.future = [];
  }

  public execute(cmd: Command): ProjectDocument {
    try {
      const nextDoc = cmd.execute(this.document);
      this.document = nextDoc;
      this.past.push(cmd);
      if (this.past.length > this.maxHistory) {
        this.past.shift();
      }
      // When a new command is executed, all redo history is cleared
      this.future = [];
      return this.document;
    } catch (err) {
      console.error('Lỗi khi thực thi lệnh:', err);
      // Atomic failure: document remains untouched
      return this.document;
    }
  }

  public undo(): ProjectDocument | null {
    if (this.past.length === 0) return null;
    const cmd = this.past.pop()!;
    try {
      this.document = cmd.undo(this.document);
      this.future.push(cmd);
      return this.document;
    } catch (err) {
      console.error('Lỗi khi hoàn tác lệnh:', err);
      return null;
    }
  }

  public redo(): ProjectDocument | null {
    if (this.future.length === 0) return null;
    const cmd = this.future.pop()!;
    try {
      this.document = cmd.execute(this.document);
      this.past.push(cmd);
      return this.document;
    } catch (err) {
      console.error('Lỗi khi làm lại lệnh:', err);
      return null;
    }
  }

  public get canUndo(): boolean {
    return this.past.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  public get lastCommandDescription(): string | null {
    return this.past.length > 0 ? this.past[this.past.length - 1].description : null;
  }
}
