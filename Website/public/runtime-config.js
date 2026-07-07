// Runtime configuration — injected during CI/CD deployment
// For local dev: edit this manually
// For production: injected via CI/CD pipeline

window.__DIRECTUS_URL__ = window.__DIRECTUS_URL__ || 'http://localhost:8055';
window.__API_TIMEOUT__ = 30000;
window.__APP_ENV__ = 'production';
