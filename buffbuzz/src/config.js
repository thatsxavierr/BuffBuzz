// Single place for API base. No trailing slash. Must match production server (e.g. Railway URL).
// Vercel: set REACT_APP_API_URL at build time and redeploy after changing it.
export const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
