/**
 * @fileoverview State management types for Curupira debugging
 * 
 * This file contains types specific to state management libraries
 * and their integration with Curupira's debugging capabilities.
 */

import type {
  ActorId,
  ComponentId,
  StoreId,
  RequestId,
  Timestamp,
  SessionId
} from './branded.js'

/**
 * React state types
 */
export interface ReactFiberNode {
  type: string | Function
  key: string | null
  props: Record<string, unknown>
  state: unknown
  memoizedProps: Record<string, unknown>
  memoizedState: unknown
  child: ReactFiberNode | null
  sibling: ReactFiberNode | null
  parent: ReactFiberNode | null
  elementType: unknown
  stateNode: unknown
}

export interface ReactDevToolsHook {
  onCommitFiberRoot?: (id: number, root: ReactFiberNode) => void
  onCommitFiberUnmount?: (id: number, fiber: ReactFiberNode) => void
  backends: Map<string, ReactDevToolsBackend>
  onScheduleFiberRoot?: (id: number, root: ReactFiberNode, children: unknown) => void
}

export interface ReactDevToolsBackend {
  version: string
}

export interface ReactRenderInfo {
  componentId: ComponentId
  displayName: string
  type: 'function' | 'class' | 'memo' | 'forward_ref'
  actualDuration?: number
  baseDuration?: number
  startTime?: number
  commitTime?: number
  interactions: Set<unknown>
}

/**
 * XState v5 types
 */
export interface XStateActor {
  id: ActorId
  type: string
  machine?: XStateMachine
  sessionId: string
  parent?: XStateActor
  children: Set<XStateActor>
  observers: Set<XStateObserver>
}

export interface XStateMachine {
  id: string
  initial?: string
  states: Record<string, XStateState>
  context?: unknown
  version?: string
}

export interface XStateState {
  key: string
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history'
  on?: Record<string, string | XStateTransition>
  entry?: XStateAction[]
  exit?: XStateAction[]
  invoke?: XStateInvocation[]
  states?: Record<string, XStateState>
}

export interface XStateTransition {
  target?: string
  actions?: XStateAction[]
  guard?: XStateGuard
  internal?: boolean
}

export interface XStateAction {
  type: string
  exec?: Function
}

export interface XStateGuard {
  type: string
  predicate?: Function
}

export interface XStateInvocation {
  id: string
  src: string | Function
  onDone?: XStateTransition
  onError?: XStateTransition
}

export interface XStateObserver {
  next?: (snapshot: XStateSnapshot) => void
  error?: (error: unknown) => void
  complete?: () => void
}

export interface XStateSnapshot {
  value: unknown
  context: unknown
  status: 'active' | 'done' | 'error' | 'stopped'
  output?: unknown
  error?: unknown
  historyValue?: unknown
  children?: Record<string, XStateSnapshot>
}

export interface XStateEvent {
  type: string
  timestamp?: Timestamp
  [key: string]: unknown
}

export interface XStateInspectionEvent {
  type: '@xstate.actor' | '@xstate.snapshot' | '@xstate.event'
  actorRef: XStateActor
  event?: XStateEvent
  snapshot?: XStateSnapshot
  sessionId?: SessionId
}

/**
 * Zustand types
 */
export interface ZustandStore<T = unknown> {
  getState: () => T
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void
  subscribe: (listener: (state: T, prevState: T) => void) => () => void
  destroy: () => void
}

export interface ZustandStoreApi<T = unknown> {
  getState: () => T
  setState: (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void
  subscribe: (listener: (state: T, prevState: T) => void) => () => void
}

export interface ZustandDevtoolsConfig {
  enabled: boolean
  name?: string
  anonymousActionType?: string
  store?: string
}

export interface ZustandPersistConfig<T> {
  name: string
  storage?: ZustandStorage<T>
  partialize?: (state: T) => Partial<T>
  merge?: (persistedState: unknown, currentState: T) => T
  skipHydration?: boolean
  version?: number
  migrate?: (persistedState: unknown, version: number) => T
}

export interface ZustandStorage<T> {
  getItem: (name: string) => T | Promise<T | null> | null
  setItem: (name: string, value: T) => void | Promise<void>
  removeItem: (name: string) => void | Promise<void>
}

export interface ZustandImmerConfig<T> {
  enabledAutoFreeze?: boolean
  enabledPatches?: boolean
}

export interface ZustandStoreInfo<T = unknown> {
  id: StoreId
  name: string
  store: ZustandStoreApi<T>
  config: {
    devtools?: ZustandDevtoolsConfig
    persist?: ZustandPersistConfig<T>
    immer?: ZustandImmerConfig<T>
  }
  subscribers: Set<Function>
  history: ZustandStateChange<T>[]
}

export interface ZustandStateChange<T = unknown> {
  id: RequestId
  timestamp: Timestamp
  prevState: T
  nextState: T
  action?: string
  patches?: unknown[]
}

/**
 * Apollo Client types
 */
export interface ApolloClient {
  cache: ApolloCache
  link: ApolloLink
  queryManager: ApolloQueryManager
  version: string
}

export interface ApolloCache {
  data: Record<string, unknown>
  optimisticData: Record<string, unknown>
  watches: Set<unknown>
  typenameDocumentCache: Map<string, unknown>
  documentTransform: unknown
}

export interface ApolloLink {
  request: (operation: ApolloOperation, forward: Function) => unknown
}

export interface ApolloQueryManager {
  cache: ApolloCache
  link: ApolloLink
  queries: Map<string, ApolloQueryInfo>
  mutationStore: ApolloCacheStore
}

export interface ApolloOperation {
  query: unknown
  variables?: Record<string, unknown>
  operationName?: string
  context?: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface ApolloQueryInfo {
  queryId: string
  document: unknown
  variables?: Record<string, unknown>
  networkStatus: number
  loading: boolean
  stopped: boolean
}

export interface ApolloCacheStore {
  [key: string]: unknown
}

export interface ApolloNetworkStatus {
  loading: 1
  setVariables: 2
  fetchMore: 3
  refetch: 4
  poll: 6
  ready: 7
  error: 8
}

/**
 * Combined state inspection types
 */
export interface StateInspectionContext {
  react?: {
    devtools?: ReactDevToolsHook
    fiber?: ReactFiberNode
    components: Map<ComponentId, ReactRenderInfo>
  }
  xstate?: {
    actors: Map<ActorId, XStateActor>
    machines: Map<string, XStateMachine>
    events: XStateInspectionEvent[]
  }
  zustand?: {
    stores: Map<StoreId, ZustandStoreInfo>
    devtools?: Window['__REDUX_DEVTOOLS_EXTENSION__']
  }
  apollo?: {
    client?: ApolloClient
    queries: Map<string, ApolloQueryInfo>
    cache: Record<string, unknown>
  }
}

export interface StateInspector {
  context: StateInspectionContext
  install(): void
  uninstall(): void
  getReactComponents(): ReactRenderInfo[]
  getXStateActors(): XStateActor[]
  getZustandStores(): ZustandStoreInfo[]
  getApolloQueries(): ApolloQueryInfo[]
  captureSnapshot(): StateSnapshot
}

export interface StateSnapshot {
  id: RequestId
  timestamp: Timestamp
  react: {
    components: ReactRenderInfo[]
    renderCount: number
  }
  xstate: {
    actors: Omit<XStateActor, 'observers' | 'children'>[]
    eventCount: number
  }
  zustand: {
    stores: Array<{
      id: StoreId
      name: string
      state: unknown
    }>
    changeCount: number
  }
  apollo: {
    queries: ApolloQueryInfo[]
    cacheSize: number
    networkRequests: number
  }
}

/**
 * Global window extensions for state management
 */
export {}  // Make this a module

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook
    __REDUX_DEVTOOLS_EXTENSION__?: {
      connect: (options: { name: string }) => {
        send: (action: { type: string; state?: unknown }, state: unknown) => void
        init: (state: unknown) => void
        error: (message: string) => void
      }
    }
    __APOLLO_CLIENT__?: ApolloClient
    __ZUSTAND_STORES__?: Map<StoreId, ZustandStoreInfo>
    __XSTATE_INSPECT__?: (event: XStateInspectionEvent) => void
    __CURUPIRA_BRIDGE__?: {
      registerReactDevtools: (hook: ReactDevToolsHook) => void
      registerXStateInspection: (inspect: typeof window.__XSTATE_INSPECT__) => void
      registerZustandStore: (id: StoreId, info: ZustandStoreInfo) => void
      registerApolloClient: (client: ApolloClient) => void
    }
  }
}