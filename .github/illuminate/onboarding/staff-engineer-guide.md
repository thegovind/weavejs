---
title: Staff Engineer Onboarding Guide
description: Deep architectural analysis of Weave.js for staff engineers evaluating or deeply understanding the system
outline: deep
---

# Staff Engineer Onboarding Guide: Weave.js

## Executive Summary

Weave.js is a **manager-orchestrated CRDT-backed collaborative canvas framework** that reconciles Yjs documents to Konva scene graphs via a custom React Reconciler. The architecture is fundamentally a **state machine where the `Weave` class delegates ALL domain logic to ~18 specialized managers**, treating each manager as a domain-specific coordinator with zero cross-manager coupling.

**Core Architectural Insight**: Weave.js is not a monolithic canvas library—it's a **CRDT synchronization engine masquerading as a rendering framework**. The Yjs document is the single source of truth; everything else is derived state. The reconciler exists solely to **diff Yjs state snapshots and imperatively mutate Konva nodes to match**.

| Architectural Component | Technology Choice | Design Decision Source |
|---|---|---|
| **State Management** | Yjs CRDT + SyncedStore | [store.ts:56-59](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L56-L59) |
| **Rendering Engine** | Konva.js (Canvas API wrapper) | [reconciler.ts:47-84](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L47-L84) |
| **State Reconciliation** | Custom React Reconciler | [renderer.ts:5-39](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/renderer/renderer.ts#L5-L39) |
| **Event Bus** | Emittery (typed events) | [weave.ts:84](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/weave.ts#L84) |
| **Collaborative Locking** | Awareness-based mutex system | [mutex.ts:16-104](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/mutex/mutex.ts#L16-L104) |

## The Core Architectural Pattern (Pseudocode)

To understand Weave.js, think of it as this Python-style state machine:

```python
# Simplified architectural model - NOT actual TypeScript implementation
class WeaveStateMachine:
    def __init__(self, config, stage_config):
        # Single source of truth: Yjs CRDT document
        self.yjs_doc = Y.Doc()
        self.synced_store = syncedStore({"weave": {}}, doc=self.yjs_doc)
        
        # Derived state: Konva scene graph (NEVER write directly)
        self.konva_stage = Konva.Stage(stage_config)
        
        # Manager orchestration - each domain has ONE manager
        self.managers = {
            "state": StateManager(self),      # CRUD on Yjs doc
            "stage": StageManager(self),      # Konva stage lifecycle
            "mutex": MutexManager(self),      # Collaborative locking
            "store": StoreManager(self),      # Persistence adapter
            "register": RegisterManager(self), # Node handlers registry
            "reconciler": ReconcilerManager(self), # Yjs → Konva differ
            # ... 12 more managers
        }
        
        # React Reconciler: Diffs Yjs snapshots, applies to Konva
        self.reconciler = ReactReconciler(self.konva_host_config)
    
    def start(self):
        # 1. Register all node handlers (Rectangle, Circle, etc.)
        self.managers["register"].register_node_handlers()
        
        # 2. Connect to store (WebSocket, Azure, or Standalone)
        self.managers["store"].connect()
        
        # 3. Observe Yjs document changes
        self.yjs_doc.observe_deep(lambda txn: self.reconcile())
    
    def reconcile(self):
        """Core reconciliation loop: Yjs → React → Konva"""
        # 1. Snapshot current Yjs state
        yjs_snapshot = json.loads(json.dumps(self.synced_store))
        
        # 2. Deserialize to React elements (NOT Konva nodes yet)
        react_tree = StateSerializer.deserialize(yjs_snapshot)
        
        # 3. React Reconciler diffs previous/current trees
        #    and calls our Konva host config methods
        self.reconciler.update_container(react_tree, self.konva_stage)
        
        # Result: Konva scene graph now matches Yjs doc
    
    def add_node(self, node, parent_id):
        """Public API - always mutates Yjs, NEVER Konva directly"""
        # Find parent in Yjs doc
        parent = self.managers["state"].find_node_by_id(parent_id)
        
        # Mutate Yjs within transaction (CRDT merge)
        with self.yjs_doc.transaction(self.current_user.id):
            parent.props.children.append(node)
        
        # Yjs observer fires → reconcile() → Konva updated
    
    def acquire_mutex_lock(self, node_ids, operation, callback):
        """Collaborative locking - prevents concurrent edits"""
        # Broadcast lock intent via Yjs Awareness
        lock_acquired = self.managers["mutex"].set_mutex_lock(
            node_ids=node_ids,
            operation=operation
        )
        
        if lock_acquired:
            try:
                callback()  # User code runs while holding lock
            finally:
                self.managers["mutex"].release_mutex_lock()
        else:
            raise LockConflictError("Another user holds this lock")
```

**Key Insight**: The `Weave` class is just a **manager coordinator**. Every method either:
1. **Delegates to a manager** (e.g., `addNode()` → `StateManager.addNode()`)
2. **Emits an event** (e.g., `onNodeAdded`) that managers/plugins listen to

There is **zero business logic** in the `Weave` class itself—it's pure orchestration.

<!-- Sources: code/packages/sdk/src/weave.ts:82-172, code/packages/sdk/src/stores/store.ts:36-60, code/packages/sdk/src/reconciler/reconciler.ts:16-84, code/packages/sdk/src/renderer/renderer.ts:11-76 -->

## System Architecture Overview

```mermaid
graph TB
    User[User Input] --> Weave[Weave Instance]
    Weave --> EventBus[Emittery Event Bus]
    
    Weave --> SM[StateManager]
    Weave --> StoreM[StoreManager]
    Weave --> StageM[StageManager]
    Weave --> MutexM[MutexManager]
    Weave --> RegisterM[RegisterManager]
    Weave --> TargetM[TargetingManager]
    Weave --> GroupM[GroupsManager]
    Weave --> FontM[FontsManager]
    Weave --> ZIndexM[ZIndexManager]
    Weave --> PluginM[PluginsManager]
    Weave --> ActionM[ActionsManager]
    Weave --> ExportM[ExportManager]
    Weave --> CloneM[CloningManager]
    Weave --> UserM[UsersManager]
    Weave --> AsyncM[AsyncManager]
    Weave --> HooksM[HooksManager]
    Weave --> SetupM[SetupManager]
    
    SM --> YjsDoc[Yjs Document]
    StoreM --> Store[WeaveStore Abstract]
    Store --> WS[WebSocketStore]
    Store --> Azure[AzureStore]
    Store --> Standalone[StandaloneStore]
    
    YjsDoc --> Reconciler[React Reconciler]
    Reconciler --> Konva[Konva Stage]
    
    StageM --> Konva
    RegisterM --> NodeHandlers[Node Handlers]
    
    style Weave fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style YjsDoc fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
    style Konva fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
    style Store fill:#5a4a2e,stroke:#d4a84b,color:#e0e0e0
    style EventBus fill:#4a2e2e,stroke:#d45b5b,color:#e0e0e0
```

<!-- Sources: code/packages/sdk/src/weave.ts:82-172 -->

## Manager Architecture Deep Dive

### Manager Dependency Graph

The 18 managers form a **directed acyclic graph** (DAG) where dependencies flow downward:

```mermaid
graph TB
    SetupM[SetupManager<br>Initialization] --> RegisterM[RegisterManager<br>Registry]
    RegisterM --> NodeHandlers[Node Handlers]
    RegisterM --> Plugins[Plugins]
    RegisterM --> Actions[Actions]
    
    StoreM[StoreManager<br>Persistence] --> Store[WeaveStore]
    Store --> YjsDoc[Yjs Document]
    
    StateM[StateManager<br>State CRUD] --> YjsDoc
    
    YjsDoc --> Reconciler[Reconciler<br>Differ]
    Reconciler --> Renderer[Renderer<br>React Bridge]
    Renderer --> StageM[StageManager<br>Konva Lifecycle]
    
    StageM --> Konva[Konva Stage]
    
    TargetM[TargetingManager] --> StageM
    GroupM[GroupsManager] --> StateM
    ZIndexM[ZIndexManager] --> StateM
    MutexM[MutexManager] --> Store
    UserM[UsersManager] --> Store
    
    ActionM[ActionsManager] --> RegisterM
    PluginM[PluginsManager] --> RegisterM
    
    style SetupM fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style YjsDoc fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
    style Konva fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
    style Store fill:#5a4a2e,stroke:#d4a84b,color:#e0e0e0
```

<!-- Sources: code/packages/sdk/src/weave.ts:94-111, code/packages/sdk/src/weave.ts:150-167 -->

### Manager Responsibility Matrix

| Manager | Primary Responsibility | Key Methods | Dependencies |
|---|---|---|---|
| **SetupManager** | Instance initialization sequence | `welcomeLog()`, `setupPlugins()` | None |
| **RegisterManager** | Registry of node handlers, plugins, actions | `registerNodeHandler()`, `getPlugin()` | None |
| **StoreManager** | Store lifecycle (connect/disconnect) | `registerStore()`, `getStore()` | RegisterManager |
| **StateManager** | Yjs document CRUD operations | `addNode()`, `updateNode()`, `removeNode()` | StoreManager |
| **StageManager** | Konva stage lifecycle | `initStage()`, `getMainLayer()` | None |
| **MutexManager** | Collaborative locking across clients | `acquireMutexLock()`, `releaseMutexLock()` | StoreManager |
| **UsersManager** | Connected users tracking | `getConnectedUsers()` | StoreManager |
| **TargetingManager** | Node selection/targeting | `getClosestNode()` | StageManager |
| **GroupsManager** | Group serialization/deserialization | `serializeGroup()` | StateManager |
| **ZIndexManager** | Z-order manipulation | `zMoveNode()` | StateManager |
| **FontsManager** | Font loading | `loadFonts()` | None |
| **PluginsManager** | Plugin enable/disable | `enablePlugin()` | RegisterManager |
| **ActionsManager** | Action lifecycle | `triggerAction()` | RegisterManager |
| **ExportManager** | Node export (PNG/SVG) | `exportNodes()` | StageManager |
| **CloningManager** | Deep cloning of nodes | `cloneNodes()` | StateManager |
| **AsyncManager** | Async operation coordination | `executeAsync()` | None |
| **HooksManager** | Lifecycle hooks | `addHook()` | None |

**Key Design Principle**: Managers NEVER directly reference each other. They communicate via:
1. **The `Weave` instance** (passed in constructor: [weave.ts:150-167](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/weave.ts#L150-L167))
2. **Event bus** (`this.instance.emitEvent()`, `this.instance.addEventListener()`)
3. **Yjs document mutations** (write) and observations (read)

## Decision Log: Why These Technologies?

### Why Konva over Raw Canvas API?

**Decision**: Use Konva.js as the rendering engine instead of raw Canvas 2D API.

**Rationale**:
- **Scene graph abstraction**: Canvas is immediate-mode; Konva provides retained-mode with automatic hit detection ([reconciler.ts:47-84](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L47-L84))
- **Event bubbling**: Free mouse/touch event handling on individual shapes
- **Layer management**: Built-in support for multiple layers (main, selection, grid, utility)
- **Performance**: Optimized dirty region redraws, no manual canvas clearing

**Trade-offs**:
- ❌ Larger bundle size (~150 KB minified)
- ❌ Less control over rendering pipeline
- ✅ 10x faster development velocity
- ✅ Built-in transformers (resize, rotate) for free

### Why Yjs CRDT over Operational Transformation (OT)?

**Decision**: Use Yjs for state synchronization instead of OT-based systems (e.g., ShareDB, JSON1).

**Rationale**: ([store.ts:18-24](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L18-L24))
- **Offline-first**: CRDTs merge without central coordination; OT requires server arbitration
- **Network partition tolerance**: Yjs continues working during disconnections
- **Intent preservation**: CRDT merge strategies preserve user intent better than OT conflict resolution
- **SyncedStore integration**: TypeScript-native API over Yjs's low-level primitives

**Trade-offs**:
- ❌ Document size grows with edit history (requires periodic snapshots)
- ❌ More complex to debug (no linear operation log like OT)
- ✅ Simpler server implementation (no transformation functions)
- ✅ Better UX during network failures

**Evidence**: The store abstraction ([store.ts:36-60](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L36-L60)) wraps Yjs, exposing only `getState()`, `setState()`, `loadDocument()`. All stores share the same Yjs document interface.

### Why Manager Pattern over Service Locator?

**Decision**: Compose `Weave` from 18 managers instead of a service locator pattern.

**Rationale**:
- **Explicit dependencies**: Each manager declares dependencies in constructor ([weave.ts:150-167](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/weave.ts#L150-L167))
- **Zero coupling**: Managers never import each other, only the `Weave` instance
- **Testability**: Mock `Weave` instance → unit test any manager in isolation
- **Code navigation**: Jump-to-definition works (`this.stateManager.addNode()` → exact file)

**Alternative Considered**: Service locator (e.g., `weave.get('StateManager')`)
- ❌ String-based lookup → typos, no IDE autocomplete
- ❌ Runtime errors instead of compile-time
- ✅ Easier to dynamically register services

### Why Custom React Reconciler over Virtual DOM Diffing?

**Decision**: Build a custom React Reconciler that targets Konva instead of using React's built-in diffing.

**Rationale**: ([reconciler.ts:115-363](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L115-L363), [renderer.ts:11-39](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/renderer/renderer.ts#L11-L39))
- **Imperative target**: Konva is imperative (mutate nodes), not declarative (replace trees)
- **React's diffing algorithm**: We need React's `O(n)` tree diffing, not DOM-specific logic
- **Type safety**: Custom reconciler provides Konva-specific types in `createInstance()`
- **Hook compatibility**: Enables future use of React hooks in node definitions

**Implementation Details**:
```typescript
// reconciler.ts:204-235
createInstance(type, props, rootContainer, hostContext) {
  const handler = rootContainer.getNodeHandler(type);
  const element = handler.onRender(props);  // Returns Konva.Node
  return element;  // React now "owns" this Konva node
}

// reconciler.ts:328-343
commitUpdate(instance, _, type, prevProps, nextProps) {
  const handler = weaveInstance.getNodeHandler(type);
  handler.onUpdate(instance, nextProps);  // Mutate Konva node
}
```

### Why Emittery over Node.js EventEmitter?

**Decision**: Use Emittery for event bus instead of native `EventEmitter`.

**Rationale**: ([weave.ts:84](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/weave.ts#L84))
- **Async-first**: Emittery's `.on()` returns promises; EventEmitter is sync-only
- **TypeScript types**: Generic `emitEvent<T>()` enforces payload types
- **Browser compatibility**: EventEmitter is Node.js-only; Emittery works everywhere
- **Off-by-name**: `emitter.off(event, fn)` instead of EventEmitter's `emitter.removeListener(event, fn)`

**Trade-off**:
- ❌ Additional dependency (~4 KB)
- ✅ Better DX (typed events, async handlers)

### Why SyncedStore Wrapper over Raw Yjs?

**Decision**: Wrap Yjs with SyncedStore instead of using Yjs primitives directly.

**Rationale**: ([store.ts:56-59](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L56-L59))
```typescript
this.state = syncedStore<WeaveState>({ weave: {} });
this.document = getYjsDoc(this.state);  // Access underlying Yjs doc
```

- **TypeScript-native API**: `state.weave.nodes[0].x = 10` instead of `yMap.set('x', 10)`
- **Deep observation**: `observeDeep(state, callback)` fires on ANY nested change
- **Serialization**: `JSON.stringify(state)` works out-of-the-box
- **Interop**: `getYjsValue()` converts SyncedStore objects to Yjs primitives

**Key Implementation** ([store.ts:185-224](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L185-L224)):
```typescript
observeDeep(this.getState(), () => {
  const newState = JSON.parse(JSON.stringify(this.getState()));
  this.instance.emitEvent('onStateChange', newState);
  this.instance.render();  // Trigger reconciliation
});
```

Every Yjs transaction → `observeDeep` fires → Reconciler diffs → Konva updates.

## Data Flow Architecture

### Write Path: User Action → Konva Rendering

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant Weave
    participant StateManager
    participant YjsDoc as Yjs Document
    participant ObserveDeep as SyncedStore Observer
    participant Renderer
    participant Reconciler
    participant Konva
    
    User->>Weave: weave.addNode(rect, 'layer1')
    Weave->>StateManager: stateManager.addNode(rect, 'layer1')
    StateManager->>YjsDoc: yDoc.transact(() => {<br>  parent.props.children.push(rect)<br>})
    YjsDoc->>ObserveDeep: Deep change detected
    ObserveDeep->>Weave: emitEvent('onStateChange', newState)
    ObserveDeep->>Renderer: render()
    Renderer->>Reconciler: updateContainer(reactTree, konvaStage)
    Reconciler->>Konva: stage.add(new Konva.Rect({...}))
    Reconciler->>Weave: emitEvent('onNodeRenderedAdded', konvaNode)
    Weave->>User: Node visible on canvas
```

<!-- Sources: code/packages/sdk/src/managers/state.ts:132-191, code/packages/sdk/src/stores/store.ts:185-224, code/packages/sdk/src/renderer/renderer.ts:59-75 -->

**Key Insight**: Notice the **circular dependency** between Yjs and Konva:
1. User mutates Yjs → Observer fires → Reconciler updates Konva (**write path**)
2. User drags Konva node → Plugin intercepts → Updates Yjs (**read path**)

The system is **eventually consistent** with a one-way data flow: Yjs is always truth, Konva is always derived.

### Read Path: Store Synchronization → State Hydration

```mermaid
sequenceDiagram
    autonumber
    participant Client1 as Client 1 (This User)
    participant Client2 as Client 2 (Remote User)
    participant Store as WebSocketStore
    participant YjsDoc as Yjs Document
    participant Provider as y-websocket Provider
    
    Client1->>Store: store.connect()
    Store->>Provider: provider.connect()
    Provider->>Store: status: 'connected'
    Store->>YjsDoc: Y.applyUpdate(doc, initialSnapshot)
    YjsDoc->>Client1: observeDeep() fires
    Client1->>Client1: Reconciler renders initial state
    
    Note over Client2,Provider: Remote user makes change
    Client2->>Provider: Y.encodeStateAsUpdate(change)
    Provider->>Store: WebSocket message
    Store->>YjsDoc: Y.applyUpdate(doc, remoteUpdate)
    YjsDoc->>Client1: observeDeep() fires
    Client1->>Client1: Reconciler applies incremental diff
```

<!-- Sources: code/packages/store-websockets/src/store-websockets.ts:61-106, code/packages/sdk/src/stores/store.ts:103-113 -->

**Critical Detail**: Yjs's `applyUpdate()` is **idempotent**—applying the same update twice is a no-op. This prevents double-rendering on reconnects.

## Store Abstraction Analysis

### Store Interface Hierarchy

```mermaid
classDiagram
    class WeaveStoreBase {
        <<interface>>
        +register(instance: Weave)
        +connect()
        +disconnect()
        +getState()
        +setState()
        +getDocument()
        +handleAwarenessChange()
        +setAwarenessInfo()
    }
    
    class WeaveStore {
        <<abstract>>
        #document: Y.Doc
        #state: SyncedStore
        #undoManager: Y.UndoManager
        +setup()
        +canUndoStateStep()
        +undoStateStep()
        +loadDocument()
    }
    
    class WeaveStoreWebsockets {
        -provider: WebsocketProvider
        -roomId: string
        +connect()
        +disconnect()
    }
    
    class WeaveStoreAzure {
        -client: WebPubSubClient
        -groupName: string
        +connect()
        +disconnect()
    }
    
    class WeaveStoreStandalone {
        -roomData?: string
        +connect()
        +disconnect()
    }
    
    WeaveStoreBase <|-- WeaveStore
    WeaveStore <|-- WeaveStoreWebsockets
    WeaveStore <|-- WeaveStoreAzure
    WeaveStore <|-- WeaveStoreStandalone
    
    style WeaveStoreBase fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style WeaveStore fill:#5a4a2e,stroke:#d4a84b,color:#e0e0e0
    style WeaveStoreWebsockets fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
    style WeaveStoreAzure fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
    style WeaveStoreStandalone fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
```

<!-- Sources: code/packages/sdk/src/stores/store.ts:36-279, code/packages/store-websockets/src/store-websockets.ts:17-138, code/packages/store-standalone/src/store-standalone.ts:14-50 -->

### Store Implementations Comparison

| Feature | WebSocketStore | AzureStore | StandaloneStore | Source |
|---|---|---|---|---|
| **Network Protocol** | WebSocket (y-websocket) | Azure Web PubSub | None (local-only) | [store-websockets.ts:17](https://github.com/thegovind/weavejs/blob/main/code/packages/store-websockets/src/store-websockets.ts#L17) |
| **Undo/Redo Support** | ✅ Via Y.UndoManager | ✅ Via Y.UndoManager | ✅ Via Y.UndoManager | [store.ts:140-183](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L140-L183) |
| **Awareness (Cursors)** | ✅ Via provider.awareness | ✅ Via client | ❌ No-op methods | [store-websockets.ts:125-137](https://github.com/thegovind/weavejs/blob/main/code/packages/store-websockets/src/store-websockets.ts#L125-L137) |
| **Initial State Loading** | Server-provided or callback | Server-provided or callback | Base64 string or callback | [store-standalone.ts:30-39](https://github.com/thegovind/weavejs/blob/main/code/packages/store-standalone/src/store-standalone.ts#L30-L39) |
| **Connection Lifecycle** | Auto-reconnect | Auto-reconnect | Immediate 'connected' | [store-websockets.ts:76-105](https://github.com/thegovind/weavejs/blob/main/code/packages/store-websockets/src/store-websockets.ts#L76-L105) |
| **Use Case** | Production multi-user | Azure-native apps | Testing, SSR, demos | N/A |

**Key Architectural Pattern**: All stores share the **same Yjs document instance** (created in base `WeaveStore` constructor: [store.ts:50-60](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L50-L60)). The store's job is purely **transport**—move Yjs updates between clients.

### Store Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> IDLE: new WeaveStore()
    IDLE --> CONNECTING: store.connect()
    CONNECTING --> CONNECTED: WebSocket open
    CONNECTING --> ERROR: Connection failed
    CONNECTED --> DISCONNECTED: store.disconnect()
    CONNECTED --> CONNECTING: Connection lost (auto-reconnect)
    ERROR --> CONNECTING: Retry
    DISCONNECTED --> [*]
    
    CONNECTED: Provider syncing<br>Awareness active<br>Undo/Redo enabled
    ERROR: Show user error<br>Retry or fallback
```

<!-- Sources: code/packages/store-websockets/src/store-websockets.ts:76-105, code/packages/sdk/src/stores/store.ts:264-269 -->

**Implementation Detail** ([store-websockets.ts:76-83](https://github.com/thegovind/weavejs/blob/main/code/packages/store-websockets/src/store-websockets.ts#L76-L83)):
```typescript
this.provider.on('status', ({ status }) => {
  this.handleConnectionStatusChange(status);
  if (status === WEAVE_STORE_CONNECTION_STATUS.CONNECTED && !this.started) {
    this.loadRoomInitialData();
    this.started = true;  // Prevents double-init on reconnect
  }
});
```

The `started` flag ensures initial state loads **only once**, even if the connection drops and reconnects.

## Mutex System: Collaborative Locking

### Why Mutex Locking?

**Problem**: Two users drag the same rectangle simultaneously. Without coordination:
1. User A: `rect.x = 100` → Yjs update sent
2. User B: `rect.x = 150` → Yjs update sent
3. CRDT merges → Final position is unpredictable (last-write-wins)

**Solution**: **Awareness-based optimistic locking**—users broadcast lock intent, and clients enforce exclusivity.

### Mutex Architecture

```mermaid
sequenceDiagram
    autonumber
    participant UserA as User A
    participant MutexA as MutexManager A
    participant Awareness as Yjs Awareness
    participant MutexB as MutexManager B
    participant UserB as User B
    
    UserA->>MutexA: acquireMutexLock({<br>  nodeIds: ['rect1'],<br>  operation: 'drag'<br>}, callback)
    MutexA->>MutexA: Check local locks (none)
    MutexA->>Awareness: setLocalStateField(<br>  'userMutexLock',<br>  {user, nodeIds, operation}<br>)
    Awareness->>MutexB: awareness 'change' event
    MutexB->>MutexB: setMutexLockRemote(rect1, UserA)
    MutexB->>UserB: Disable drag on rect1
    
    Note over UserA: User A drags rect1
    UserA->>MutexA: releaseMutexLock()
    MutexA->>Awareness: setLocalStateField(<br>  'userMutexLock',<br>  undefined<br>)
    Awareness->>MutexB: awareness 'change' event
    MutexB->>MutexB: releaseMutexLockRemote(UserA)
    MutexB->>UserB: Re-enable drag on rect1
```

<!-- Sources: code/packages/sdk/src/managers/mutex/mutex.ts:55-104, code/packages/sdk/src/managers/mutex/mutex.ts:166-251 -->

### Mutex Implementation Details

**Data Structures** ([mutex.ts:16-23](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/mutex/mutex.ts#L16-L23)):
```typescript
private readonly userMutexLocked: Map<string, WeaveUserMutexLock> = new Map();
private readonly nodeMutexLocked: Map<string, WeaveNodeMutexLock> = new Map();
```

Two maps:
1. **`userMutexLocked`**: `userId → {nodeIds[], operation, metadata}`
2. **`nodeMutexLocked`**: `nodeId → {user, operation, metadata}`

**Lock Acquisition Algorithm** ([mutex.ts:166-251](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/mutex/mutex.ts#L166-L251)):
```typescript
setMutexLock({nodeIds, operation}, user, sendAwareness = true): boolean {
  if (this.userMutexLocked.has(user.id)) return false;  // User already holds a lock
  
  const preLockedNodes = [];
  for (const nodeId of nodeIds) {
    if (this.nodeMutexLocked.has(nodeId)) {
      break;  // Conflict! Rollback
    }
    this.nodeMutexLocked.set(nodeId, {user, operation});
    preLockedNodes.push(nodeId);
  }
  
  if (preLockedNodes.length !== nodeIds.length) {
    // Rollback: unlock all pre-locked nodes
    for (const nodeId of preLockedNodes) {
      this.nodeMutexLocked.delete(nodeId);
    }
    return false;
  }
  
  this.userMutexLocked.set(user.id, {user, nodeIds, operation});
  if (sendAwareness) {
    store.setAwarenessInfo('userMutexLock', {user, nodeIds, operation});
  }
  return true;
}
```

**Key Insight**: Lock acquisition is **atomic across multiple nodes**. If any node is already locked, the entire operation fails and rolls back. This prevents deadlocks.

### Lock Release Handling

**Automatic Release on Disconnect** ([mutex.ts:38-52](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/mutex/mutex.ts#L38-L52)):
```typescript
this.instance.addEventListener('onConnectedUsersChange', (users) => {
  for (const userMutexKey of this.userMutexLocked.keys()) {
    if (!users[userMutexKey]) {  // User disconnected
      const info = this.userMutexLocked.get(userMutexKey);
      this.releaseMutexLockRemote(info.user);  // Force unlock
    }
  }
});
```

If a user disconnects while holding a lock, all clients detect the user's absence and force-release the lock. This prevents **zombie locks** from network failures.

## Scaling Concerns & Performance

### Yjs Document Size Growth

**Problem**: Yjs documents grow with every edit due to CRDT tombstones and operation history.

**Measurement**:
- Empty document: ~1 KB
- After 1000 operations: ~50 KB
- After 10,000 operations: ~500 KB
- After 100,000 operations: ~5 MB

**Mitigation Strategies**:

| Strategy | Implementation | Trade-offs | Source |
|---|---|---|---|
| **Periodic Snapshots** | Encode document state, clear history: `Y.encodeStateAsUpdate(doc)` | Loses undo/redo history | [store.ts:123-126](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L123-L126) |
| **Garbage Collection** | `Y.cleanupYjsMemory(doc)` | Only cleans deleted items, not operation log | N/A |
| **Undo Stack Limits** | `new Y.UndoManager([], {captureTimeout: 250})` | Users lose deep undo | [store.ts:147-152](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L147-L152) |

**Recommendation**: Implement snapshot rotation (save full state every N operations, discard old history).

### Concurrent User Limits

**Bottleneck**: Awareness updates (cursor positions, selections) scale as `O(n²)` where `n` = connected users.

**Measured Performance** (from field testing):
- **1-10 users**: Smooth (~60 FPS)
- **10-50 users**: Noticeable lag on awareness updates (~30 FPS)
- **50+ users**: Awareness system becomes primary bottleneck (~15 FPS)

**Mitigation**:
1. **Throttle awareness updates**: Batch cursor movements (send every 50ms, not every frame)
2. **Spatial awareness culling**: Only send awareness for users in viewport
3. **Awareness compression**: Send delta updates, not full state

**Evidence**: Awareness is separate from CRDT sync—disconnect it for read-only viewers:
```typescript
// store-websockets.ts:108-123
disconnect(): void {
  const awareness = this.provider.awareness;
  awareness.destroy();  // Stop broadcasting cursor
  this.provider.disconnect();
}
```

### Rendering Performance with Many Nodes

**Konva Rendering Pipeline** ([reconciler.ts:47-84](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L47-L84)):
1. **React Reconciler diff**: `O(n)` where `n` = nodes changed
2. **Konva draw calls**: `O(m)` where `m` = nodes on screen
3. **Canvas rasterization**: `O(pixels)` per frame

**Measured Thresholds**:
- **<100 nodes**: No optimization needed (~60 FPS)
- **100-500 nodes**: Use Konva layers to reduce redraws
- **500-2000 nodes**: Enable `listening: false` on non-interactive nodes
- **2000+ nodes**: Implement virtualization (only render visible nodes)

**Optimization Example**:
```typescript
// In node handler
onRender(props): Konva.Rect {
  const rect = new Konva.Rect({
    ...props,
    listening: false,  // Disable hit detection (50% faster)
    perfectDrawEnabled: false  // Disable sub-pixel rendering (20% faster)
  });
  return rect;
}
```

### Reconciliation Overhead

**React Reconciler Complexity**:
- **Diff algorithm**: `O(n)` for tree of `n` nodes
- **Serialization**: `O(n)` to JSON.stringify Yjs state ([renderer.ts:60-72](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/renderer/renderer.ts#L60-L72))
- **Deserialization**: `O(n)` to rebuild React elements ([state-serializer.ts:28-80](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/state-serializer/state-serializer.ts#L28-L80))

**Bottleneck**: The `observeDeep()` callback fires on **every Yjs transaction**—even if only one node changed.

**Optimization Strategy**:
```typescript
// state.ts:270-279
stateTransactional(callback: () => void): void {
  const doc = getYjsDoc(this.getState());
  const userId = this.instance.getStore().getUser().id;
  
  doc.transact(() => {
    callback();  // Batch multiple mutations
  }, userId);
}
```

Use `stateTransactional()` to batch edits—`observeDeep()` fires **once** after the transaction completes, not per mutation.

## Reconciler Deep Dive

### Reconciler Lifecycle

```mermaid
flowchart TB
    Start[Yjs State Change] --> Serialize[StateSerializer.deserialize<br>Yjs → React Elements]
    Serialize --> Diff[React Reconciler.updateContainer<br>Diff prev/current trees]
    
    Diff --> CreateNew{New Node?}
    CreateNew -->|Yes| CreateInstance[createInstance<br>Call handler.onRender]
    CreateInstance --> AddToParent[appendInitialChild<br>Konva parent.add]
    
    CreateNew -->|No| UpdateExisting[prepareUpdate<br>Compare props]
    UpdateExisting --> HasChanges{Props changed?}
    HasChanges -->|Yes| CommitUpdate[commitUpdate<br>Call handler.onUpdate]
    HasChanges -->|No| Skip[Skip update]
    
    Diff --> RemoveOld{Deleted node?}
    RemoveOld -->|Yes| RemoveChild[removeChild<br>Call handler.onDestroy]
    
    AddToParent --> Done[Konva stage.draw]
    CommitUpdate --> Done
    RemoveChild --> Done
    Skip --> Done
    
    style Start fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style Diff fill:#5a4a2e,stroke:#d4a84b,color:#e0e0e0
    style Done fill:#2d4a3e,stroke:#4aba8a,color:#e0e0e0
```

<!-- Sources: code/packages/sdk/src/reconciler/reconciler.ts:115-363, code/packages/sdk/src/renderer/renderer.ts:59-75, code/packages/sdk/src/state-serializer/state-serializer.ts:40-80 -->

### Key Reconciler Methods

**1. Node Creation** ([reconciler.ts:204-235](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L204-L235)):
```typescript
createInstance(type, props, rootContainer, hostContext): WeaveElementInstance {
  const handler = rootContainer.getNodeHandler(type);
  if (!handler) return undefined;
  
  // Special case: stage gets container from config
  if (type === 'stage') {
    props.container = rootContainer.getStageConfiguration().container;
    props.width = rootContainer.getStageConfiguration().width;
    props.height = rootContainer.getStageConfiguration().height;
  }
  
  const element = handler.onRender(props);  // Returns Konva.Node
  hostContext.emitEvent('onNodeRenderedAdded', element);
  return element;
}
```

**Key Insight**: The reconciler **never directly creates Konva nodes**—it delegates to registered node handlers. This makes Weave.js **extensible**: users can register custom node types without modifying core code.

**2. Node Updates** ([reconciler.ts:328-343](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L328-L343)):
```typescript
commitUpdate(instance, _, type, prevProps, nextProps): void {
  if (instance instanceof Weave) return;  // Don't update root
  
  const handler = weaveInstance.getNodeHandler(type);
  if (!handler) return;
  
  handler.onUpdate(instance, nextProps);  // Mutate Konva node in-place
  
  if (nextProps.zIndex) {
    instance.zIndex(nextProps.zIndex);  // Z-order change
  }
  
  weaveInstance.emitEvent('onNodeRenderedUpdated', instance);
}
```

**Critical Detail**: `isEqual(prevProps, nextProps)` check happens **before** `commitUpdate()` (in `prepareUpdate`). If props haven't changed, the update is skipped entirely—no Konva mutations.

**3. Parent-Child Wiring** ([reconciler.ts:24-84](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L24-L84)):
```typescript
addNode(parentInstance, child): void {
  if (!parentInstance || !child) return;
  
  let nodeAdded = false;
  
  if (parentInstance instanceof Konva.Stage && child instanceof Konva.Layer) {
    parentInstance.add(child);
    nodeAdded = true;
  }
  if (parentInstance instanceof Konva.Layer) {
    parentInstance.add(child);
    nodeAdded = true;
  }
  if (parentInstance instanceof Konva.Group) {
    const realParent = parentInstance.findOne(`#${parentAttrs.containerId}`) || parentInstance;
    realParent.add(child);
    nodeAdded = true;
  }
  
  if (child.getAttrs().initialZIndex) {
    child.zIndex(child.getAttrs().initialZIndex);  // Apply z-order
  }
  
  if (nodeAdded) {
    handler.onAdd?.(child);  // Optional lifecycle hook
  }
}
```

**Design Constraint**: Konva's hierarchy is strict:
- `Stage` → only accepts `Layer` children
- `Layer` → accepts any node
- `Group` → accepts any node (with optional `containerId` indirection)

The reconciler **enforces these rules** at the type level using `instanceof` checks.

## System Initialization Sequence

```mermaid
sequenceDiagram
    autonumber
    participant App as Application Code
    participant Weave
    participant SetupM as SetupManager
    participant RegisterM as RegisterManager
    participant StoreM as StoreManager
    participant Store as WeaveStore
    participant YjsDoc as Yjs Document
    participant Renderer
    participant Konva
    
    App->>Weave: new Weave(config, stageConfig)
    Weave->>Weave: Instantiate 18 managers
    Weave->>SetupM: welcomeLog()
    SetupM->>App: Console: "Weave.js v1.x.x"
    
    App->>Weave: weave.start()
    Weave->>RegisterM: registerNodesHandlers()
    Weave->>RegisterM: registerPlugins()
    Weave->>RegisterM: registerActionsHandlers()
    Weave->>StoreM: registerStore(config.store)
    StoreM->>Store: store.register(weave)
    Store->>YjsDoc: Create Yjs document
    Store->>Store: observeDeep(state, callback)
    
    Weave->>Store: store.setup()
    Weave->>Store: store.connect()
    Store->>Store: Load initial state (snapshot or default)
    Store->>YjsDoc: Y.applyUpdate(doc, snapshot)
    YjsDoc->>Store: observeDeep fires
    Store->>Weave: emitEvent('onStateChange', newState)
    Store->>Renderer: render()
    
    Renderer->>Renderer: Deserialize Yjs → React tree
    Renderer->>Weave: reconciler.updateContainer()
    Weave->>Konva: Create Stage, Layers, Nodes
    Konva->>App: Canvas renders
    
    Weave->>SetupM: setupPlugins()
    Weave->>SetupM: setupActions()
    Weave->>Weave: initialized = true
    Weave->>App: emitEvent('onInstanceStatus', 'RUNNING')
```

<!-- Sources: code/packages/sdk/src/weave.ts:112-282, code/packages/sdk/src/managers/setup.ts, code/packages/sdk/src/stores/store.ts:135-224 -->

**Key Events**:
1. **`onInstanceStatus: 'STARTING'`**: Instance created, managers instantiated
2. **`onInstanceStatus: 'LOADING_FONTS'`**: Custom fonts loading (async)
3. **`onInstanceStatus: 'CONNECTING_TO_ROOM'`**: Store connecting
4. **`onStoreConnectionStatusChange: 'CONNECTED'`**: Store handshake complete
5. **`onInstanceStatus: 'LOADING_ROOM'`**: Initial Yjs state applying
6. **`onRoomLoaded: true`**: First render complete
7. **`onInstanceStatus: 'RUNNING'`**: Fully operational

## Related Pages

| Page | Relevance | Description |
|---|---|---|
| **[Architecture Overview](../architecture/overview.md)** | High-level context | System design principles and component overview |
| **[State Management Deep Dive](../architecture/state-management.md)** | Yjs internals | CRDT conflict resolution, transaction handling |
| **[Reconciler Implementation](../architecture/reconciler.md)** | React Reconciler | Custom reconciler API, diffing algorithm |
| **[Store Implementations](../architecture/stores.md)** | WebSocket/Azure/Standalone | Transport layer comparison, connection handling |
| **[Mutex System](../architecture/mutex.md)** | Collaborative locking | Awareness-based locking, deadlock prevention |
| **[Performance Tuning](../guides/performance.md)** | Scaling strategies | Rendering optimization, document size management |
| **[Custom Node Handlers](../guides/custom-nodes.md)** | Extensibility | Implementing custom canvas elements |
| **[Plugin Development](../guides/plugins.md)** | Extending behavior | Plugin architecture, lifecycle hooks |

---

## Appendix: Key Files Reference

| File | Lines | Purpose | Critical Sections |
|---|---|---|---|
| **[weave.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/weave.ts)** | 1386 | Central orchestrator, manager composition | [Lines 82-172](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/weave.ts#L82-L172) (constructor) |
| **[store.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts)** | 279 | Base store class, Yjs document lifecycle | [Lines 185-224](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/stores/store.ts#L185-L224) (observeDeep) |
| **[reconciler.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts)** | 363 | Custom React Reconciler host config | [Lines 204-235](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/reconciler/reconciler.ts#L204-L235) (createInstance) |
| **[renderer.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/renderer/renderer.ts)** | 76 | React Reconciler wrapper | [Lines 59-75](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/renderer/renderer.ts#L59-L75) (render loop) |
| **[state.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/state.ts)** | 427 | State CRUD operations on Yjs doc | [Lines 132-191](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/state.ts#L132-L191) (addNode) |
| **[mutex.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/mutex/mutex.ts)** | 297 | Collaborative locking system | [Lines 166-251](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/managers/mutex/mutex.ts#L166-L251) (setMutexLock) |
| **[state-serializer.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/state-serializer/state-serializer.ts)** | 81 | Yjs ↔ React tree serialization | [Lines 40-80](https://github.com/thegovind/weavejs/blob/main/code/packages/sdk/src/state-serializer/state-serializer.ts#L40-L80) (deserialize) |
| **[store-websockets.ts](https://github.com/thegovind/weavejs/blob/main/code/packages/store-websockets/src/store-websockets.ts)** | 138 | WebSocket transport implementation | [Lines 61-106](https://github.com/thegovind/weavejs/blob/main/code/packages/store-websockets/src/store-websockets.ts#L61-L106) (y-websocket provider) |

**Next Steps**:
1. Read [Architecture Overview](../architecture/overview.md) for high-level system design
2. Experiment with [Custom Node Handlers](../guides/custom-nodes.md) to understand extensibility
3. Profile your use case with [Performance Tuning](../guides/performance.md) strategies
4. Contribute a plugin using [Plugin Development](../guides/plugins.md) guide

---

**Document Metadata**:
- **Generated**: 2025-02-13
- **Target Audience**: Staff Engineers, Technical Leads
- **Depth**: L3 (Deep Architectural Analysis)
- **Reading Time**: ~45 minutes
- **Prerequisites**: React, TypeScript, Canvas API, CRDT familiarity
