/**
 * Chrome Type Extensions - Level 0 (Foundation)
 * Extended types for Chrome-related operations
 */

import type { Target as BaseTarget } from 'chrome-remote-interface';

/**
 * Extended Target type that includes optional properties
 */
export interface ExtendedTarget extends BaseTarget {
  faviconUrl?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Extended evaluation options for Chrome DevTools Protocol
 */
export interface ExtendedEvaluateOptions {
  expression: string;
  objectGroup?: string;
  includeCommandLineAPI?: boolean;
  silent?: boolean;
  contextId?: number;
  returnByValue?: boolean;
  generatePreview?: boolean;
  userGesture?: boolean;
  awaitPromise?: boolean;
  throwOnSideEffect?: boolean;
  timeout?: number;
  disableBreaks?: boolean;
  replMode?: boolean;
  allowUnsafeEvalBlockedByCSP?: boolean;
  uniqueContextId?: string;
}

/**
 * Extended evaluation result with additional properties
 */
export interface ExtendedEvaluateResult {
  result: {
    type: string;
    value?: any;
    objectId?: string;
    className?: string;
    preview?: any;
    unserializableValue?: string;
    description?: string;
  };
  exceptionDetails?: {
    text: string;
    lineNumber?: number;
    columnNumber?: number;
    scriptId?: string;
    stackTrace?: any;
    exception?: any;
    executionContextId?: number;
  };
}