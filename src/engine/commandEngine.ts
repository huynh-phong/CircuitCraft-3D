import {
  ProjectDocument,
  Command,
  Transaction,
  ComponentInstance,
  ConnectionWire,
  WireRoute,
  Vector3D,
} from '../types/circuit.ts';

export interface CommandHistoryState {
  past: Transaction[];
  future: Transaction[];
  canUndo: boolean;
  canRedo: boolean;
}

export class CommandHistory {
  private past: Transaction[] = [];
  private future: Transaction[] = [];
  private maxHistory: number = 50;

  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public getPast(): readonly Transaction[] {
    return this.past;
  }

  public getFuture(): readonly Transaction[] {
    return this.future;
  }

  public getState(): CommandHistoryState {
    return {
      past: [...this.past],
      future: [...this.future],
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * Executes an atomic transaction consisting of one or more commands.
   * If any command fails, the entire transaction is aborted and the document remains completely untouched.
   * On success, revision is incremented, transaction is recorded, and the redo stack (future) is cleared.
   */
  public execute(
    currentDoc: ProjectDocument,
    description: string,
    commands: Command[]
  ): ProjectDocument {
    if (!commands || commands.length === 0) return currentDoc;

    let tempDoc = currentDoc;

    // Execute commands sequentially; if any throws, abort without modifying currentDoc
    for (let i = 0; i < commands.length; i++) {
      try {
        tempDoc = commands[i].execute(tempDoc);
      } catch (err) {
        // Atomic abort: no partial document mutation, no history mutation
        throw new Error(
          `Giao dịch thất bại tại lệnh ${i + 1}/${commands.length} ("${commands[i].description || commands[i].type}"): ${(err as Error).message}`
        );
      }
    }

    // Increment monotonic revision and update timestamp
    const updatedDoc: ProjectDocument = {
      ...tempDoc,
      revision: currentDoc.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    const tx: Transaction = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      description,
      commands,
      timestamp: Date.now(),
    };

    this.past.push(tx);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }

    // New action after undo strictly clears the redo stack
    this.future = [];

    return updatedDoc;
  }

  /**
   * Undoes the most recent transaction, rolling back all its commands in reverse order.
   */
  public undo(currentDoc: ProjectDocument): ProjectDocument | null {
    if (!this.canUndo()) return null;

    const tx = this.past.pop()!;
    let doc = currentDoc;

    // Rollback commands in reverse order
    for (let i = tx.commands.length - 1; i >= 0; i--) {
      doc = tx.commands[i].undo(doc);
    }

    const revertedDoc: ProjectDocument = {
      ...doc,
      revision: currentDoc.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    this.future.push(tx);
    return revertedDoc;
  }

  /**
   * Redoes the most recently undone transaction, replaying commands in forward order.
   */
  public redo(currentDoc: ProjectDocument): ProjectDocument | null {
    if (!this.canRedo()) return null;

    const tx = this.future.pop()!;
    let doc = currentDoc;

    for (const cmd of tx.commands) {
      doc = cmd.execute(doc);
    }

    const replayedDoc: ProjectDocument = {
      ...doc,
      revision: currentDoc.revision + 1,
      updatedAt: new Date().toISOString(),
    };

    this.past.push(tx);
    return replayedDoc;
  }

  public clear(): void {
    this.past = [];
    this.future = [];
  }
}

// ==========================================
// Concrete Commands with Precondition Checks
// ==========================================

export class AddComponentCommand implements Command {
  id = 'cmd_add_comp_' + Math.random().toString(36).substring(2, 8);
  type = 'ADD_COMPONENT';
  description: string;

  constructor(private component: ComponentInstance) {
    this.description = `Thêm linh kiện ${component.name}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    if (!this.component || !this.component.id) {
      throw new Error('Linh kiện không hợp lệ hoặc thiếu ID');
    }
    const exists = doc.components.some((c) => c.id === this.component.id);
    if (exists) {
      throw new Error(`Linh kiện với ID "${this.component.id}" đã tồn tại trong dự án`);
    }

    return {
      ...doc,
      components: [...doc.components, this.component],
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    return {
      ...doc,
      components: doc.components.filter((c) => c.id !== this.component.id),
      connections: doc.connections.filter(
        (w) =>
          w.fromComponentId !== this.component.id &&
          w.toComponentId !== this.component.id
      ),
      wireRoutes: doc.wireRoutes
        ? doc.wireRoutes.filter((r) =>
            doc.connections.some(
              (w) =>
                w.id === r.connectionId &&
                w.fromComponentId !== this.component.id &&
                w.toComponentId !== this.component.id
            )
          )
        : undefined,
    };
  }
}

export class RemoveComponentCommand implements Command {
  id = 'cmd_remove_comp_' + Math.random().toString(36).substring(2, 8);
  type = 'REMOVE_COMPONENT';
  description: string;
  private removedComponent?: ComponentInstance;
  private removedConnections: ConnectionWire[] = [];
  private removedWireRoutes: WireRoute[] = [];

  constructor(private componentId: string) {
    this.description = `Xóa linh kiện ${componentId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const target = doc.components.find((c) => c.id === this.componentId);
    if (!target) {
      throw new Error(`Không tìm thấy linh kiện "${this.componentId}" để xóa`);
    }

    this.removedComponent = { ...target };
    this.removedConnections = doc.connections.filter(
      (w) =>
        w.fromComponentId === this.componentId ||
        w.toComponentId === this.componentId
    );

    const removedConnectionIdSet = new Set(this.removedConnections.map((c) => c.id));
    if (doc.wireRoutes) {
      this.removedWireRoutes = doc.wireRoutes.filter((r) =>
        removedConnectionIdSet.has(r.connectionId)
      );
    }

    return {
      ...doc,
      components: doc.components.filter((c) => c.id !== this.componentId),
      connections: doc.connections.filter(
        (w) => !removedConnectionIdSet.has(w.id)
      ),
      wireRoutes: doc.wireRoutes
        ? doc.wireRoutes.filter((r) => !removedConnectionIdSet.has(r.connectionId))
        : undefined,
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    if (!this.removedComponent) return doc;

    return {
      ...doc,
      components: [...doc.components, this.removedComponent],
      connections: [...doc.connections, ...this.removedConnections],
      wireRoutes: doc.wireRoutes
        ? [...doc.wireRoutes, ...this.removedWireRoutes]
        : this.removedWireRoutes.length > 0
        ? [...this.removedWireRoutes]
        : undefined,
    };
  }
}

export class MoveComponentCommand implements Command {
  id = 'cmd_move_' + Math.random().toString(36).substring(2, 8);
  type = 'MOVE_COMPONENT';
  description: string;
  private prevPosition: Vector3D;

  constructor(
    private componentId: string,
    private newPosition: Vector3D,
    prevPosition?: Vector3D
  ) {
    this.description = `Di chuyển linh kiện ${componentId}`;
    this.prevPosition = prevPosition ? { ...prevPosition } : { x: 0, y: 0, z: 0 };
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const comp = doc.components.find((c) => c.id === this.componentId);
    if (!comp) {
      throw new Error(`Không tìm thấy linh kiện "${this.componentId}" để di chuyển`);
    }

    (['x', 'y', 'z'] as const).forEach((axis) => {
      const val = this.newPosition[axis];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error(`Tọa độ vị trí ${axis} không hợp lệ: ${val}`);
      }
    });

    if (!this.prevPosition || (this.prevPosition.x === 0 && this.prevPosition.y === 0 && this.prevPosition.z === 0)) {
      this.prevPosition = { ...comp.position };
    }

    return {
      ...doc,
      components: doc.components.map((c) =>
        c.id === this.componentId ? { ...c, position: { ...this.newPosition } } : c
      ),
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    return {
      ...doc,
      components: doc.components.map((c) =>
        c.id === this.componentId ? { ...c, position: { ...this.prevPosition } } : c
      ),
    };
  }
}

export class RotateComponentCommand implements Command {
  id = 'cmd_rotate_' + Math.random().toString(36).substring(2, 8);
  type = 'ROTATE_COMPONENT';
  description: string;
  private prevRotation: number;

  constructor(
    private componentId: string,
    private newRotation: number,
    prevRotation?: number
  ) {
    this.description = `Xoay linh kiện ${componentId}`;
    this.prevRotation = prevRotation !== undefined ? prevRotation : 0;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const comp = doc.components.find((c) => c.id === this.componentId);
    if (!comp) {
      throw new Error(`Không tìm thấy linh kiện "${this.componentId}" để xoay`);
    }

    if (typeof this.newRotation !== 'number' || !Number.isFinite(this.newRotation)) {
      throw new Error(`Góc xoay không hợp lệ: ${this.newRotation}`);
    }

    if (this.prevRotation === undefined) {
      this.prevRotation = comp.rotation;
    }

    return {
      ...doc,
      components: doc.components.map((c) =>
        c.id === this.componentId ? { ...c, rotation: this.newRotation } : c
      ),
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    return {
      ...doc,
      components: doc.components.map((c) =>
        c.id === this.componentId ? { ...c, rotation: this.prevRotation } : c
      ),
    };
  }
}

export class UpdatePropertyCommand implements Command {
  id = 'cmd_prop_' + Math.random().toString(36).substring(2, 8);
  type = 'UPDATE_PROPERTY';
  description: string;
  private prevProperties: Record<string, any>;

  constructor(
    private componentId: string,
    private newProperties: Record<string, any>,
    prevProperties?: Record<string, any>
  ) {
    this.description = `Cập nhật thông số linh kiện ${componentId}`;
    this.prevProperties = prevProperties ? { ...prevProperties } : {};
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const comp = doc.components.find((c) => c.id === this.componentId);
    if (!comp) {
      throw new Error(`Không tìm thấy linh kiện "${this.componentId}" để cập nhật thông số`);
    }

    if (Object.keys(this.prevProperties).length === 0) {
      this.prevProperties = { ...comp.properties };
    }

    return {
      ...doc,
      components: doc.components.map((c) =>
        c.id === this.componentId
          ? { ...c, properties: { ...c.properties, ...this.newProperties } }
          : c
      ),
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    return {
      ...doc,
      components: doc.components.map((c) =>
        c.id === this.componentId
          ? { ...c, properties: { ...this.prevProperties } }
          : c
      ),
    };
  }
}

export class AddConnectionCommand implements Command {
  id = 'cmd_add_wire_' + Math.random().toString(36).substring(2, 8);
  type = 'ADD_CONNECTION';
  description: string;

  constructor(
    private wire: ConnectionWire,
    private wireRoute?: WireRoute
  ) {
    this.description = `Nối dây giữa ${wire.fromComponentId}:${wire.fromPinId} và ${wire.toComponentId}:${wire.toPinId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    if (!this.wire || !this.wire.id) {
      throw new Error('Dây nối không hợp lệ hoặc thiếu ID');
    }

    // 1. Check self connection
    if (
      this.wire.fromComponentId === this.wire.toComponentId &&
      this.wire.fromPinId === this.wire.toPinId
    ) {
      throw new Error(`Không thể nối chân pin "${this.wire.fromPinId}" vào chính nó`);
    }

    // 2. Check duplicate wire ID
    if (doc.connections.some((w) => w.id === this.wire.id)) {
      throw new Error(`Dây nối với ID "${this.wire.id}" đã tồn tại`);
    }

    // 3. Check components existence
    const fromComp = doc.components.find((c) => c.id === this.wire.fromComponentId);
    if (!fromComp) {
      throw new Error(`Linh kiện nguồn "${this.wire.fromComponentId}" không tồn tại`);
    }

    const toComp = doc.components.find((c) => c.id === this.wire.toComponentId);
    if (!toComp) {
      throw new Error(`Linh kiện đích "${this.wire.toComponentId}" không tồn tại`);
    }

    // 4. Check pin existence
    const fromPinExists = fromComp.pins.some((p) => p.id === this.wire.fromPinId);
    if (!fromPinExists) {
      throw new Error(
        `Chân pin "${this.wire.fromPinId}" không tồn tại trên linh kiện "${fromComp.id}"`
      );
    }

    const toPinExists = toComp.pins.some((p) => p.id === this.wire.toPinId);
    if (!toPinExists) {
      throw new Error(
        `Chân pin "${this.wire.toPinId}" không tồn tại trên linh kiện "${toComp.id}"`
      );
    }

    // 5. Check duplicate connection between same pin pair
    const duplicate = doc.connections.some(
      (w) =>
        (w.fromComponentId === this.wire.fromComponentId &&
          w.fromPinId === this.wire.fromPinId &&
          w.toComponentId === this.wire.toComponentId &&
          w.toPinId === this.wire.toPinId) ||
        (w.fromComponentId === this.wire.toComponentId &&
          w.fromPinId === this.wire.toPinId &&
          w.toComponentId === this.wire.fromComponentId &&
          w.toPinId === this.wire.fromPinId)
    );
    if (duplicate) {
      throw new Error(
        `Đã tồn tại đường dây kết nối giữa hai chân pin này`
      );
    }

    const nextWireRoutes = this.wireRoute
      ? [...(doc.wireRoutes || []), this.wireRoute]
      : doc.wireRoutes;

    return {
      ...doc,
      connections: [...doc.connections, this.wire],
      wireRoutes: nextWireRoutes,
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    return {
      ...doc,
      connections: doc.connections.filter((w) => w.id !== this.wire.id),
      wireRoutes: doc.wireRoutes
        ? doc.wireRoutes.filter((r) => r.connectionId !== this.wire.id)
        : undefined,
    };
  }
}

export class RemoveConnectionCommand implements Command {
  id = 'cmd_remove_wire_' + Math.random().toString(36).substring(2, 8);
  type = 'REMOVE_CONNECTION';
  description: string;
  private removedWire?: ConnectionWire;
  private removedWireRoute?: WireRoute;

  constructor(private wireId: string) {
    this.description = `Xóa dây nối ${wireId}`;
  }

  execute(doc: ProjectDocument): ProjectDocument {
    const wire = doc.connections.find((w) => w.id === this.wireId);
    if (!wire) {
      throw new Error(`Không tìm thấy dây nối "${this.wireId}" để xóa`);
    }

    this.removedWire = { ...wire };
    if (doc.wireRoutes) {
      const route = doc.wireRoutes.find((r) => r.connectionId === this.wireId);
      if (route) {
        this.removedWireRoute = { ...route, waypoints: [...route.waypoints] };
      }
    }

    return {
      ...doc,
      connections: doc.connections.filter((w) => w.id !== this.wireId),
      wireRoutes: doc.wireRoutes
        ? doc.wireRoutes.filter((r) => r.connectionId !== this.wireId)
        : undefined,
    };
  }

  undo(doc: ProjectDocument): ProjectDocument {
    if (!this.removedWire) return doc;

    const nextWireRoutes =
      this.removedWireRoute && doc.wireRoutes
        ? [...doc.wireRoutes, this.removedWireRoute]
        : this.removedWireRoute
        ? [this.removedWireRoute]
        : doc.wireRoutes;

    return {
      ...doc,
      connections: [...doc.connections, this.removedWire],
      wireRoutes: nextWireRoutes,
    };
  }
}
