/**
 * Chrome DevTools Protocol - Debugger Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Debugger/
 */

import type { Runtime } from './runtime.js'

export namespace Debugger {
  // Basic types
  export type BreakpointId = string
  export type CallFrameId = string
  export type ScriptId = string

  export interface Location {
    scriptId: ScriptId
    lineNumber: number
    columnNumber?: number
  }

  export interface ScriptPosition {
    lineNumber: number
    columnNumber: number
  }

  export interface LocationRange {
    scriptId: ScriptId
    start: ScriptPosition
    end: ScriptPosition
  }

  export interface CallFrame {
    callFrameId: CallFrameId
    functionName: string
    functionLocation?: Location
    location: Location
    url: string
    scopeChain: Scope[]
    this: Runtime.RemoteObject
    returnValue?: Runtime.RemoteObject
    canBeRestarted?: boolean
  }

  export interface Scope {
    type: 'global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module' | 'wasm-expression-stack'
    object: Runtime.RemoteObject
    name?: string
    startLocation?: Location
    endLocation?: Location
  }

  export interface SearchMatch {
    lineNumber: number
    lineContent: string
  }

  export interface BreakLocation {
    scriptId: ScriptId
    lineNumber: number
    columnNumber?: number
    type?: 'debuggerStatement' | 'call' | 'return'
  }

  export interface DebugSymbols {
    type: 'None' | 'SourceMap' | 'EmbeddedDWARF' | 'ExternalDWARF'
    externalURL?: string
  }

  // Command parameters
  export interface EnableParams {
    maxScriptsCacheSize?: number
  }

  export interface EnableResult {
    debuggerId: string
  }

  export interface DisableParams {
    // No parameters
  }

  export interface SetBreakpointsActiveParams {
    active: boolean
  }

  export interface SetSkipAllPausesParams {
    skip: boolean
  }

  export interface SetBreakpointByUrlParams {
    lineNumber: number
    url?: string
    urlRegex?: string
    scriptHash?: string
    columnNumber?: number
    condition?: string
  }

  export interface SetBreakpointByUrlResult {
    breakpointId: BreakpointId
    locations: Location[]
  }

  export interface SetBreakpointParams {
    location: Location
    condition?: string
  }

  export interface SetBreakpointResult {
    breakpointId: BreakpointId
    actualLocation: Location
  }

  export interface RemoveBreakpointParams {
    breakpointId: BreakpointId
  }

  export interface GetPossibleBreakpointsParams {
    start: Location
    end?: Location
    restrictToFunction?: boolean
  }

  export interface GetPossibleBreakpointsResult {
    locations: BreakLocation[]
  }

  export interface ContinueToLocationParams {
    location: Location
    targetCallFrames?: 'any' | 'current'
  }

  export interface PauseOnAsyncCallParams {
    parentStackTraceId: Runtime.StackTrace
  }

  export interface StepIntoParams {
    breakOnAsyncCall?: boolean
    skipList?: LocationRange[]
  }

  export interface GetStackTraceParams {
    stackTraceId: Runtime.StackTrace
  }

  export interface GetStackTraceResult {
    stackTrace: Runtime.StackTrace
  }

  export interface SearchInContentParams {
    scriptId: ScriptId
    query: string
    caseSensitive?: boolean
    isRegex?: boolean
  }

  export interface SearchInContentResult {
    result: SearchMatch[]
  }

  export interface SetScriptSourceParams {
    scriptId: ScriptId
    scriptSource: string
    dryRun?: boolean
    allowTopFrameEditing?: boolean
  }

  export interface SetScriptSourceResult {
    callFrames?: CallFrame[]
    stackChanged?: boolean
    asyncStackTrace?: Runtime.StackTrace
    asyncStackTraceId?: Runtime.StackTrace
    exceptionDetails?: Runtime.ExceptionDetails
  }

  export interface RestartFrameParams {
    callFrameId: CallFrameId
  }

  export interface RestartFrameResult {
    callFrames: CallFrame[]
    asyncStackTrace?: Runtime.StackTrace
    asyncStackTraceId?: Runtime.StackTrace
  }

  export interface GetScriptSourceParams {
    scriptId: ScriptId
  }

  export interface GetScriptSourceResult {
    scriptSource: string
    bytecode?: string
  }

  export interface SetPauseOnExceptionsParams {
    state: 'none' | 'uncaught' | 'all'
  }

  export interface EvaluateOnCallFrameParams {
    callFrameId: CallFrameId
    expression: string
    objectGroup?: string
    includeCommandLineAPI?: boolean
    silent?: boolean
    returnByValue?: boolean
    generatePreview?: boolean
    throwOnSideEffect?: boolean
    timeout?: number
  }

  export interface EvaluateOnCallFrameResult {
    result: Runtime.RemoteObject
    exceptionDetails?: Runtime.ExceptionDetails
  }

  export interface SetVariableValueParams {
    scopeNumber: number
    variableName: string
    newValue: Runtime.CallArgument
    callFrameId: CallFrameId
  }

  export interface SetReturnValueParams {
    newValue: Runtime.CallArgument
  }

  export interface SetAsyncCallStackDepthParams {
    maxDepth: number
  }

  export interface SetBlackboxPatternsParams {
    patterns: string[]
  }

  export interface SetBlackboxedRangesParams {
    scriptId: ScriptId
    positions: ScriptPosition[]
  }

  // Events
  export interface ScriptParsedEvent {
    scriptId: ScriptId
    url: string
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
    executionContextId: number
    hash: string
    executionContextAuxData?: any
    isLiveEdit?: boolean
    sourceMapURL?: string
    hasSourceURL?: boolean
    isModule?: boolean
    length?: number
    stackTrace?: Runtime.StackTrace
    codeOffset?: number
    scriptLanguage?: 'JavaScript' | 'WebAssembly'
    debugSymbols?: DebugSymbols
    embedderName?: string
  }

  export interface ScriptFailedToParseEvent {
    scriptId: ScriptId
    url: string
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
    executionContextId: number
    hash: string
    executionContextAuxData?: any
    sourceMapURL?: string
    hasSourceURL?: boolean
    isModule?: boolean
    length?: number
    stackTrace?: Runtime.StackTrace
    codeOffset?: number
    scriptLanguage?: 'JavaScript' | 'WebAssembly'
    embedderName?: string
  }

  export interface BreakpointResolvedEvent {
    breakpointId: BreakpointId
    location: Location
  }

  export interface PausedEvent {
    callFrames: CallFrame[]
    reason: 'ambiguous' | 'assert' | 'CSPViolation' | 'debugCommand' | 'DOM' | 'EventListener' | 
            'exception' | 'instrumentation' | 'OOM' | 'other' | 'promiseRejection' | 'XHR'
    data?: any
    hitBreakpoints?: string[]
    asyncStackTrace?: Runtime.StackTrace
    asyncStackTraceId?: Runtime.StackTrace
    asyncCallStackTraceId?: Runtime.StackTrace
  }

  export interface ResumedEvent {
    // No parameters
  }

  // Step commands
  export interface StepOverParams {
    skipList?: LocationRange[]
  }

  export interface StepOutParams {
    // No parameters
  }

  export interface PauseParams {
    // No parameters
  }

  export interface ResumeParams {
    terminateOnResume?: boolean
  }
}