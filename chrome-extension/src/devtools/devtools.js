// DevTools entry point
chrome.devtools.panels.create(
  'Curupira',
  'icons/icon-48.png',
  'src/devtools/panel.html',
  (panel) => {
    console.log('Curupira DevTools panel created')
    
    // Listen for panel shown/hidden events
    panel.onShown.addListener(() => {
      console.log('Curupira panel shown')
      // Initialize panel communication
      panel.postMessage({ type: 'PANEL_SHOWN' })
    })

    panel.onHidden.addListener(() => {
      console.log('Curupira panel hidden')
      panel.postMessage({ type: 'PANEL_HIDDEN' })
    })
  }
)