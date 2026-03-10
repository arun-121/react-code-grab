const inspectorState = new Map();

function setBadge(tabId, enabled) {
  chrome.action.setBadgeText({ tabId, text: enabled ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: enabled ? '#C2410C' : '#000000' });
}

async function sendToggle(tabId, enabled) {
  await chrome.tabs.sendMessage(tabId, {
    type: 'RCG_TOGGLE_INSPECT',
    enabled
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  const nextEnabled = !inspectorState.get(tab.id);
  inspectorState.set(tab.id, nextEnabled);
  setBadge(tab.id, nextEnabled);

  try {
    await sendToggle(tab.id, nextEnabled);
  } catch (error) {
    console.warn('React Code Grab failed to reach content script', error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  inspectorState.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RCG_OPEN_SOURCE') {
    fetch('http://127.0.0.1:3210/open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message.payload)
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        sendResponse({
          ok: response.ok,
          status: response.status,
          data
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message?.type === 'RCG_DISABLE_TAB' && sender.tab?.id) {
    inspectorState.set(sender.tab.id, false);
    setBadge(sender.tab.id, false);
  }

  return false;
});
