/**
 * Dependency Injection Container - Level 0 (Foundation)
 * Provides a simple, type-safe dependency injection system
 */

export type Factory<T> = (container: Container) => T | Promise<T>;
export type Token<T> = symbol & { __type?: T };

export function createToken<T>(name: string): Token<T> {
  return Symbol(name) as Token<T>;
}

export interface Container {
  register<T>(token: Token<T>, factory: Factory<T>): void;
  resolve<T>(token: Token<T>): T;
  resolveAsync<T>(token: Token<T>): Promise<T>;
  createScope(): Container;
  has<T>(token: Token<T>): boolean;
}

export class DIContainer implements Container {
  private registry = new Map<symbol, Factory<any>>();
  private instances = new Map<symbol, any>();
  private parent?: Container;

  constructor(parent?: Container) {
    this.parent = parent;
  }

  register<T>(token: Token<T>, factory: Factory<T>): void {
    this.registry.set(token, factory);
  }

  has<T>(token: Token<T>): boolean {
    return this.registry.has(token) || (this.parent?.has(token) ?? false);
  }

  resolve<T>(token: Token<T>): T {
    // Check if already instantiated
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if registered in this container
    const factory = this.registry.get(token);
    if (factory) {
      const instance = factory(this);
      if (instance instanceof Promise) {
        throw new Error(
          `Token ${token.toString()} returns a Promise. Use resolveAsync() instead.`
        );
      }
      this.instances.set(token, instance);
      return instance;
    }

    // Check parent container
    if (this.parent) {
      return this.parent.resolve(token);
    }

    throw new Error(`No factory registered for token: ${token.toString()}`);
  }

  async resolveAsync<T>(token: Token<T>): Promise<T> {
    // Check if already instantiated
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if registered in this container
    const factory = this.registry.get(token);
    if (factory) {
      const instance = await factory(this);
      this.instances.set(token, instance);
      return instance;
    }

    // Check parent container
    if (this.parent) {
      return this.parent.resolveAsync(token);
    }

    throw new Error(`No factory registered for token: ${token.toString()}`);
  }

  createScope(): Container {
    return new DIContainer(this);
  }
}

// Global container instance for the application
let globalContainer: Container | null = null;

export function createGlobalContainer(): Container {
  if (!globalContainer) {
    globalContainer = new DIContainer();
  }
  return globalContainer;
}

export function getGlobalContainer(): Container {
  if (!globalContainer) {
    throw new Error('Global container not initialized. Call createGlobalContainer() first.');
  }
  return globalContainer;
}

export function resetGlobalContainer(): void {
  globalContainer = null;
}