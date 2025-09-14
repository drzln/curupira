# Curupira Chrome Extension - Chrome Web Store Listing

## Extension Details

**Name:** Curupira - MCP Debugger
**Version:** 1.0.0
**Category:** Developer Tools

## Short Description (132 characters max)
AI-powered debugging assistant for React applications using Model Context Protocol (MCP)

## Detailed Description

Curupira is a powerful debugging tool that bridges your React application with AI assistants through the Model Context Protocol (MCP). It provides real-time insights into your application's state, performance, and behavior.

### Key Features:
- **Real-time Console Monitoring**: Capture and analyze console logs, warnings, and errors
- **Network Request Tracking**: Monitor API calls, responses, and performance metrics
- **React Component Inspection**: Track component renders and state changes
- **State Management Integration**: Support for Zustand and Apollo Client
- **AI-Powered Analysis**: Connect to AI assistants for intelligent debugging assistance
- **Performance Metrics**: Monitor rendering performance and identify bottlenecks

### How it Works:
1. Install the extension
2. Connect to your local MCP server (running on localhost:3000)
3. The extension will automatically start capturing debugging information
4. Use your AI assistant to analyze and debug issues in real-time

### Perfect for:
- React developers looking for advanced debugging capabilities
- Teams using AI assistants for development
- Anyone wanting deeper insights into their application's runtime behavior

## Permission Justifications

### Required Permissions:

1. **debugger**: Required to access Chrome DevTools debugging APIs for component inspection and performance monitoring

2. **tabs**: Needed to communicate between the extension popup, content scripts, and devtools panels across different tabs

3. **storage**: Used to persist user preferences, connection settings, and debugging session data

4. **webNavigation**: Required to detect page navigation events and properly initialize debugging on new pages

5. **scripting**: Necessary to inject content scripts that monitor console logs and network requests

### Host Permissions:

- **localhost**: Required for local development - most React applications run on localhost during development
- **Custom domains**: The extension includes some specific domains for internal testing. Users can configure additional domains as needed.

## Privacy Policy

Curupira does not collect, store, or transmit any personal data. All debugging information is processed locally and only sent to the MCP server you explicitly connect to (typically running on your local machine).

### Data Handling:
- Console logs are captured and sent only to your configured MCP server
- Network requests are monitored for debugging purposes only
- No data is sent to external servers
- All data is processed in real-time and not permanently stored by the extension

## Support

For issues, feature requests, or questions:
- GitHub: https://github.com/drzln/curupira
- Documentation: https://github.com/drzln/curupira#readme

## Screenshots Needed

1. **Main screenshot (1280x800)**: Show the extension popup with connection status
2. **Screenshot 2 (1280x800)**: Show the DevTools panel with debugging information
3. **Screenshot 3 (640x400)**: Show console log capture in action
4. **Screenshot 4 (640x400)**: Show network request monitoring
5. **Screenshot 5 (640x400)**: Show the extension icon in the toolbar

## Additional Assets

- **Small Promotional Tile (440x280)**: Extension logo with tagline
- **Marquee Promotional Tile (1400x560)**: Feature showcase banner

## Version History

### v1.0.0 (Current)
- Initial release
- Console log monitoring
- Network request tracking
- Basic React debugging support
- MCP protocol integration