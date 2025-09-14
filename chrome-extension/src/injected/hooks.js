// Injected script to hook into page context
(function() {
  'use strict'

  console.log('Curupira hooks injected')

  // Store original methods
  const originalMethods = {}

  // React DevTools hook
  function setupReactHooks() {
    if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
      const reactHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
      
      // Hook into React renderer
      const originalOnCommitFiberRoot = reactHook.onCommitFiberRoot
      reactHook.onCommitFiberRoot = function(id, root, ...args) {
        // Send React update to content script
        window.postMessage({
          source: 'curupira-page',
          type: 'react.commit',
          data: {
            id,
            timestamp: Date.now(),
            // Extract basic info from fiber root
            rootTag: root?.tag,
            current: root?.current ? {
              type: root.current.type?.name || root.current.type,
              memoizedState: root.current.memoizedState,
              child: !!root.current.child
            } : null
          }
        }, '*')

        return originalOnCommitFiberRoot?.call(this, id, root, ...args)
      }

      console.log('React DevTools hook installed')
    }
  }

  // Zustand store hooks
  function setupZustandHooks() {
    // Hook into Zustand's create function if available
    if (window.zustand?.create) {
      const originalCreate = window.zustand.create
      
      window.zustand.create = function(createState, ...args) {
        const store = originalCreate.call(this, createState, ...args)
        
        // Wrap the store to track changes
        const originalSubscribe = store.subscribe
        store.subscribe = function(listener, selector, equalityFn) {
          return originalSubscribe.call(this, function(state, prevState) {
            // Send state change to content script
            window.postMessage({
              source: 'curupira-page',
              type: 'zustand.change',
              data: {
                state: JSON.parse(JSON.stringify(state)),
                prevState: JSON.parse(JSON.stringify(prevState)),
                timestamp: Date.now()
              }
            }, '*')

            return listener(state, prevState)
          }, selector, equalityFn)
        }

        return store
      }

      console.log('Zustand hooks installed')
    }
  }

  // Apollo Client hooks
  function setupApolloHooks() {
    // Look for Apollo Client in various locations
    const apolloClient = window.__APOLLO_CLIENT__ || 
                        window.apolloClient ||
                        (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner?.current?.apolloClient)

    if (apolloClient && apolloClient.cache) {
      const cache = apolloClient.cache
      
      // Hook into cache write operations
      if (cache.write) {
        const originalWrite = cache.write
        cache.write = function(writeOptions, ...args) {
          const result = originalWrite.call(this, writeOptions, ...args)
          
          // Send cache update to content script
          window.postMessage({
            source: 'curupira-page',
            type: 'apollo.write',
            data: {
              dataId: writeOptions.dataId,
              result: writeOptions.result,
              timestamp: Date.now()
            }
          }, '*')

          return result
        }
      }

      console.log('Apollo Client hooks installed')
    }
  }

  // DOM mutation observer
  function setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      const significantMutations = mutations.filter(mutation => {
        // Filter out insignificant mutations
        return mutation.type === 'childList' && 
               mutation.addedNodes.length > 0 &&
               Array.from(mutation.addedNodes).some(node => 
                 node.nodeType === Node.ELEMENT_NODE
               )
      })

      if (significantMutations.length > 0) {
        window.postMessage({
          source: 'curupira-page',
          type: 'dom.mutation',
          data: {
            count: significantMutations.length,
            timestamp: Date.now()
          }
        }, '*')
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    })

    console.log('DOM observer installed')
  }

  // Performance observer
  function setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        
        entries.forEach(entry => {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            window.postMessage({
              source: 'curupira-page',
              type: 'performance.entry',
              data: {
                name: entry.name,
                entryType: entry.entryType,
                startTime: entry.startTime,
                duration: entry.duration,
                timestamp: Date.now()
              }
            }, '*')
          }
        })
      })

      try {
        observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] })
        console.log('Performance observer installed')
      } catch (e) {
        console.warn('Performance observer failed:', e)
      }
    }
  }

  // Error tracking
  function setupErrorTracking() {
    const originalError = window.onerror
    window.onerror = function(message, filename, lineno, colno, error) {
      window.postMessage({
        source: 'curupira-page',
        type: 'error.js',
        data: {
          message,
          filename,
          lineno,
          colno,
          stack: error?.stack,
          timestamp: Date.now()
        }
      }, '*')

      return originalError?.call(this, message, filename, lineno, colno, error)
    }

    window.addEventListener('unhandledrejection', (event) => {
      window.postMessage({
        source: 'curupira-page',
        type: 'error.promise',
        data: {
          reason: event.reason,
          timestamp: Date.now()
        }
      }, '*')
    })

    console.log('Error tracking installed')
  }

  // Initialize hooks
  function initializeHooks() {
    // Wait a bit for libraries to load
    setTimeout(() => {
      setupReactHooks()
      setupZustandHooks()
      setupApolloHooks()
      setupDOMObserver()
      setupPerformanceObserver()
      setupErrorTracking()

      // Notify that hooks are ready
      window.postMessage({
        source: 'curupira-page',
        type: 'hooks.ready',
        data: {
          timestamp: Date.now(),
          features: {
            react: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            zustand: !!window.zustand,
            apollo: !!(window.__APOLLO_CLIENT__ || window.apolloClient)
          }
        }
      }, '*')
    }, 100)
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHooks)
  } else {
    initializeHooks()
  }

  // Expose utilities for external access
  window.__CURUPIRA_INJECTED__ = {
    version: '1.0.0',
    setupReactHooks,
    setupZustandHooks,
    setupApolloHooks
  }

})();