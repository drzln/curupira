/**
 * Chrome DevTools Protocol - Network Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Network/
 */

export namespace Network {
  // Basic types
  export type RequestId = string
  export type LoaderId = string
  export type InterceptionId = string
  export type ErrorReason = 'Failed' | 'Aborted' | 'TimedOut' | 'AccessDenied' | 'ConnectionClosed' | 
                           'ConnectionReset' | 'ConnectionRefused' | 'ConnectionAborted' | 
                           'ConnectionFailed' | 'NameNotResolved' | 'InternetDisconnected' | 
                           'AddressUnreachable' | 'BlockedByClient' | 'BlockedByResponse'

  export interface Request {
    url: string
    urlFragment?: string
    method: string
    headers: Record<string, string>
    postData?: string
    hasPostData?: boolean
    mixedContentType?: MixedContentType
    initialPriority: ResourcePriority
    referrerPolicy: ReferrerPolicy
    isLinkPreload?: boolean
    trustTokenParams?: TrustTokenParams
  }

  export type MixedContentType = 'blockable' | 'optionally-blockable' | 'none'
  export type ResourcePriority = 'VeryLow' | 'Low' | 'Medium' | 'High' | 'VeryHigh'
  export type ReferrerPolicy = 'unsafe-url' | 'no-referrer-when-downgrade' | 'no-referrer' | 
                               'origin' | 'origin-when-cross-origin' | 'same-origin' | 
                               'strict-origin' | 'strict-origin-when-cross-origin'

  export interface TrustTokenParams {
    type: 'Issuance' | 'Redemption' | 'Signing'
    refreshPolicy: 'UseCached' | 'Refresh'
    issuers?: string[]
  }

  export interface Response {
    url: string
    status: number
    statusText: string
    headers: Record<string, string>
    mimeType: string
    requestHeaders?: Record<string, string>
    requestHeadersText?: string
    connectionReused: boolean
    connectionId: number
    remoteIPAddress?: string
    remotePort?: number
    fromDiskCache?: boolean
    fromServiceWorker?: boolean
    fromPrefetchCache?: boolean
    encodedDataLength: number
    timing?: ResourceTiming
    serviceWorkerResponseSource?: ServiceWorkerResponseSource
    responseTime?: number
    cacheStorageCacheName?: string
    protocol?: string
    securityState: string  // Security.SecurityState
    securityDetails?: SecurityDetails
  }

  export type ServiceWorkerResponseSource = 'cache-storage' | 'http-cache' | 'fallback-code' | 'network'

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
    sendStart: number
    sendEnd: number
    pushStart: number
    pushEnd: number
    receiveHeadersEnd: number
  }

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
    certificateTransparencyCompliance: CertificateTransparencyCompliance
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

  export type CertificateTransparencyCompliance = 'unknown' | 'not-compliant' | 'compliant'

  export interface Cookie {
    name: string
    value: string
    domain: string
    path: string
    expires: number
    size: number
    httpOnly: boolean
    secure: boolean
    session: boolean
    sameSite?: CookieSameSite
    priority?: CookiePriority
    sameParty?: boolean
    sourceScheme?: CookieSourceScheme
    sourcePort?: number
  }

  export type CookieSameSite = 'Strict' | 'Lax' | 'None'
  export type CookiePriority = 'Low' | 'Medium' | 'High'
  export type CookieSourceScheme = 'Unset' | 'NonSecure' | 'Secure'

  // Command parameters
  export interface EnableParams {
    maxTotalBufferSize?: number
    maxResourceBufferSize?: number
    maxPostDataSize?: number
  }

  export interface SetCacheDisabledParams {
    cacheDisabled: boolean
  }

  export interface SetCookieParams {
    name: string
    value: string
    url?: string
    domain?: string
    path?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: CookieSameSite
    expires?: number
    priority?: CookiePriority
    sameParty?: boolean
    sourceScheme?: CookieSourceScheme
    sourcePort?: number
  }

  export interface SetCookieResult {
    success: boolean
  }

  export interface GetCookiesParams {
    urls?: string[]
  }

  export interface GetCookiesResult {
    cookies: Cookie[]
  }

  export interface DeleteCookiesParams {
    name: string
    url?: string
    domain?: string
    path?: string
  }

  export interface SetExtraHTTPHeadersParams {
    headers: Record<string, string>
  }

  export interface SetUserAgentOverrideParams {
    userAgent: string
    acceptLanguage?: string
    platform?: string
    userAgentMetadata?: UserAgentMetadata
  }

  export interface UserAgentMetadata {
    brands?: UserAgentBrandVersion[]
    fullVersionList?: UserAgentBrandVersion[]
    platform: string
    platformVersion: string
    architecture: string
    model: string
    mobile: boolean
    bitness?: string
    wow64?: boolean
  }

  export interface UserAgentBrandVersion {
    brand: string
    version: string
  }

  export interface GetResponseBodyParams {
    requestId: RequestId
  }

  export interface GetResponseBodyResult {
    body: string
    base64Encoded: boolean
  }

  export interface SetRequestInterceptionParams {
    patterns: RequestPattern[]
  }

  export interface RequestPattern {
    urlPattern?: string
    resourceType?: ResourceType
    interceptionStage?: InterceptionStage
  }

  export type ResourceType = 'Document' | 'Stylesheet' | 'Image' | 'Media' | 'Font' | 'Script' | 
                            'TextTrack' | 'XHR' | 'Fetch' | 'EventSource' | 'WebSocket' | 
                            'Manifest' | 'SignedExchange' | 'Ping' | 'CSPViolationReport' | 'Preflight' | 'Other'

  export type InterceptionStage = 'Request' | 'HeadersReceived'

  export interface ContinueInterceptedRequestParams {
    interceptionId: InterceptionId
    errorReason?: ErrorReason
    rawResponse?: string
    url?: string
    method?: string
    postData?: string
    headers?: Record<string, string>
    authChallengeResponse?: AuthChallengeResponse
  }

  export interface AuthChallengeResponse {
    response: 'Default' | 'CancelAuth' | 'ProvideCredentials'
    username?: string
    password?: string
  }

  // Events
  export interface RequestWillBeSentEvent {
    requestId: RequestId
    loaderId: LoaderId
    documentURL: string
    request: Request
    timestamp: number
    wallTime: number
    initiator: Initiator
    redirectResponse?: Response
    type?: ResourceType
    frameId?: string
    hasUserGesture?: boolean
  }

  export interface Initiator {
    type: 'parser' | 'script' | 'preload' | 'SignedExchange' | 'preflight' | 'other'
    stack?: any  // Runtime.StackTrace
    url?: string
    lineNumber?: number
    columnNumber?: number
    requestId?: RequestId
  }

  export interface RequestInterceptedEvent {
    interceptionId: InterceptionId
    request: Request
    frameId: string
    resourceType: ResourceType
    isNavigationRequest: boolean
    isDownload?: boolean
    redirectUrl?: string
    authChallenge?: AuthChallenge
    responseErrorReason?: ErrorReason
    responseStatusCode?: number
    responseHeaders?: Record<string, string>
    requestId?: RequestId
  }

  export interface AuthChallenge {
    source?: 'Server' | 'Proxy'
    origin: string
    scheme: string
    realm: string
  }

  export interface ResponseReceivedEvent {
    requestId: RequestId
    loaderId: LoaderId
    timestamp: number
    type: ResourceType
    response: Response
    frameId?: string
  }

  export interface LoadingFinishedEvent {
    requestId: RequestId
    timestamp: number
    encodedDataLength: number
    shouldReportCorbBlocking?: boolean
  }

  export interface LoadingFailedEvent {
    requestId: RequestId
    timestamp: number
    type: ResourceType
    errorText: string
    canceled?: boolean
    blockedReason?: BlockedReason
    corsErrorStatus?: CorsErrorStatus
  }

  export type BlockedReason = 'other' | 'csp' | 'mixed-content' | 'origin' | 'inspector' | 
                             'subresource-filter' | 'content-type' | 'coep-frame-resource-needs-coep-header' | 
                             'coop-sandboxed-iframe-cannot-navigate-to-coop-page' | 
                             'corp-not-same-origin' | 'corp-not-same-origin-after-defaulted-to-same-origin-by-coep' | 
                             'corp-not-same-site'

  export interface CorsErrorStatus {
    corsError: CorsError
    failedParameter: string
  }

  export type CorsError = 'DisallowedByMode' | 'InvalidResponse' | 'WildcardOriginNotAllowed' | 
                         'MissingAllowOriginHeader' | 'MultipleAllowOriginValues' | 
                         'InvalidAllowOriginValue' | 'AllowOriginMismatch' | 
                         'InvalidAllowCredentials' | 'CorsDisabledScheme' | 'PreflightInvalidStatus' | 
                         'PreflightDisallowedRedirect' | 'PreflightWildcardOriginNotAllowed' | 
                         'PreflightMissingAllowOriginHeader' | 'PreflightMultipleAllowOriginValues' | 
                         'PreflightInvalidAllowOriginValue' | 'PreflightAllowOriginMismatch' | 
                         'PreflightInvalidAllowCredentials' | 'PreflightMissingAllowExternal' | 
                         'PreflightInvalidAllowExternal' | 'InvalidAllowMethodsPreflightResponse' | 
                         'InvalidAllowHeadersPreflightResponse' | 'MethodDisallowedByPreflightResponse' | 
                         'HeaderDisallowedByPreflightResponse' | 'RedirectContainsCredentials' | 
                         'InsecurePrivateNetwork' | 'InvalidPrivateNetworkAccess' | 
                         'UnexpectedPrivateNetworkAccess' | 'NoCorsRedirectModeNotFollow' | 
                         'PreflightMissingPrivateNetworkAccessId' | 'PreflightMissingPrivateNetworkAccessName' | 
                         'PrivateNetworkAccessPermissionUnavailable' | 'PrivateNetworkAccessPermissionDenied'
}