(() => {
  'use strict';
  const host = document.getElementById('vdOnlinePresence');
  const count = document.getElementById('vdOnlineCount');
  const toggle = document.getElementById('vdOnlineToggle');
  const panel = document.getElementById('vdOnlinePanel');
  const close = document.getElementById('vdOnlineClose');
  const list = document.getElementById('vdOnlineList');
  if (!host || !count || !toggle || !panel || !close || !list) return;

  let fetching = false;
  let opened = false;
  const INTERVAL_MS = 25000;
  const request = async (url, method = 'GET') => {
    const response = await fetch(url, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: {Accept: 'application/json'}
    });
    if (!response.ok) throw new Error('PRESENCE_' + response.status);
    return response.json();
  };
  function setStatus(number, isError = false) {
    host.classList.toggle('is-error', isError);
    host.classList.toggle('is-live', !isError);
    count.textContent = Number.isFinite(number) ? String(Math.max(0, number)) : '—';
  }
  function populate(users) {
    list.replaceChildren();
    if (!Array.isArray(users) || users.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'vd-online-empty';
      empty.textContent = 'لا يوجد مستخدمون متصلون الآن';
      list.append(empty);
      return;
    }
    for (const user of users) {
      const item = document.createElement('li');
      const bullet = document.createElement('span');
      bullet.className = 'vd-online-item-dot';
      bullet.setAttribute('aria-hidden', 'true');
      const detail = document.createElement('span');
      detail.className = 'vd-online-item-info';
      const name = document.createElement('b');
      name.textContent = String(user.name || 'مستخدم');
      const role = document.createElement('small');
      role.textContent = String(user.role || 'متصل الآن');
      detail.append(name, role);
      item.append(bullet, detail);
      list.append(item);
    }
  }
  function positionPanel() {
    const rect = host.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    panel.style.width = width + 'px';
    panel.style.left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left)) + 'px';
    const height = panel.getBoundingClientRect().height;
    const above = rect.top - height - 8;
    panel.style.top = (above >= 8 ? above : Math.min(window.innerHeight - height - 8, rect.bottom + 8)) + 'px';
  }
  async function refresh(includeList = false) {
    if (fetching || document.visibilityState === 'hidden') return;
    fetching = true;
    try {
      const data = await request(includeList ? '/api/presence' : '/api/presence/heartbeat', includeList ? 'GET' : 'POST');
      setStatus(Number(data.count));
      if (includeList && opened) populate(data.users);
    } catch (_) {
      setStatus(NaN, true);
      if (includeList && opened) {
        populate([]);
        const item = list.firstElementChild;
        if (item) item.textContent = 'تعذر تحديث قائمة المتصلين حاليًا';
      }
    } finally {
      fetching = false;
    }
  }
  function dismiss() {
    opened = false;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', async event => {
    event.stopPropagation();
    if (opened) return dismiss();
    opened = true;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    positionPanel();
    await refresh(true);
    if (opened) positionPanel();
  });
  close.addEventListener('click', dismiss);
  document.addEventListener('pointerdown', event => {
    if (opened && !panel.contains(event.target) && !host.contains(event.target)) dismiss();
  });
  document.addEventListener('keydown', event => {
    if (opened && event.key === 'Escape') dismiss();
  });
  window.addEventListener('resize', () => { if (opened) positionPanel(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(opened); });
  window.addEventListener('focus', () => refresh(opened));
  window.addEventListener('online', () => refresh(opened));
  refresh();
  setInterval(() => refresh(opened), INTERVAL_MS);
})();
