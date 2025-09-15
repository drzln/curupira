/**
 * @fileoverview Chrome DevTools Protocol (CDP) type definitions
 * 
 * This file contains type definitions for the Chrome DevTools Protocol
 * integration in Curupira. These types define the structure of CDP
 * domains, methods, parameters, and events.
 */

import type { TabId, RequestId, Timestamp } from './branded.js'

/**
 * CDP connection states
 */
export type CDPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * CDP session information
 */
export interface CDPSession {
  sessionId: string
  targetId: string
  targetType: 'page' | 'iframe' | 'worker' | 'service_worker' | 'other'
  url: string
  title: string
  attached: boolean
}

/**
 * CDP target information
 */
export interface CDPTarget {
  targetId: string
  type: string
  title: string
  url: string
  attached: boolean
  canAccessOpener: boolean
  browserContextId?: string
}

/**
 * CDP connection options
 */
export interface CDPConnectionOptions {
  host: string
  port: number
  secure?: boolean
  timeout?: number
  retryInterval?: number
  maxRetries?: number
}

/**
 * CDP event listener
 */
export interface CDPEventListener<T = unknown> {
  method: string
  handler: (params: T) => void | Promise<void>
}

/**
 * CDP command result
 */
export interface CDPCommandResult<T = unknown> {
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Runtime domain types
 */
export namespace Runtime {
  export interface RemoteObject {
    type: 'object' | 'function' | 'undefined' | 'string' | 'number' | 'boolean' | 'symbol' | 'bigint'
    subtype?: 'array' | 'null' | 'node' | 'regexp' | 'date' | 'map' | 'set' | 'weakmap' | 'weakset' | 'iterator' | 'generator' | 'error' | 'proxy' | 'promise' | 'typedarray' | 'arraybuffer' | 'dataview' | 'webassemblymemory' | 'wasmvalue'
    className?: string
    value?: unknown
    unserializableValue?: string
    description?: string
    objectId?: string
    preview?: ObjectPreview
  }

  export interface ObjectPreview {
    type: 'object' | 'function' | 'undefined' | 'string' | 'number' | 'boolean' | 'symbol' | 'bigint'
    subtype?: string
    description?: string
    overflow: boolean
    properties: PropertyPreview[]
    entries?: EntryPreview[]
  }

  export interface PropertyPreview {
    name: string
    type: string
    value?: string
    valuePreview?: ObjectPreview
    subtype?: string
  }

  export interface EntryPreview {
    key?: ObjectPreview
    value: ObjectPreview
  }

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
    uniqueContextId?: string
  }

  export interface EvaluateResult {
    result: RemoteObject
    exceptionDetails?: ExceptionDetails
  }

  export interface ExceptionDetails {
    exceptionId: number
    text: string
    lineNumber: number
    columnNumber: number
    scriptId?: string
    url?: string
    stackTrace?: StackTrace
    exception?: RemoteObject
    executionContextId?: number
    exceptionMetaData?: Record<string, unknown>
  }

  export interface StackTrace {
    description?: string
    callFrames: CallFrame[]
    parent?: StackTrace
    parentId?: StackTraceId
  }

  export interface CallFrame {
    functionName: string
    scriptId: string
    url: string
    lineNumber: number
    columnNumber: number
  }

  export interface StackTraceId {
    id: string
    debuggerId?: string
  }
}

/**
 * DOM domain types
 */
export namespace DOM {
  export interface Node {
    nodeId: number
    parentId?: number
    backendNodeId: number
    nodeType: number
    nodeName: string
    localName: string
    nodeValue: string
    childNodeCount?: number
    children?: Node[]
    attributes?: string[]
    documentURL?: string
    baseURL?: string
    publicId?: string
    systemId?: string
    internalSubset?: string
    xmlVersion?: string
    name?: string
    value?: string
    pseudoType?: string
    pseudoIdentifier?: string
    shadowRootType?: string
    frameId?: string
    contentDocument?: Node
    shadowRoots?: Node[]
    templateContent?: Node
    pseudoElements?: Node[]
    distributedNodes?: BackendNode[]
    isSVG?: boolean
    compatibilityMode?: string
    assignedSlot?: BackendNode
  }

  export interface BackendNode {
    nodeType: number
    nodeName: string
    backendNodeId: number
  }

  export interface RGBA {
    r: number
    g: number
    b: number
    a?: number
  }

  export interface BoxModel {
    content: number[]
    padding: number[]
    border: number[]
    margin: number[]
    width: number
    height: number
    shapeOutside?: ShapeOutsideInfo
  }

  export interface ShapeOutsideInfo {
    bounds: number[]
    shape: Array<unknown>
    marginShape: Array<unknown>
  }

  export interface GetDocumentParams {
    depth?: number
    pierce?: boolean
  }

  export interface QuerySelectorParams {
    nodeId: number
    selector: string
  }

  export interface GetBoxModelParams {
    nodeId?: number
    backendNodeId?: number
    objectId?: string
  }
}

/**
 * Network domain types
 */
export namespace Network {
  export interface Request {
    url: string
    urlFragment?: string
    method: string
    headers: Record<string, string>
    postData?: string
    hasPostData?: boolean
    postDataEntries?: PostDataEntry[]
    mixedContentType?: string
    initialPriority: ResourcePriority
    referrerPolicy: string
    isLinkPreload?: boolean
    trustTokenParams?: TrustTokenParams
    isSameSite?: boolean
  }

  export interface PostDataEntry {
    bytes?: string
  }

  export type ResourcePriority = 'VeryLow' | 'Low' | 'Medium' | 'High' | 'VeryHigh'

  export interface TrustTokenParams {
    operation: string
    refreshPolicy: string
    issuers?: string[]
  }

  export interface Response {
    url: string
    status: number
    statusText: string
    headers: Record<string, string>
    mimeType: string
    charset: string
    requestHeaders?: Record<string, string>
    requestHeadersText?: string
    connectionReused: boolean
    connectionId: number
    remoteIPAddress?: string
    remotePort?: number
    fromDiskCache?: boolean
    fromServiceWorker?: boolean
    fromPrefetchCache?: boolean
    fromEarlyHints?: boolean
    serviceWorkerRouterInfo?: ServiceWorkerRouterInfo
    encodedDataLength: number
    timing?: ResourceTiming
    serviceWorkerResponseSource?: string
    responseTime?: number
    cacheStorageCacheName?: string
    protocol?: string
    alternateProtocolUsage?: string
    securityState: SecurityState
    securityDetails?: SecurityDetails
  }

  export interface ServiceWorkerRouterInfo {
    ruleIdMatched: number
    matchedSourceType: string
  }

  export interface ResourceTiming {
    requestTime: number
    proxyStart: number
    proxyEnd: number
    dnsStart: number
    dnsEnd: number
    connectStart: number
    connectEnd: number
    sslStart: number
    sslEnd: number
    workerStart: number
    workerReady: number
    workerFetchStart: number
    workerRespondWithSettled: number
    workerRouterEvaluationStart: number
    workerCacheLookupStart: number
    sendStart: number
    sendEnd: number
    pushStart: number
    pushEnd: number
    receiveHeadersStart: number
    receiveHeadersEnd: number
  }

  export type SecurityState = 'unknown' | 'neutral' | 'insecure' | 'secure' | 'info' | 'insecure-broken'

  export interface SecurityDetails {
    protocol: string
    keyExchange: string
    keyExchangeGroup?: string
    cipher: string
    mac?: string
    certificateId: number
    subjectName: string
    sanList: string[]
    issuer: string
    validFrom: number
    validTo: number
    signedCertificateTimestampList: SignedCertificateTimestamp[]
    certificateTransparencyCompliance: string
    serverSignatureAlgorithm?: number
    encryptedClientHello: boolean
  }

  export interface SignedCertificateTimestamp {
    status: string
    origin: string
    logDescription: string
    logId: string
    timestamp: number
    hashAlgorithm: string
    signatureAlgorithm: string
    signatureData: string
  }
}

/**
 * Page domain types
 */
export namespace Page {
  export interface Frame {
    id: string
    parentId?: string
    loaderId: string
    name?: string
    url: string
    urlFragment?: string
    domainAndRegistry: string
    securityOrigin: string
    mimeType: string
    unreachableUrl?: string
    adFrameStatus?: AdFrameStatus
    secureContextType: string
    crossOriginIsolatedContextType: string
    gatedAPIFeatures: string[]
  }

  export interface AdFrameStatus {
    adFrameType: string
    explanations?: string[]
  }

  export interface NavigateParams {
    url: string
    referrer?: string
    transitionType?: string
    frameId?: string
    referrerPolicy?: string
  }

  export interface CaptureScreenshotParams {
    format?: 'jpeg' | 'png' | 'webp'
    quality?: number
    clip?: Viewport
    fromSurface?: boolean
    captureBeyondViewport?: boolean
    optimizeForSpeed?: boolean
  }

  export interface Viewport {
    x: number
    y: number
    width: number
    height: number
    scale?: number
  }
}

/**
 * Debugger domain types
 */
export namespace Debugger {
  export interface Location {
    scriptId: string
    lineNumber: number
    columnNumber?: number
  }

  export interface CallFrame {
    callFrameId: string
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

  export interface PausedEventParams {
    callFrames: CallFrame[]
    reason: 'ambiguous' | 'assert' | 'CSPViolation' | 'debugCommand' | 'DOM' | 'EventListener' | 'exception' | 'instrumentation' | 'OOM' | 'other' | 'promiseRejection' | 'XHR' | 'step'
    data?: unknown
    hitBreakpoints?: string[]
    asyncStackTrace?: Runtime.StackTrace
    asyncStackTraceId?: Runtime.StackTraceId
    asyncCallStackTraceId?: Runtime.StackTraceId
  }
}

/**
 * Console domain types
 */
export namespace Console {
  export interface ConsoleMessage {
    source: 'xml' | 'javascript' | 'network' | 'console-api' | 'storage' | 'appcache' | 'rendering' | 'security' | 'other' | 'deprecation' | 'worker'
    level: 'log' | 'warning' | 'error' | 'debug' | 'info'
    text: string
    url?: string
    line?: number
    column?: number
  }

  export interface MessageAddedEventParams {
    message: ConsoleMessage
  }
}

/**
 * Performance domain types
 */
export namespace Performance {
  export interface Metric {
    name: string
    value: number
  }

  export interface GetMetricsResult {
    metrics: Metric[]
  }

  export interface SetTimeDomainParams {
    timeDomain: 'timeTicks' | 'threadTicks'
  }
}

/**
 * CDP Client interface
 */
export interface CDPClient {
  // Connection management
  connect(options: CDPConnectionOptions): Promise<void>
  disconnect(): Promise<void>
  getConnectionState(): CDPConnectionState
  
  // Session management
  createSession(targetId: string): Promise<CDPSession>
  attachToTarget(targetId: string): Promise<void>
  detachFromTarget(sessionId: string): Promise<void>
  
  // Command execution
  send<T = unknown>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>
  
  // Event handling
  on<T = unknown>(event: string, handler: (params: T) => void): void
  off(event: string, handler?: Function): void
  once<T = unknown>(event: string, handler: (params: T) => void): void
  
  // Target discovery
  getTargets(): Promise<CDPTarget[]>
  waitForTarget(predicate: (target: CDPTarget) => boolean, timeout?: number): Promise<CDPTarget>
}

/**
 * CDP domain interfaces
 */
export interface CDPDomains {
  Runtime: {
    enable(): Promise<void>
    disable(): Promise<void>
    evaluate(params: Runtime.EvaluateParams): Promise<Runtime.EvaluateResult>
    awaitPromise(params: { promiseObjectId: string; returnByValue?: boolean; generatePreview?: boolean }): Promise<Runtime.EvaluateResult>
    callFunctionOn(params: { functionDeclaration: string; objectId?: string; arguments?: Array<{ value?: unknown; unserializableValue?: string; objectId?: string }>; silent?: boolean; returnByValue?: boolean; generatePreview?: boolean; userGesture?: boolean; awaitPromise?: boolean; executionContextId?: number; objectGroup?: string; throwOnSideEffect?: boolean }): Promise<Runtime.EvaluateResult>
    getProperties(params: { objectId: string; ownProperties?: boolean; accessorPropertiesOnly?: boolean; generatePreview?: boolean; nonIndexedPropertiesOnly?: boolean }): Promise<{ result: Array<{ name: string; value?: Runtime.RemoteObject; writable?: boolean; get?: Runtime.RemoteObject; set?: Runtime.RemoteObject; configurable: boolean; enumerable: boolean; wasThrown?: boolean; isOwn?: boolean; symbol?: Runtime.RemoteObject }>; internalProperties?: Array<{ name: string; value?: Runtime.RemoteObject }> }>
    releaseObject(params: { objectId: string }): Promise<void>
    releaseObjectGroup(params: { objectGroup: string }): Promise<void>
  }
  
  DOM: {
    enable(): Promise<void>
    disable(): Promise<void>
    getDocument(params?: DOM.GetDocumentParams): Promise<{ root: DOM.Node }>
    querySelector(params: DOM.QuerySelectorParams): Promise<{ nodeId: number }>
    querySelectorAll(params: { nodeId: number; selector: string }): Promise<{ nodeIds: number[] }>
    getBoxModel(params: DOM.GetBoxModelParams): Promise<{ model: DOM.BoxModel }>
    getNodeForLocation(params: { x: number; y: number; includeUserAgentShadowDOM?: boolean; ignorePointerEventsNone?: boolean }): Promise<{ backendNodeId: number; frameId?: string; nodeId?: number }>
    getAttributes(params: { nodeId: number }): Promise<{ attributes: string[] }>
    setAttributeValue(params: { nodeId: number; name: string; value: string }): Promise<void>
    removeAttribute(params: { nodeId: number; name: string }): Promise<void>
    getOuterHTML(params: { nodeId?: number; backendNodeId?: number; objectId?: string }): Promise<{ outerHTML: string }>
    scrollIntoViewIfNeeded(params: { nodeId?: number; backendNodeId?: number; objectId?: string; rect?: { x: number; y: number; width: number; height: number } }): Promise<void>
  }
  
  Network: {
    enable(params?: { maxTotalBufferSize?: number; maxResourceBufferSize?: number; maxPostDataSize?: number }): Promise<void>
    disable(): Promise<void>
    getResponseBody(params: { requestId: string }): Promise<{ body: string; base64Encoded: boolean }>
    setCacheDisabled(params: { cacheDisabled: boolean }): Promise<void>
    clearBrowserCache(): Promise<void>
    clearBrowserCookies(): Promise<void>
    getCookies(params?: { urls?: string[] }): Promise<{ cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; size: number; httpOnly: boolean; secure: boolean; session: boolean; sameSite?: string; priority: string; sameParty: boolean; sourceScheme: string; sourcePort: number; partitionKey?: string; partitionKeyOpaque?: boolean }> }>
    setCookie(params: { name: string; value: string; url?: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: string; expires?: number; priority?: string; sameParty?: boolean; sourceScheme?: string; sourcePort?: number; partitionKey?: string }): Promise<void>
  }
  
  Page: {
    enable(): Promise<void>
    disable(): Promise<void>
    navigate(params: Page.NavigateParams): Promise<{ frameId: string; loaderId?: string; errorText?: string }>
    reload(params?: { ignoreCache?: boolean; scriptToEvaluateOnLoad?: string }): Promise<void>
    getFrameTree(): Promise<{ frameTree: { frame: Page.Frame; childFrames?: Array<unknown> } }>
    captureScreenshot(params?: Page.CaptureScreenshotParams): Promise<{ data: string }>
    handleJavaScriptDialog(params: { accept: boolean; promptText?: string }): Promise<void>
    addScriptToEvaluateOnNewDocument(params: { source: string; worldName?: string }): Promise<{ identifier: string }>
    removeScriptToEvaluateOnNewDocument(params: { identifier: string }): Promise<void>
  }
  
  Debugger: {
    enable(params?: { maxScriptsCacheSize?: number }): Promise<{ debuggerId: string }>
    disable(): Promise<void>
    pause(): Promise<void>
    resume(params?: { terminateOnResume?: boolean }): Promise<void>
    stepOver(params?: { skipList?: Array<{ scriptId?: string; start?: { lineNumber: number; columnNumber?: number }; end?: { lineNumber: number; columnNumber?: number } }> }): Promise<void>
    stepInto(params?: { breakOnAsyncCall?: boolean; skipList?: Array<unknown> }): Promise<void>
    stepOut(): Promise<void>
    setPauseOnExceptions(params: { state: 'none' | 'all' | 'uncaught' }): Promise<void>
    evaluateOnCallFrame(params: { callFrameId: string; expression: string; objectGroup?: string; includeCommandLineAPI?: boolean; silent?: boolean; returnByValue?: boolean; generatePreview?: boolean; throwOnSideEffect?: boolean; timeout?: number }): Promise<Runtime.EvaluateResult>
    setBreakpointByUrl(params: { lineNumber: number; url?: string; urlRegex?: string; scriptHash?: string; columnNumber?: number; condition?: string }): Promise<{ breakpointId: string; locations: Debugger.Location[] }>
    removeBreakpoint(params: { breakpointId: string }): Promise<void>
  }
  
  Console: {
    enable(): Promise<void>
    disable(): Promise<void>
    clearMessages(): Promise<void>
  }
  
  Performance: {
    enable(params?: { timeDomain?: 'timeTicks' | 'threadTicks' }): Promise<void>
    disable(): Promise<void>
    getMetrics(): Promise<Performance.GetMetricsResult>
    setTimeDomain(params: Performance.SetTimeDomainParams): Promise<void>
  }
}

/**
 * CDP error types
 */
export class CDPError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'CDPError'
  }
}

export class CDPConnectionError extends CDPError {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'CDPConnectionError'
  }
}

export class CDPTimeoutError extends CDPError {
  constructor(message: string, public timeout: number) {
    super(message)
    this.name = 'CDPTimeoutError'
  }
}

export class CDPProtocolError extends CDPError {
  constructor(
    message: string,
    public method: string,
    public params?: unknown
  ) {
    super(message)
    this.name = 'CDPProtocolError'
  }
}
