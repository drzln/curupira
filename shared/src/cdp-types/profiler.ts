/**
 * Chrome DevTools Protocol - Profiler Domain Types
 * Auto-generated from protocol definition
 */

import type { Runtime } from './runtime.js'
import type { Debugger } from './debugger.js'

export namespace Profiler {
  /**
   * Profile node. Holds callsite information, execution statistics and child nodes.
   */
  export interface ProfileNode {
    /**
     * Unique node identifier.
     */
    id: number
    /**
     * Function location.
     */
    callFrame: Runtime.CallFrame
    /**
     * Number of samples where this node was on top of the call stack.
     */
    hitCount?: number
    /**
     * Child node ids.
     */
    children?: number[]
    /**
     * The reason of being not optimized. The function may be deoptimized or marked as don't
     * optimize.
     */
    deoptReason?: string
    /**
     * An array of source position ticks.
     */
    positionTicks?: PositionTickInfo[]
  }

  /**
   * Profile.
   */
  export interface Profile {
    /**
     * The list of profile nodes. First item is the root node.
     */
    nodes: ProfileNode[]
    /**
     * Profiling start timestamp in microseconds.
     */
    startTime: number
    /**
     * Profiling end timestamp in microseconds.
     */
    endTime: number
    /**
     * Ids of samples top nodes.
     */
    samples?: number[]
    /**
     * Time intervals between adjacent samples in microseconds. The first delta is relative to the
     * profile startTime.
     */
    timeDeltas?: number[]
  }

  /**
   * Specifies a number of samples attributed to a certain source position.
   */
  export interface PositionTickInfo {
    /**
     * Source line number (1-based).
     */
    line: number
    /**
     * Number of samples attributed to the source line.
     */
    ticks: number
  }

  /**
   * Coverage data for a source range.
   */
  export interface CoverageRange {
    /**
     * JavaScript script source offset for the range start.
     */
    startOffset: number
    /**
     * JavaScript script source offset for the range end.
     */
    endOffset: number
    /**
     * Collected execution count of the source range.
     */
    count: number
  }

  /**
   * Coverage data for a JavaScript function.
   */
  export interface FunctionCoverage {
    /**
     * JavaScript function name.
     */
    functionName: string
    /**
     * Source ranges inside the function with coverage data.
     */
    ranges: CoverageRange[]
    /**
     * Whether coverage data for this function has block granularity.
     */
    isBlockCoverage: boolean
  }

  /**
   * Coverage data for a JavaScript script.
   */
  export interface ScriptCoverage {
    /**
     * JavaScript script id.
     */
    scriptId: Runtime.ScriptId
    /**
     * JavaScript script name or url.
     */
    url: string
    /**
     * Functions contained in the script that has coverage data.
     */
    functions: FunctionCoverage[]
  }

  /**
   * Type profile data collected during runtime for a JavaScript script.
   */
  export interface TypeObject {
    /**
     * Name of a type collected with type profiling.
     */
    name: string
  }

  /**
   * Source offset and types for a parameter or return value.
   */
  export interface TypeProfileEntry {
    /**
     * Source offset of the parameter or end of function for return values.
     */
    offset: number
    /**
     * The types for this parameter or return value.
     */
    types: TypeObject[]
  }

  /**
   * Type profile data collected during runtime for a JavaScript script.
   */
  export interface ScriptTypeProfile {
    /**
     * JavaScript script id.
     */
    scriptId: Runtime.ScriptId
    /**
     * JavaScript script name or url.
     */
    url: string
    /**
     * Type profile entries for parameters and return values of the functions in the script.
     */
    entries: TypeProfileEntry[]
  }

  /**
   * Collected counter information.
   */
  export interface CounterInfo {
    /**
     * Counter name.
     */
    name: string
    /**
     * Counter value.
     */
    value: number
  }

  /**
   * Runtime call counter information.
   */
  export interface RuntimeCallCounterInfo {
    /**
     * Counter name.
     */
    name: string
    /**
     * Counter value.
     */
    value: number
    /**
     * Counter time in seconds.
     */
    time: number
  }

  /**
   * Sent when new profile is started using console.profile() command.
   */
  export interface ConsoleProfileStartedEventDataType {
    id: string
    /**
     * Location of console.profile().
     */
    location: Debugger.Location
    /**
     * Profile title passed as an argument to console.profile().
     */
    title?: string
  }

  /**
   * Sent when console profile is finished.
   */
  export interface ConsoleProfileFinishedEventDataType {
    id: string
    /**
     * Location of console.profileEnd().
     */
    location: Debugger.Location
    profile: Profile
    /**
     * Profile title passed as an argument to console.profile().
     */
    title?: string
  }
}