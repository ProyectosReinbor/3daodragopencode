export function adminHostRouting({ adminHost, publicHost, production }) {
  return (req, res, next) => {
    const host = req.hostname.toLowerCase();
    const isAdmin = host === adminHost;
    const isAdminPath = req.path === '/admin' || req.path === '/crud-ui.js' || req.path === '/theme.css' || req.path === '/admin-management-ui.js' || req.path === '/api/admin' || req.path.startsWith('/api/admin/');
    if (production && host !== adminHost && isAdminPath)
      return res.status(404).json({ error: 'Not found' });
    if (isAdmin && req.path === '/') return next();
    if (isAdmin && !isAdminPath)
      return res.status(404).json({ error: 'Not found' });
    next();
  };
}
