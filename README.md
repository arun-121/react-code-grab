# React Code Grab Extension

Chrome extension that behaves like a lightweight Locator.js for React apps:

- click the extension icon to arm inspect mode on the current tab
- click an element on the page
- the extension walks the React Fiber tree for that DOM node
- it shows the nearest component name and source location when React exposes it
- optionally, it asks a local bridge process to open the file in your editor

## Project layout

- `extension/manifest.json`: MV3 manifest
- `extension/background.js`: toggles inspect mode and forwards open requests
- `extension/content.js`: hover/click inspector UI in the page
- `extension/page-hook.js`: runs in page context and reads React Fiber internals
- `bridge/server.js`: local HTTP server that opens files in your editor

## Install the extension

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `extension/` folder in this repo

## Run the optional editor bridge

```bash
npm run bridge
```

The bridge listens on `http://127.0.0.1:3210/open` and tries `code`, `cursor`, then `webstorm`.

## How to use

1. Open your React app in Chrome in development mode
2. Click the extension action to toggle inspect mode on
3. Hover an element to see the outline
4. Click the element to inspect it
5. If the bridge is running and React exposes source info, the file opens in your editor

## Current limits

- this depends on React development internals, so production builds usually will not expose enough data
- exact source info depends on React including `_debugSource` or an owner fiber that still has it
- the extension can find the nearest React component, but editor opening requires the local bridge
