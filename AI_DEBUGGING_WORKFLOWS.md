# AI-Enhanced React Debugging Workflows

Complete guide for AI assistants to effectively debug React applications using Curupira MCP tools.

## 🎯 Core Debugging Principles for AI

### 1. **Progressive Discovery**
Always start broad, then narrow down:
1. `chrome_discover_instances` → Find available Chrome instances
2. `chrome_connect` → Connect to React application
3. `react_get_component_tree` → Understand application structure
4. `react_inspect_component` → Examine specific components
5. `react_analyze_rerenders` → Identify performance issues

### 2. **Evidence-Based Debugging**
Collect data before suggesting solutions:
- Capture snapshots before making changes
- Monitor re-render patterns
- Inspect actual state vs expected state
- Analyze hook dependencies

### 3. **AI-Friendly Error Handling**
All tools provide:
- Clear error messages with context
- Actionable recommendations
- Next step suggestions
- Alternative approaches

## 🔄 Standard Debugging Workflows

### Workflow 1: Component Not Updating
**User Problem:** "My UserProfile component isn't updating when I change the user data"

**AI Steps:**
```
1. "Let me connect to your React app and examine the UserProfile component"
   → chrome_discover_instances
   → chrome_connect (with detected React instance)

2. "I'll analyze the component structure and state"
   → react_get_component_tree
   → react_inspect_component (componentSelector: "UserProfile")

3. "Let me monitor re-renders to see if the component is updating"
   → react_analyze_rerenders (componentSelector: "UserProfile", duration: 10000)

4. "I'll examine the hooks to check state management"
   → react_inspect_hooks (componentSelector: "UserProfile")

5. Based on findings:
   - If no re-renders: "The component isn't re-rendering. Check if state updates are triggering properly."
   - If excessive re-renders: "The component is re-rendering too much. Let's optimize."
   - If hooks issues: "Found hook dependency issues that prevent updates."
```

### Workflow 2: Performance Issues
**User Problem:** "My ProductList component is very slow"

**AI Steps:**
```
1. "I'll analyze render performance for ProductList"
   → chrome_connect
   → react_analyze_rerenders (componentSelector: "ProductList", duration: 15000)

2. "Let me examine the component structure for performance bottlenecks"
   → react_get_component_tree (maxDepth: 15)
   → react_inspect_component (componentSelector: "ProductList", includeProps: true)

3. "I'll check hooks for optimization opportunities"
   → react_inspect_hooks (componentSelector: "ProductList")

4. "Let me capture a performance snapshot for comparison"
   → react_capture_state_snapshot (snapshotName: "before_optimization")

5. Provide optimization recommendations based on findings:
   - Excessive re-renders → Suggest React.memo()
   - Missing dependencies → Fix useEffect deps
   - Heavy computations → Suggest useMemo/useCallback
```

### Workflow 3: State Management Debugging
**User Problem:** "My shopping cart state isn't syncing between components"

**AI Steps:**
```
1. "I'll examine the cart state across all components"
   → chrome_connect
   → react_get_component_tree

2. "Let me inspect components that use cart state"
   → react_find_component (componentName: "cart")
   → react_inspect_component (componentSelector: "ShoppingCart")
   → react_inspect_component (componentSelector: "CartItem")

3. "I'll monitor state changes during cart operations"
   → react_capture_state_snapshot (snapshotName: "cart_before")
   → [User performs cart action]
   → react_capture_state_snapshot (snapshotName: "cart_after")

4. "Let me analyze re-render patterns for cart components"
   → react_analyze_rerenders (duration: 10000, includeProps: true)

5. Diagnose based on state snapshots and render patterns
```

### Workflow 4: Hook Dependency Issues
**User Problem:** "My useEffect hook is causing infinite re-renders"

**AI Steps:**
```
1. "I'll examine the problematic component's hooks"
   → chrome_connect
   → react_find_component (componentName: [user-provided])
   → react_inspect_hooks (componentSelector: [component], hookTypes: ["useEffect", "useState"])

2. "Let me monitor the re-render pattern"
   → react_analyze_rerenders (componentSelector: [component], duration: 5000)

3. "I'll capture the current state to analyze dependencies"
   → react_inspect_component (componentSelector: [component], includeHooks: true)

4. Analyze findings:
   - Empty dependency arrays → "useEffect runs on every render"
   - Missing dependencies → "Dependencies are incomplete"
   - Object/function dependencies → "Dependencies change on every render"
```

## 📚 AI Prompting Best Practices

### Effective User Prompts

**✅ Good prompts that help AI help you:**
```
"My UserCard component re-renders every time I scroll. Can you help debug this?"
"The shopping cart count doesn't update when I add items. What's wrong?"
"My React app is slow when filtering a large product list. How can I optimize it?"
"I'm getting an infinite loop error in useEffect. Can you find the issue?"
```

**❌ Prompts that need more context:**
```
"My app is broken" → Need: Which component? What behavior?
"Fix my React code" → Need: Specific issue or error
"It's not working" → Need: Expected vs actual behavior
```

### AI Response Patterns

**Discovery Phase:**
```
"I'll help you debug the [specific issue]. Let me start by connecting to your React app and examining the component structure."

1. Connecting to Chrome...
2. Getting React component tree...
3. Found your [component] - examining it now...
```

**Analysis Phase:**
```
"I found the issue! Your [component] is [specific problem]. Here's what I discovered:

📊 Analysis Results:
- Re-renders: [number] times in [duration]
- Hook issues: [specific problems]
- Performance impact: [assessment]

🎯 Root Cause:
[Clear explanation of the problem]
```

**Solution Phase:**
```
"Here's how to fix this:

💡 Recommended Solution:
[Specific code changes or patterns]

🔍 Why this works:
[Explanation of the fix]

✅ Verification:
[How to test the fix worked]
```

## 🛠️ Tool-Specific AI Guidance

### react_get_component_tree
**When to use:** Always first, to understand app structure
**AI prompts:** 
- "Show me the React component hierarchy"
- "What components are in this app?"
- "I need to understand the component structure"

**AI should look for:**
- Components with `hasState: true` (stateful debugging targets)
- Deep nesting (potential performance issues)
- Unusual component names (debugging clues)

### react_inspect_component
**When to use:** After identifying specific components
**AI prompts:**
- "Examine the UserProfile component details"
- "What's the current state of my Cart component?"
- "Show me the props being passed to ProductList"

**AI should analyze:**
- Prop changes that might cause issues
- State structure and values
- Hook usage patterns

### react_analyze_rerenders
**When to use:** For performance issues or unexpected updates
**AI prompts:**
- "Why does my component keep re-rendering?"
- "Check if ProductList is rendering too much"
- "Monitor re-renders while I interact with the app"

**AI should interpret:**
- Render frequency (normal vs excessive)
- Timing patterns (clustered vs distributed)
- Component-specific vs global issues

### react_inspect_hooks
**When to use:** For hook-related debugging
**AI prompts:**
- "Check the hooks in my UserForm component"
- "Why is my useEffect causing infinite loops?"
- "Analyze useState usage in ShoppingCart"

**AI should examine:**
- Hook types and counts
- Dependency arrays
- State vs effect hook balance

### react_capture_state_snapshot / react_restore_snapshot
**When to use:** For time-travel debugging
**AI prompts:**
- "Save the current state before I make changes"
- "Restore the app to the previous working state"
- "Compare state before and after the bug happens"

**AI should use for:**
- Before/after comparisons
- Regression testing
- Complex state debugging

## 🎭 Example AI Debugging Sessions

### Session 1: Complete Performance Debug
```
User: "My product listing page is really slow when I search"

AI: "I'll help you optimize the product listing performance. Let me analyze the search functionality."

[Connects to Chrome and gets component tree]

AI: "I can see you have a ProductList component with SearchBar. Let me monitor re-renders during a search."

[Runs react_analyze_rerenders for 10 seconds while user searches]

AI: "Found the issue! ProductList is re-rendering 47 times during each search. The problem is in the search filter function - it's not memoized. Here's the fix:

```jsx
// Before (problematic):
const filteredProducts = products.filter(p => p.name.includes(searchTerm))

// After (optimized):
const filteredProducts = useMemo(() => 
  products.filter(p => p.name.includes(searchTerm)), 
  [products, searchTerm]
)
```

This will reduce re-renders from 47 to 1 per search."
```

### Session 2: State Sync Issue
```
User: "My cart count in the header doesn't update when I add items"

AI: "I'll trace the cart state flow. Let me examine your cart components."

[Inspects CartContext, CartHeader, and AddToCart components]

AI: "I found the disconnect! Your AddToCart component updates local state but doesn't trigger the CartContext update. The cart header subscribes to CartContext.

The fix is to call `updateCart()` from context instead of local `setCount()`:

```jsx
// Before:
setCount(count + 1)  // Only updates local state

// After:
updateCart(product)  // Updates context, triggers header update
```

Would you like me to monitor the fix to confirm it works?"
```

## 🚀 Advanced AI Workflows

### Multi-Component Analysis
```
1. Get full component tree
2. Find all components using shared state
3. Monitor renders across all components
4. Identify the component causing cascading re-renders
5. Provide targeted optimization
```

### Performance Profiling
```
1. Capture baseline snapshot
2. Monitor during user interaction
3. Identify bottlenecks
4. Suggest specific optimizations
5. Capture optimized snapshot for comparison
```

### State Flow Tracing
```
1. Map all state-holding components
2. Trace data flow between components
3. Identify where state updates break
4. Provide architectural recommendations
```

## 💡 AI Tips for Power Users

### Context Awareness
AI should maintain context about:
- Previously examined components
- Identified patterns or issues
- User's coding style preferences
- Application architecture (Redux, Context, etc.)

### Proactive Suggestions
AI should proactively suggest:
- Related components to examine
- Potential side effects of fixes
- Performance optimization opportunities
- Testing strategies for fixes

### Learning from Patterns
AI should recognize common patterns:
- "This looks like a prop drilling issue"
- "I see a missing dependency pattern"
- "This component structure suggests performance issues"

## 🎯 Success Metrics

### For AI Assistants
- **Time to problem identification:** < 2 minutes
- **Accuracy of root cause:** > 90%
- **Actionable recommendations:** Every response
- **Follow-up questions:** < 3 to get full context

### For Developers
- **Problem resolution time:** 50% faster than manual debugging
- **Learning curve:** Can debug React apps from day 1
- **Confidence in solutions:** High due to evidence-based approach

This workflow guide enables AI assistants to provide expert-level React debugging assistance using Curupira's MCP tools. The key is systematic analysis combined with clear, actionable recommendations.