/**
 * Chrome DevTools Protocol - Page Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/
 */

export namespace Page {
  // Basic types
  export type FrameId = string
  export type LoaderId = string
  export type ResourceType = 'Document' | 'Stylesheet' | 'Image' | 'Media' | 'Font' | 'Script' | 
                            'TextTrack' | 'XHR' | 'Fetch' | 'EventSource' | 'WebSocket' | 
                            'Manifest' | 'SignedExchange' | 'Ping' | 'CSPViolationReport' | 'Other'

  export interface Frame {
    id: FrameId
    parentId?: FrameId
    loaderId: LoaderId
    name?: string
    url: string
    urlFragment?: string
    domainAndRegistry: string
    securityOrigin: string
    mimeType: string
    unreachableUrl?: string
    adFrameStatus?: AdFrameStatus
    secureContextType: SecureContextType
    crossOriginIsolatedContextType: CrossOriginIsolatedContextType
    gatedAPIFeatures: string[]
  }

  export interface AdFrameStatus {
    adFrameType: 'none' | 'child' | 'root'
    explanations?: string[]
  }

  export type SecureContextType = 'Secure' | 'SecureLocalhost' | 'InsecureScheme' | 'InsecureAncestor'
  export type CrossOriginIsolatedContextType = 'Isolated' | 'NotIsolated' | 'NotIsolatedFeatureDisabled'

  // Command parameters
  export interface NavigateParams {
    url: string
    referrer?: string
    transitionType?: TransitionType
    frameId?: FrameId
    referrerPolicy?: ReferrerPolicy
  }

  export interface NavigateResult {
    frameId: FrameId
    loaderId?: LoaderId
    errorText?: string
  }

  export type TransitionType = 'link' | 'typed' | 'address_bar' | 'auto_bookmark' | 'auto_subframe' | 
                               'manual_subframe' | 'generated' | 'auto_toplevel' | 'form_submit' | 
                               'reload' | 'keyword' | 'keyword_generated' | 'other'

  export type ReferrerPolicy = 'noReferrer' | 'noReferrerWhenDowngrade' | 'origin' | 'originWhenCrossOrigin' | 
                               'sameOrigin' | 'strictOrigin' | 'strictOriginWhenCrossOrigin' | 'unsafeUrl'

  export interface ReloadParams {
    ignoreCache?: boolean
    scriptToEvaluateOnLoad?: string
  }

  export interface StopLoadingParams {
    // No parameters
  }

  export interface GetFrameTreeResult {
    frameTree: FrameTree
  }

  export interface FrameTree {
    frame: Frame
    childFrames?: FrameTree[]
  }

  export interface CaptureScreenshotParams {
    format?: 'jpeg' | 'png' | 'webp'
    quality?: number
    clip?: Viewport
    fromSurface?: boolean
    captureBeyondViewport?: boolean
  }

  export interface CaptureScreenshotResult {
    data: string // Base64-encoded image
  }

  export interface Viewport {
    x: number
    y: number
    width: number
    height: number
    scale?: number
  }

  export interface PrintToPDFParams {
    landscape?: boolean
    displayHeaderFooter?: boolean
    printBackground?: boolean
    scale?: number
    paperWidth?: number
    paperHeight?: number
    marginTop?: number
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
    pageRanges?: string
    headerTemplate?: string
    footerTemplate?: string
    preferCSSPageSize?: boolean
    transferMode?: 'ReturnAsBase64' | 'ReturnAsStream'
  }

  export interface PrintToPDFResult {
    data?: string // Base64-encoded pdf (if transferMode is ReturnAsBase64)
    stream?: string // Stream handle (if transferMode is ReturnAsStream)
  }

  export interface SetDocumentContentParams {
    frameId: FrameId
    html: string
  }

  export interface AddScriptToEvaluateOnNewDocumentParams {
    source: string
    worldName?: string
  }

  export interface AddScriptToEvaluateOnNewDocumentResult {
    identifier: string
  }

  export interface RemoveScriptToEvaluateOnNewDocumentParams {
    identifier: string
  }

  export interface SetLifecycleEventsEnabledParams {
    enabled: boolean
  }

  // Events
  export interface FrameNavigatedEvent {
    frame: Frame
    type: NavigationType
  }

  export type NavigationType = 'Navigation' | 'BackForwardCacheRestore'

  export interface FrameDetachedEvent {
    frameId: FrameId
    reason: 'remove' | 'swap'
  }

  export interface FrameStartedLoadingEvent {
    frameId: FrameId
  }

  export interface FrameStoppedLoadingEvent {
    frameId: FrameId
  }

  export interface LifecycleEvent {
    frameId: FrameId
    loaderId: LoaderId
    name: string
    timestamp: number
  }

  export interface LoadEventFiredEvent {
    timestamp: number
  }

  export interface DomContentEventFiredEvent {
    timestamp: number
  }

  export interface WindowOpenEvent {
    url: string
    windowName: string
    windowFeatures: string[]
    userGesture: boolean
  }

  export interface JavascriptDialogOpeningEvent {
    url: string
    message: string
    type: 'alert' | 'confirm' | 'prompt' | 'beforeunload'
    hasBrowserHandler: boolean
    defaultPrompt?: string
  }

  export interface JavascriptDialogClosedEvent {
    result: boolean
    userInput: string
  }

  export interface ScreencastFrameEvent {
    data: string // Base64-encoded
    metadata: ScreencastFrameMetadata
    sessionId: number
  }

  export interface ScreencastFrameMetadata {
    offsetTop: number
    pageScaleFactor: number
    deviceWidth: number
    deviceHeight: number
    scrollOffsetX: number
    scrollOffsetY: number
    timestamp?: number
  }

  // Enable/disable commands
  export interface SetBypassCSPParams {
    enabled: boolean
  }

  export interface GetLayoutMetricsResult {
    contentSize: LayoutViewport
    layoutViewport: LayoutViewport
    visualViewport: VisualViewport
  }

  export interface LayoutViewport {
    pageX: number
    pageY: number
    clientWidth: number
    clientHeight: number
  }

  export interface VisualViewport {
    offsetX: number
    offsetY: number
    pageX: number
    pageY: number
    clientWidth: number
    clientHeight: number
    scale: number
    zoom?: number
  }
}