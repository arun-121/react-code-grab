const HOOK_ID = 'react-code-grab-hook';
const MARKER_ATTR = 'data-react-code-grab-target';
const OVERLAY_ID = 'react-code-grab-overlay';
const TOOLTIP_ID = 'react-code-grab-tooltip';

let inspectEnabled = false;
let currentTarget = null;
let pendingRequestId = 0;

function injectPageHook() {
  if (document.getElementById(HOOK_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = HOOK_ID;
  script.src = chrome.runtime.getURL('page-hook.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '2147483646';
    overlay.style.border = '2px solid #ea580c';
    overlay.style.background = 'rgba(251, 146, 60, 0.12)';
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'none';
    overlay.style.borderRadius = '6px';
    document.documentElement.appendChild(overlay);
  }

  let tooltip = document.getElementById(TOOLTIP_ID);
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '2147483647';
    tooltip.style.background = '#111827';
    tooltip.style.color = '#f9fafb';
    tooltip.style.padding = '6px 10px';
    tooltip.style.borderRadius = '999px';
    tooltip.style.font = '12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    tooltip.style.maxWidth = 'min(80vw, 640px)';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.overflow = 'hidden';
    tooltip.style.textOverflow = 'ellipsis';
    document.documentElement.appendChild(tooltip);
  }
}

function hideOverlay() {
  document.getElementById(OVERLAY_ID)?.style.setProperty('display', 'none');
  document.getElementById(TOOLTIP_ID)?.style.setProperty('display', 'none');
}

function updateOverlay(target, label = 'React Code Grab') {
  ensureOverlay();
  const overlay = document.getElementById(OVERLAY_ID);
  const tooltip = document.getElementById(TOOLTIP_ID);
  const rect = target.getBoundingClientRect();

  overlay.style.display = 'block';
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  tooltip.style.display = 'block';
  tooltip.textContent = label;
  tooltip.style.top = `${Math.max(8, rect.top + window.scrollY - 32)}px`;
  tooltip.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
}

function isValidInspectTarget(node) {
  return (
    node instanceof HTMLElement &&
    node.id !== OVERLAY_ID &&
    node.id !== TOOLTIP_ID &&
    node.id !== HOOK_ID
  );
}

function setCurrentTarget(target) {
  if (!isValidInspectTarget(target)) {
    currentTarget = null;
    hideOverlay();
    return;
  }

  currentTarget = target;
  updateOverlay(target);
}

function clearMarker() {
  document.querySelector(`[${MARKER_ATTR}]`)?.removeAttribute(MARKER_ATTR);
}

function requestFiberDetails(target) {
  pendingRequestId += 1;
  const requestId = pendingRequestId;

  clearMarker();
  target.setAttribute(MARKER_ATTR, String(requestId));

  window.postMessage(
    {
      source: 'react-code-grab-content',
      type: 'RCG_RESOLVE_TARGET',
      requestId
    },
    '*'
  );
}

function formatLabel(payload) {
  if (!payload) {
    return 'React component not found';
  }

  if (payload.source?.file) {
    return `${payload.componentName || 'Component'}  ${payload.source.file}:${payload.source.line || 1}`;
  }

  if (payload.componentName) {
    return `${payload.componentName}  source unavailable`;
  }

  return 'React component not found';
}

async function openSource(payload) {
  if (!payload?.source?.file) {
    return {
      ok: false,
      error: 'No source file found on the selected React fiber.'
    };
  }

  return chrome.runtime.sendMessage({
    type: 'RCG_OPEN_SOURCE',
    payload: {
      file: payload.source.file,
      line: payload.source.line || 1,
      column: payload.source.column || 1,
      componentName: payload.componentName || null
    }
  });
}

function handleInspectClick(event) {
  if (!inspectEnabled || !isValidInspectTarget(event.target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  setCurrentTarget(event.target);
  requestFiberDetails(event.target);
}

function handlePointerMove(event) {
  if (!inspectEnabled) {
    return;
  }

  if (isValidInspectTarget(event.target)) {
    setCurrentTarget(event.target);
  } else {
    hideOverlay();
  }
}

function setInspectMode(enabled) {
  inspectEnabled = enabled;
  document.documentElement.style.cursor = enabled ? 'crosshair' : '';

  if (!enabled) {
    currentTarget = null;
    clearMarker();
    hideOverlay();
  }
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) {
    return;
  }

  const message = event.data;
  if (message?.source !== 'react-code-grab-page' || message.type !== 'RCG_TARGET_RESOLVED') {
    return;
  }

  if (message.requestId !== pendingRequestId) {
    return;
  }

  const payload = message.payload;
  if (currentTarget) {
    updateOverlay(currentTarget, formatLabel(payload));
  }

  if (!payload) {
    return;
  }

  const result = await openSource(payload);
  if (!result?.ok) {
    const reason = result?.error || result?.data?.error || 'Bridge unavailable';
    if (currentTarget) {
      updateOverlay(currentTarget, `${formatLabel(payload)}  ${reason}`);
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'RCG_TOGGLE_INSPECT') {
    setInspectMode(Boolean(message.enabled));
  }
});

document.addEventListener('mousemove', handlePointerMove, true);
document.addEventListener('click', handleInspectClick, true);
injectPageHook();
