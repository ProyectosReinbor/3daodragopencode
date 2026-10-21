export function createRateLimit({ limit, windowMs = 60000, clock = Date.now, key = req => req.ip || req.socket?.remoteAddress || 'unknown' }) {
  const entries = new Map();
  let nextSweep = 0;
  return (req, res, next) => {
    const now = clock();
    if (now >= nextSweep) {
      for (const [id, entry] of entries) if (now >= entry.until) entries.delete(id);
      nextSweep = now + windowMs;
    }
    const id = key(req);
    let entry = entries.get(id);
    if (!entry || now >= entry.until) {
      // Do not evict active counters: that would let new identities reset limits.
      if (!entry && entries.size >= 10000) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({error:'Servidor ocupado. Intenta de nuevo en un minuto.'});
      }
      entry = { count: 0, until: now + windowMs };
      entries.set(id, entry);
    }
    if (entry.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.until - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Demasiadas peticiones. Espera antes de reintentar.', retryAfter });
    }
    entry.count++;
    next();
  };
}

export function createApiRateLimits({clock = Date.now} = {}) {
  const general = createRateLimit({limit:100,clock});
  const world = createRateLimit({limit:1200,clock});
  const playerLogin = createRateLimit({limit:10,clock});
  const adminLogin = createRateLimit({limit:10,clock});
  return (req,res,next) => {
    // Mounted at /api: Express exposes the remaining path without its query string.
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    if (path === '/login' || path === '/register') return playerLogin(req,res,next);
    if (path === '/admin/login') return adminLogin(req,res,next);
    if (path === '/world' || path.startsWith('/world/')) return world(req,res,next);
    return general(req,res,next);
  };
}
