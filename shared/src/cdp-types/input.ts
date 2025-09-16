/**
 * Chrome DevTools Protocol - Input Domain Types
 * https://chromedevtools.github.io/devtools-protocol/tot/Input/
 */

export namespace Input {
  export interface TouchPoint {
    x: number
    y: number
    radiusX?: number
    radiusY?: number
    rotationAngle?: number
    force?: number
    tangentialPressure?: number
    tiltX?: number
    tiltY?: number
    twist?: number
    id?: number
  }

  export type MouseButton = 'none' | 'left' | 'middle' | 'right' | 'back' | 'forward'

  // Commands
  export interface DispatchKeyEventParams {
    type: 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char'
    modifiers?: number
    timestamp?: number
    text?: string
    unmodifiedText?: string
    keyIdentifier?: string
    code?: string
    key?: string
    windowsVirtualKeyCode?: number
    nativeVirtualKeyCode?: number
    autoRepeat?: boolean
    isKeypad?: boolean
    isSystemKey?: boolean
    location?: number
    commands?: string[]
  }

  export interface DispatchMouseEventParams {
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel'
    x: number
    y: number
    modifiers?: number
    timestamp?: number
    button?: MouseButton
    buttons?: number
    clickCount?: number
    force?: number
    tangentialPressure?: number
    tiltX?: number
    tiltY?: number
    twist?: number
    deltaX?: number
    deltaY?: number
    pointerType?: 'mouse' | 'pen'
  }

  export interface DispatchTouchEventParams {
    type: 'touchStart' | 'touchEnd' | 'touchMove' | 'touchCancel'
    touchPoints: TouchPoint[]
    modifiers?: number
    timestamp?: number
  }

  export interface SetIgnoreInputEventsParams {
    ignore: boolean
  }

  export interface SynthesizePinchGestureParams {
    x: number
    y: number
    scaleFactor: number
    relativeSpeed?: number
    gestureSourceType?: 'default' | 'touch' | 'mouse'
  }

  export interface SynthesizeScrollGestureParams {
    x: number
    y: number
    xDistance?: number
    yDistance?: number
    xOverscroll?: number
    yOverscroll?: number
    preventFling?: boolean
    speed?: number
    gestureSourceType?: 'default' | 'touch' | 'mouse'
    repeatCount?: number
    repeatDelayMs?: number
    interactionMarkerName?: string
  }

  export interface SynthesizeTapGestureParams {
    x: number
    y: number
    duration?: number
    tapCount?: number
    gestureSourceType?: 'default' | 'touch' | 'mouse'
  }
}