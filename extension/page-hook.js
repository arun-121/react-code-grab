(function installReactCodeGrabHook() {
  const MARKER_ATTR = 'data-react-code-grab-target';

  function getFiberKey(element) {
    const key = Object.keys(element).find(
      (candidate) =>
        candidate.startsWith('__reactFiber$') || candidate.startsWith('__reactInternalInstance$')
    );
    return key || null;
  }

  function getReactFiber(element) {
    const key = getFiberKey(element);
    return key ? element[key] : null;
  }

  function fiberName(fiber) {
    const type = fiber?.type;
    if (typeof type === 'string') {
      return type;
    }

    return (
      type?.displayName ||
      type?.name ||
      fiber?.elementType?.displayName ||
      fiber?.elementType?.name ||
      fiber?._debugOwner?.elementType?.displayName ||
      fiber?._debugOwner?.elementType?.name ||
      null
    );
  }

  function normalizeSource(source) {
    if (!source?.fileName && !source?.file) {
      return null;
    }

    return {
      file: source.fileName || source.file,
      line: source.lineNumber || source.line || 1,
      column: source.columnNumber || source.column || 1
    };
  }

  function collectOwners(fiber) {
    const owners = [];
    let node = fiber;

    while (node) {
      owners.push(node);
      node = node._debugOwner || node.return || null;
    }

    return owners;
  }

  function resolveFiberDetails(element) {
    const fiber = getReactFiber(element);
    if (!fiber) {
      return null;
    }

    const owners = collectOwners(fiber);
    const bestWithSource = owners.find((owner) => normalizeSource(owner._debugSource));
    const bestNamed = owners.find((owner) => fiberName(owner) && typeof owner.type !== 'string');
    const selected = bestWithSource || bestNamed || fiber;

    return {
      componentName: fiberName(selected),
      source: normalizeSource(selected._debugSource),
      chain: owners
        .map((owner) => fiberName(owner))
        .filter(Boolean)
        .filter((name, index, array) => array.indexOf(name) === index)
    };
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return;
    }

    const message = event.data;
    if (message?.source !== 'react-code-grab-content' || message.type !== 'RCG_RESOLVE_TARGET') {
      return;
    }

    const target = document.querySelector(`[${MARKER_ATTR}="${message.requestId}"]`);
    const payload = target ? resolveFiberDetails(target) : null;

    window.postMessage(
      {
        source: 'react-code-grab-page',
        type: 'RCG_TARGET_RESOLVED',
        requestId: message.requestId,
        payload
      },
      '*'
    );
  });
})();
