/**
 * Chrome DevTools Protocol - DOM Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/DOM/
 */

export namespace DOM {
  // Basic types
  export type NodeId = number
  export type BackendNodeId = number
  export type NodeType = 1 | 3 | 8 | 9 | 10 | 11  // Element, Text, Comment, Document, DocumentType, DocumentFragment

  export interface Node {
    nodeId: NodeId
    parentId?: NodeId
    backendNodeId: BackendNodeId
    nodeType: NodeType
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
    pseudoType?: PseudoType
    shadowRootType?: ShadowRootType
    frameId?: string
    contentDocument?: Node
    shadowRoots?: Node[]
    templateContent?: Node
    pseudoElements?: Node[]
    importedDocument?: Node
    distributedNodes?: BackendNode[]
    isSVG?: boolean
    compatibilityMode?: 'QuirksMode' | 'LimitedQuirksMode' | 'NoQuirksMode'
  }

  export interface BackendNode {
    nodeType: NodeType
    nodeName: string
    backendNodeId: BackendNodeId
  }

  export type PseudoType = 'first-line' | 'first-letter' | 'before' | 'after' | 'marker' | 
                          'backdrop' | 'selection' | 'search-text' | 'target-text' | 
                          'spelling-error' | 'grammar-error' | 'highlight' | 'first-line-inherited' | 
                          'scrollbar' | 'scrollbar-thumb' | 'scrollbar-button' | 'scrollbar-track' | 
                          'scrollbar-track-piece' | 'scrollbar-corner' | 'resizer' | 'input-list-button' | 
                          'view-transition' | 'view-transition-group' | 'view-transition-image-pair' | 
                          'view-transition-old' | 'view-transition-new'

  export type ShadowRootType = 'user-agent' | 'open' | 'closed'

  export interface RGBA {
    r: number  // 0-255
    g: number  // 0-255
    b: number  // 0-255
    a?: number // 0-1
  }

  export interface BoxModel {
    content: number[]  // Quad (x1,y1, x2,y2, x3,y3, x4,y4)
    padding: number[]  // Quad
    border: number[]   // Quad
    margin: number[]   // Quad
    width: number
    height: number
    shapeOutside?: ShapeOutsideInfo
  }

  export interface ShapeOutsideInfo {
    bounds: number[]  // Quad
    shape: any[]
    marginShape: any[]
  }

  export interface Rect {
    x: number
    y: number
    width: number
    height: number
  }

  // Command parameters
  export interface GetDocumentParams {
    depth?: number
    pierce?: boolean
  }

  export interface GetDocumentResult {
    root: Node
  }

  export interface QuerySelectorParams {
    nodeId: NodeId
    selector: string
  }

  export interface QuerySelectorResult {
    nodeId: NodeId
  }

  export interface QuerySelectorAllParams {
    nodeId: NodeId
    selector: string
  }

  export interface QuerySelectorAllResult {
    nodeIds: NodeId[]
  }

  export interface SetNodeNameParams {
    nodeId: NodeId
    name: string
  }

  export interface SetNodeNameResult {
    nodeId: NodeId
  }

  export interface SetNodeValueParams {
    nodeId: NodeId
    value: string
  }

  export interface RemoveNodeParams {
    nodeId: NodeId
  }

  export interface SetAttributeValueParams {
    nodeId: NodeId
    name: string
    value: string
  }

  export interface SetAttributesAsTextParams {
    nodeId: NodeId
    text: string
    name?: string
  }

  export interface RemoveAttributeParams {
    nodeId: NodeId
    name: string
  }

  export interface GetOuterHTMLParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
  }

  export interface GetOuterHTMLResult {
    outerHTML: string
  }

  export interface SetOuterHTMLParams {
    nodeId: NodeId
    outerHTML: string
  }

  export interface GetAttributesParams {
    nodeId: NodeId
  }

  export interface GetAttributesResult {
    attributes: string[]  // Flattened array of name/value pairs
  }

  export interface RequestChildNodesParams {
    nodeId: NodeId
    depth?: number
    pierce?: boolean
  }

  export interface MoveToParams {
    nodeId: NodeId
    targetNodeId: NodeId
    insertBeforeNodeId?: NodeId
  }

  export interface MoveToResult {
    nodeId: NodeId
  }

  export interface FocusParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
  }

  export interface SetFileInputFilesParams {
    files: string[]
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
  }

  export interface GetBoxModelParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
  }

  export interface GetBoxModelResult {
    model: BoxModel
  }

  export interface GetContentQuadsParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
  }

  export interface GetContentQuadsResult {
    quads: number[][]  // Array of Quads
  }

  export interface ScrollIntoViewIfNeededParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
    rect?: Rect
  }

  export interface GetNodeForLocationParams {
    x: number
    y: number
    includeUserAgentShadowDOM?: boolean
    ignorePointerEventsNone?: boolean
  }

  export interface GetNodeForLocationResult {
    backendNodeId: BackendNodeId
    frameId?: string  // Page.FrameId
    nodeId?: NodeId
  }

  export interface ResolveNodeParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectGroup?: string
    executionContextId?: number  // Runtime.ExecutionContextId
  }

  export interface ResolveNodeResult {
    object: any  // Runtime.RemoteObject
  }

  export interface DescribeNodeParams {
    nodeId?: NodeId
    backendNodeId?: BackendNodeId
    objectId?: string  // Runtime.RemoteObjectId
    depth?: number
    pierce?: boolean
  }

  export interface DescribeNodeResult {
    node: Node
  }

  export interface GetFrameOwnerParams {
    frameId: string  // Page.FrameId
  }

  export interface GetFrameOwnerResult {
    backendNodeId: BackendNodeId
    nodeId?: NodeId
  }

  // Events
  export interface DocumentUpdatedEvent {
    // No parameters - entire document has been updated
  }

  export interface SetChildNodesEvent {
    parentId: NodeId
    nodes: Node[]
  }

  export interface AttributeModifiedEvent {
    nodeId: NodeId
    name: string
    value: string
  }

  export interface AttributeRemovedEvent {
    nodeId: NodeId
    name: string
  }

  export interface CharacterDataModifiedEvent {
    nodeId: NodeId
    characterData: string
  }

  export interface ChildNodeCountUpdatedEvent {
    nodeId: NodeId
    childNodeCount: number
  }

  export interface ChildNodeInsertedEvent {
    parentNodeId: NodeId
    previousNodeId: NodeId
    node: Node
  }

  export interface ChildNodeRemovedEvent {
    parentNodeId: NodeId
    nodeId: NodeId
  }

  // Enable/disable commands
  export interface EnableParams {
    includeWhitespace?: 'none' | 'all'
  }

  export interface DisableParams {
    // No parameters
  }
}