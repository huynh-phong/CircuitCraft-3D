import { Command } from './types';
import {
  ProjectDocument,
  ComponentInstance,
  Connection,
  Vector3D,
  Rotation3D,
  BoardDefinition,
} from '../project/types';
import { cloneProjectDocument } from '../project/document';

/**
 * Helper to update document revision and timestamp
 */
function bumpRevision(doc: ProjectDocument): ProjectDocument {
  return {
    ...doc,
    revision: doc.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add Component
 */
export class AddComponentCommand implements Command {
  id = `add-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(private component: ComponentInstance) {
    this.description = `Thêm linh kiện ${component.name}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.components.push({ ...this.component });
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.components = next.components.filter((c) => c.instanceId !== this.component.instanceId);
    return bumpRevision(next);
  }
}

/**
 * Move Component
 */
export class MoveComponentCommand implements Command {
  id = `move-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(
    private componentId: string,
    private oldPos: Vector3D,
    private newPos: Vector3D
  ) {
    this.description = `Di chuyển linh kiện ${componentId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.components.find((c) => c.instanceId === this.componentId);
    if (target) {
      target.position = { ...this.newPos };
    }
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.components.find((c) => c.instanceId === this.componentId);
    if (target) {
      target.position = { ...this.oldPos };
    }
    return bumpRevision(next);
  }
}

/**
 * Rotate Component
 */
export class RotateComponentCommand implements Command {
  id = `rot-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(
    private componentId: string,
    private oldRot: Rotation3D,
    private newRot: Rotation3D
  ) {
    this.description = `Xoay linh kiện ${componentId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.components.find((c) => c.instanceId === this.componentId);
    if (target) {
      target.rotation = { ...this.newRot };
    }
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.components.find((c) => c.instanceId === this.componentId);
    if (target) {
      target.rotation = { ...this.oldRot };
    }
    return bumpRevision(next);
  }
}

/**
 * Delete Component (Atomic: restores component AND all its incident connections on undo)
 */
export class DeleteComponentCommand implements Command {
  id = `del-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;
  private removedComponent?: ComponentInstance;
  private removedConnections: Connection[] = [];

  constructor(private componentId: string) {
    this.description = `Xóa linh kiện ${componentId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    this.removedComponent = next.components.find((c) => c.instanceId === this.componentId);
    this.removedConnections = next.connections.filter(
      (conn) => conn.fromComponentId === this.componentId || conn.toComponentId === this.componentId
    );

    next.components = next.components.filter((c) => c.instanceId !== this.componentId);
    next.connections = next.connections.filter(
      (conn) => conn.fromComponentId !== this.componentId && conn.toComponentId !== this.componentId
    );
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    if (this.removedComponent) {
      next.components.push({ ...this.removedComponent });
    }
    for (const conn of this.removedConnections) {
      next.connections.push({ ...conn });
    }
    return bumpRevision(next);
  }
}

/**
 * Update Component Parameters
 */
export class UpdateComponentParameterCommand implements Command {
  id = `param-comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(
    private componentId: string,
    private paramName: string,
    private oldValue: any,
    private newValue: any
  ) {
    this.description = `Đổi thông số ${paramName} của ${componentId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.components.find((c) => c.instanceId === this.componentId);
    if (target) {
      target.parameters = { ...target.parameters, [this.paramName]: this.newValue };
    }
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.components.find((c) => c.instanceId === this.componentId);
    if (target) {
      target.parameters = { ...target.parameters, [this.paramName]: this.oldValue };
    }
    return bumpRevision(next);
  }
}

/**
 * Create Connection
 */
export class CreateConnectionCommand implements Command {
  id = `conn-create-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(private connection: Connection) {
    this.description = `Nối chân ${connection.fromComponentId}:${connection.fromPinId} với ${connection.toComponentId}:${connection.toPinId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    // Disallow exact duplicate
    const exists = next.connections.some(
      (c) =>
        (c.fromComponentId === this.connection.fromComponentId &&
          c.fromPinId === this.connection.fromPinId &&
          c.toComponentId === this.connection.toComponentId &&
          c.toPinId === this.connection.toPinId) ||
        (c.fromComponentId === this.connection.toComponentId &&
          c.fromPinId === this.connection.toPinId &&
          c.toComponentId === this.connection.fromComponentId &&
          c.toPinId === this.connection.fromPinId)
    );
    if (!exists) {
      next.connections.push({ ...this.connection });
    }
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.connections = next.connections.filter((c) => c.id !== this.connection.id);
    return bumpRevision(next);
  }
}

/**
 * Delete Connection
 */
export class DeleteConnectionCommand implements Command {
  id = `conn-del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;
  private removedConnection?: Connection;

  constructor(private connectionId: string) {
    this.description = `Xóa dây nối ${connectionId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    this.removedConnection = next.connections.find((c) => c.id === this.connectionId);
    next.connections = next.connections.filter((c) => c.id !== this.connectionId);
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    if (this.removedConnection) {
      next.connections.push({ ...this.removedConnection });
    }
    return bumpRevision(next);
  }
}

/**
 * Update Connection (Color, Thickness, WireStyle, Sag)
 */
export class UpdateConnectionCommand implements Command {
  id = `conn-update-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(
    private connectionId: string,
    private oldProps: Partial<Connection>,
    private newProps: Partial<Connection>
  ) {
    this.description = `Cập nhật dây nối ${connectionId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.connections.find((c) => c.id === this.connectionId);
    if (target) {
      Object.assign(target, this.newProps);
    }
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    const target = next.connections.find((c) => c.id === this.connectionId);
    if (target) {
      Object.assign(target, this.oldProps);
    }
    return bumpRevision(next);
  }
}

/**
 * Batch Command (Transaction: grouped sub-commands executed and undone together atomically)
 */
export class BatchCommand implements Command {
  id = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  constructor(
    public description: string,
    private commands: Command[]
  ) {}

  execute(doc: ProjectDocument): ProjectDocument {
    let current = doc;
    for (const cmd of this.commands) {
      current = cmd.execute(current);
    }
    return current;
  }

  undo(doc: ProjectDocument): ProjectDocument {
    let current = doc;
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      current = this.commands[i].undo(current);
    }
    return current;
  }
}

/**
 * Resize Board Command (Corner drag resize in Select Mode)
 */
export class ResizeBoardCommand implements Command {
  id = `resize-board-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(
    private oldBoard: BoardDefinition,
    private newBoard: BoardDefinition
  ) {
    this.description = `Thay đổi kích thước bo mạch: ${newBoard.width} × ${newBoard.depth} mm`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.board = { ...this.newBoard };
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.board = { ...this.oldBoard };
    return bumpRevision(next);
  }
}

/**
 * Cut Board Command (Board cutting tool operation)
 */
export class CutBoardCommand implements Command {
  id = `cut-board-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description = 'Cắt góc bo mạch';

  constructor(
    private oldBoard: BoardDefinition,
    private newBoard: BoardDefinition
  ) {}

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.board = { ...this.newBoard };
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.board = { ...this.oldBoard };
    return bumpRevision(next);
  }
}

/**
 * Change Board Shape Command
 */
export class ChangeBoardShapeCommand implements Command {
  id = `shape-board-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  description: string;

  constructor(
    private oldBoard: BoardDefinition,
    private newBoard: BoardDefinition
  ) {
    this.description = `Đổi hình dạng bo mạch: ${newBoard.shape || 'rectangle'}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.board = { ...this.newBoard };
    return bumpRevision(next);
  }

  undo(doc: ProjectDocument): ProjectDocument {
    const next = cloneProjectDocument(doc);
    next.board = { ...this.oldBoard };
    return bumpRevision(next);
  }
}

