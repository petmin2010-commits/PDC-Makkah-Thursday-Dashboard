'use strict';
// Presence is scoped to this dashboard service and never exposes session identifiers.
module.exports = function installOnlinePresence(app, requireAuth) {
  const sessions = new Map();
  const TTL_MS = 90 * 1000;
  function prune(now = Date.now()) {
    for (const [sid, item] of sessions) {
      if (now - item.seenAt > TTL_MS) sessions.delete(sid);
    }
  }
  function touch(req) {
    const u = req.session && req.session.user;
    const email = String(u && u.email || '').trim().toLowerCase();
    if (!email || !req.sessionID) return;
    sessions.set(req.sessionID, {
      email,
      name: String(u.name || email).trim(),
      role: String(u.role || '').trim(),
      seenAt: Date.now()
    });
  }
  function snapshot() {
    prune();
    // Same signed-in person with multiple tabs/devices is counted once.
    const byUser = new Map();
    for (const entry of sessions.values()) {
      const previous = byUser.get(entry.email);
      if (!previous || previous.seenAt < entry.seenAt) byUser.set(entry.email, entry);
    }
    const users = Array.from(byUser.values())
      .sort((a, b) => b.seenAt - a.seenAt || a.name.localeCompare(b.name, 'ar'))
      .map(({name, role, seenAt}) => ({name, role, lastSeen: new Date(seenAt).toISOString()}));
    return {count: users.length, users, updatedAt: new Date().toISOString()};
  }
  function remove(req) {
    if (req.sessionID) sessions.delete(req.sessionID);
  }
  app.post('/api/presence/heartbeat', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store, max-age=0');
    touch(req);
    const state = snapshot();
    return res.json({ok: true, count: state.count, updatedAt: state.updatedAt});
  });
  app.get('/api/presence', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store, max-age=0');
    touch(req);
    return res.json({ok: true, ...snapshot()});
  });
  return {remove, snapshot};
};
