/**
 * Chrome DevTools Protocol - Runtime Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Runtime/
 */

export namespace Runtime {
  // Basic types
  export type ScriptId = string
  export type RemoteObjectId = string
  export type UnserializableValue = string
  
  export type ObjectType = 'object' | 'function' | 'undefined' | 'string' | 'number' | 'boolean' | 'symbol' | 'bigint'
  export type ObjectSubtype = 'array' | 'null' | 'node' | 'regexp' | 'date' | 'map' | 'set' | 'weakmap' | 'weakset' | 
                              'iterator' | 'generator' | 'error' | 'proxy' | 'promise' | 'typedarray' | 'arraybuffer' | 
                              'dataview' | 'webassemblymemory' | 'wasmvalue'

  // Core interfaces
  export interface RemoteObject {
    type: ObjectType
    subtype?: ObjectSubtype
    className?: string
    value?: any
    unserializableValue?: UnserializableValue
    description?: string
    objectId?: RemoteObjectId
    preview?: ObjectPreview
    customPreview?: CustomPreview
  }

  export interface ObjectPreview {
    type: ObjectType
    subtype?: ObjectSubtype
    description?: string
    overflow: boolean
    properties: PropertyPreview[]
    entries?: EntryPreview[]
  }

  export interface PropertyPreview {
    name: string
    type: ObjectType
    value?: string
    valuePreview?: ObjectPreview
    subtype?: ObjectSubtype
  }

  export interface EntryPreview {
    key?: ObjectPreview
    value: ObjectPreview
  }

  export interface CustomPreview {
    header: string
    bodyGetterId?: RemoteObjectId
  }

  export interface CallFrame {
    functionName: string
    scriptId: ScriptId
    url: string
    lineNumber: number
    columnNumber: number
  }

  export interface StackTrace {
    description?: string
    callFrames: CallFrame[]
    parent?: StackTrace
  }

  export interface ExceptionDetails {
    exceptionId: number
    text: string
    lineNumber: number
    columnNumber: number
    scriptId?: ScriptId
    url?: string
    stackTrace?: StackTrace
    exception?: RemoteObject
    executionContextId?: number
  }

  // Command parameters
  export interface EvaluateParams {
    expression: string
    objectGroup?: string
    includeCommandLineAPI?: boolean
    silent?: boolean
    contextId?: number
    returnByValue?: boolean
    generatePreview?: boolean
    userGesture?: boolean
    awaitPromise?: boolean
    throwOnSideEffect?: boolean
    timeout?: number
    disableBreaks?: boolean
    replMode?: boolean
    allowUnsafeEvalBlockedByCSP?: boolean
  }

  export interface EvaluateResult {
    result: RemoteObject
    exceptionDetails?: ExceptionDetails
  }

  export interface CallFunctionOnParams {
    functionDeclaration: string
    objectId?: RemoteObjectId
    arguments?: CallArgument[]
    silent?: boolean
    returnByValue?: boolean
    generatePreview?: boolean
    userGesture?: boolean
    awaitPromise?: boolean
    objectGroup?: string
  }

  export interface CallFunctionOnResult {
    result: RemoteObject
    exceptionDetails?: ExceptionDetails
  }

  export interface CallArgument {
    value?: any
    unserializableValue?: UnserializableValue
    objectId?: RemoteObjectId
  }

  export interface GetPropertiesParams {
    objectId: RemoteObjectId
    ownProperties?: boolean
    accessorPropertiesOnly?: boolean
    generatePreview?: boolean
    nonIndexedPropertiesOnly?: boolean
  }

  export interface GetPropertiesResult {
    result: PropertyDescriptor[]
    internalProperties?: InternalPropertyDescriptor[]
    privateProperties?: PrivatePropertyDescriptor[]
    exceptionDetails?: ExceptionDetails
  }

  export interface PropertyDescriptor {
    name: string
    value?: RemoteObject
    writable?: boolean
    get?: RemoteObject
    set?: RemoteObject
    configurable: boolean
    enumerable: boolean
    wasThrown?: boolean
    isOwn?: boolean
    symbol?: RemoteObject
  }

  export interface InternalPropertyDescriptor {
    name: string
    value?: RemoteObject
  }

  export interface PrivatePropertyDescriptor {
    name: string
    value?: RemoteObject
    get?: RemoteObject
    set?: RemoteObject
  }

  export interface ReleaseObjectParams {
    objectId: RemoteObjectId
  }

  export interface ReleaseObjectGroupParams {
    objectGroup: string
  }

  export interface CompileScriptParams {
    expression: string
    sourceURL: string
    persistScript: boolean
    executionContextId?: number
  }

  export interface CompileScriptResult {
    scriptId?: ScriptId
    exceptionDetails?: ExceptionDetails
  }

  export interface RunScriptParams {
    scriptId: ScriptId
    executionContextId?: number
    objectGroup?: string
    silent?: boolean
    includeCommandLineAPI?: boolean
    returnByValue?: boolean
    generatePreview?: boolean
    awaitPromise?: boolean
  }

  export interface RunScriptResult {
    result: RemoteObject
    exceptionDetails?: ExceptionDetails
  }

  // Events
  export interface ConsoleAPICalledEvent {
    type: 'log' | 'debug' | 'info' | 'error' | 'warning' | 'dir' | 'dirxml' | 'table' | 
          'trace' | 'clear' | 'startGroup' | 'startGroupCollapsed' | 'endGroup' | 
          'assert' | 'profile' | 'profileEnd' | 'count' | 'timeEnd'
    args: RemoteObject[]
    executionContextId: number
    timestamp: number
    stackTrace?: StackTrace
    context?: string
  }

  export interface ExceptionThrownEvent {
    timestamp: number
    exceptionDetails: ExceptionDetails
  }

  export interface ExceptionRevokedEvent {
    reason: string
    exceptionId: number
  }

  export interface ExecutionContextCreatedEvent {
    context: ExecutionContextDescription
  }

  export interface ExecutionContextDestroyedEvent {
    executionContextId: number
  }

  export interface ExecutionContextDescription {
    id: number
    origin: string
    name: string
    auxData?: any
  }
}