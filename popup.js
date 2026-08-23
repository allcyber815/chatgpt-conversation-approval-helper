(() => {
  'use strict';

  const toggle = document.getElementById('enabled');
  const status = document.getElementById('status');

  const render = (enabled) => {
    toggle.checked = enabled;
    status.textContent = enabled ? 'ON - 자동 승인 활성화' : 'OFF - 자동 승인 중지';
  };

  chrome.storage.local.get({ enabled: false }).then(({ enabled }) => {
    render(enabled === true);
  });

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    await chrome.storage.local.set({ enabled });
    render(enabled);
  });
})();
