(() => {
  'use strict';

  const ENGLISH_CONVERSATION_LABEL_RE = /^Allow\s+(.+?)\s+for this conversation$/i;
  const CONVERSATION_SCOPE_RE = /(?:\bthis\s+(?:conversation|chat)\b|(?:이|현재)\s*(?:대화|채팅))/i;
  const ALLOW_LABEL_RE = /(?:\ballow\b|허용)/i;
  const NEGATIVE_ALLOW_LABEL_RE = /(?:\bdeny\b|\bdisallow\b|\bnot\s+allow\b|\bdon['’]t\s+allow\b|거절|허용하지|허용\s*안\s*함|차단|취소)/i;
  const KOREAN_APPROVAL_RE = /ChatGPT가\s+(.+?)(?:을\(를\)|을|를)\s+사용하도록\s+허용할까요\?/;
  const DEFAULT_ENABLED = false;

  let enabled = false;
  let scanQueued = false;
  let scanRunning = false;

  const openedTriggers = new WeakSet();
  const clickedMenuItems = new WeakSet();

  const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

  const labelledByText = (element) => {
    const ids = normalize(element.getAttribute?.('aria-labelledby'));
    if (!ids) return '';
    return normalize(ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' '));
  };

  const accessibleLabel = (element) => normalize(
    element.getAttribute?.('aria-label') ||
    labelledByText(element) ||
    element.getAttribute?.('title') ||
    element.textContent
  );

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const parseConversationLabel = (element) => {
    const label = accessibleLabel(element);
    const exactMatch = ENGLISH_CONVERSATION_LABEL_RE.exec(label);
    if (exactMatch) return { label, appName: normalize(exactMatch[1]) };

    if (!label || NEGATIVE_ALLOW_LABEL_RE.test(label)) return null;
    if (!CONVERSATION_SCOPE_RE.test(label) || !ALLOW_LABEL_RE.test(label)) return null;

    return { label, appName: '' };
  };

  const findConversationMenuItems = () => {
    const results = [];
    const selector = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element) || clickedMenuItems.has(element)) continue;
      const parsed = parseConversationLabel(element);
      if (!parsed) continue;
      results.push({ element, ...parsed });
    }

    return results;
  };

  const findLabelledConversationTriggers = () => {
    const results = [];

    for (const button of document.querySelectorAll('button')) {
      if (!isVisible(button) || button.disabled || openedTriggers.has(button)) continue;
      const parsed = parseConversationLabel(button);
      if (!parsed) continue;
      results.push({ element: button, ...parsed, source: 'accessible-name' });
    }

    return results;
  };

  const findStructuralConversationTriggers = () => {
    const results = [];

    for (const allowButton of document.querySelectorAll('button')) {
      if (!isVisible(allowButton) || allowButton.disabled) continue;
      if (normalize(allowButton.textContent) !== '허용하기') continue;

      let card = allowButton.parentElement;
      for (let depth = 0; card && depth < 8; depth += 1, card = card.parentElement) {
        const cardText = normalize(card.textContent);
        const question = KOREAN_APPROVAL_RE.exec(cardText);
        if (!question) continue;

        const buttons = [...card.querySelectorAll('button')].filter(isVisible);
        const rejectButton = buttons.find((button) => normalize(button.textContent) === '거절하기');
        if (!rejectButton) continue;

        const allowRect = allowButton.getBoundingClientRect();
        const allowCenterY = allowRect.top + allowRect.height / 2;

        const eligibleButtons = buttons.filter((button) =>
          button !== allowButton &&
          button !== rejectButton &&
          !button.disabled &&
          !openedTriggers.has(button)
        );

        let candidates = eligibleButtons.filter((button) =>
          button.getAttribute('aria-haspopup') === 'menu' || button.hasAttribute('aria-expanded')
        );

        if (candidates.length !== 1) {
          candidates = eligibleButtons.filter((button) => {
            const rect = button.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const horizontallyAdjacent = rect.left >= allowRect.right - 6 && rect.left <= allowRect.right + 18;
            const verticallyAligned = Math.abs(centerY - allowCenterY) <= 10;
            const compact = rect.width > 0 && rect.width <= 48 && rect.height <= Math.max(52, allowRect.height + 12);
            const menuish = normalize(button.textContent) === '' || Boolean(parseConversationLabel(button));

            return horizontallyAdjacent && verticallyAligned && compact && menuish;
          });
        }

        if (candidates.length === 1) {
          results.push({
            element: candidates[0],
            appName: normalize(question[1]),
            label: accessibleLabel(candidates[0]),
            source: 'approval-card-geometry'
          });
        }

        break;
      }
    }

    return results;
  };

  const findConversationTriggers = () => {
    const labelled = findLabelledConversationTriggers();
    if (labelled.length > 0) return labelled;
    return findStructuralConversationTriggers();
  };

  const clickMenuItem = (element) => {
    element.click();
  };

  const openSplitMenuTrigger = (element) => {
    const rect = element.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };

    try {
      element.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    } catch {
      // Older Chromium contexts may not expose PointerEvent to extension isolated worlds.
    }

    element.dispatchEvent(new MouseEvent('mousedown', init));

    try {
      element.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    } catch {
      // Fall through to mouse events.
    }

    element.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
  };

  const scanAndApprove = () => {
    if (!enabled || scanRunning) return;
    scanRunning = true;

    try {
      const menuItems = findConversationMenuItems();
      if (menuItems.length === 1) {
        const { element, appName } = menuItems[0];
        clickedMenuItems.add(element);
        console.info(`[ChatGPT Approval Helper] approving conversation-level consent for: ${appName}`);
        clickMenuItem(element);
        return;
      }

      if (menuItems.length > 1) return;

      const triggers = findConversationTriggers();
      if (triggers.length !== 1) return;

      const { element, appName, source } = triggers[0];
      openedTriggers.add(element);
      console.info(`[ChatGPT Approval Helper] opening conversation-level consent menu for: ${appName} (${source})`);
      openSplitMenuTrigger(element);
      // A one-shot next-frame scan covers menus rendered after the click even if the
      // insertion itself has no immediately recognizable text. DOM mutations remain
      // the primary trigger; this is not polling.
      requestAnimationFrame(() => requestScan());
    } finally {
      scanRunning = false;
    }
  };

  const requestScan = () => {
    if (!enabled || scanQueued) return;
    scanQueued = true;

    queueMicrotask(() => {
      scanQueued = false;
      scanAndApprove();
    });
  };

  const nodeLooksRelevant = (node) => {
    const element = node instanceof Element ? node : node?.parentElement;
    if (!(element instanceof Element)) return false;

    if (parseConversationLabel(element)) return true;

    const text = normalize(element.textContent);
    if (CONVERSATION_SCOPE_RE.test(text) && ALLOW_LABEL_RE.test(text) && !NEGATIVE_ALLOW_LABEL_RE.test(text)) return true;
    if (text.includes('사용하도록 허용할까요?')) return true;
    if (text === '허용하기' || text === '거절하기') return true;

    for (const candidate of element.querySelectorAll?.('button, [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]') || []) {
      if (parseConversationLabel(candidate)) return true;
    }

    return false;
  };

  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        if (nodeLooksRelevant(mutation.target)) {
          requestScan();
          return;
        }
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (nodeLooksRelevant(node)) {
          requestScan();
          return;
        }
      }
    }
  });

  const applyEnabled = (value) => {
    enabled = value === true;
    scanQueued = false;

    if (enabled) requestScan();
    console.info(`[ChatGPT Approval Helper] ${enabled ? 'enabled' : 'disabled'}`);
  };

  const start = async () => {
    // Observe first so an approval card/menu that changes while storage is being read
    // cannot fall into a gap between initial scan and observer registration.
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'aria-label',
        'aria-labelledby',
        'aria-haspopup',
        'aria-expanded',
        'aria-hidden',
        'data-state',
        'title',
        'disabled',
        'hidden',
        'role',
        'style'
      ]
    });

    try {
      const stored = await chrome.storage.local.get({ enabled: DEFAULT_ENABLED });
      applyEnabled(stored.enabled);
    } catch {
      applyEnabled(DEFAULT_ENABLED);
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes.enabled) return;
      applyEnabled(changes.enabled.newValue);
    });
  };

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
