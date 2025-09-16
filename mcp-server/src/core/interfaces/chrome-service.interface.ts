/**
 * Chrome Service Interface - Level 0 (Foundation)
 * Defines the contract for Chrome browser interaction services
 */

import type { IChromeClient, ConnectionOptions } from '../../chrome/interfaces.js';

export interface IChromeService {
  /**
   * Connect to a Chrome instance
   * @param options Connection options including host, port, etc.
   * @returns A connected Chrome client instance
   */
  connect(options: ConnectionOptions): Promise<IChromeClient>;

  /**
   * Get the current client if connected
   * @returns The current Chrome client or null if not connected
   */
  getCurrentClient(): IChromeClient | null;

  /**
   * Check if currently connected to Chrome
   */
  isConnected(): boolean;

  /**
   * Disconnect from Chrome
   */
  disconnect(): Promise<void>;
}