// Runs before the bundle and before the first paint. The page CSP is
// default-src 'self' with no 'unsafe-inline' for scripts, so this has to be a
// real file rather than an inline block in index.html.
(function () {
  // The theme belongs to the account, which is not signed in yet, so the last
  // one used is read back off localStorage.
  try {
    var boot = JSON.parse(localStorage.getItem('ui:boot') || '{}');
    var root = document.documentElement;
    if (boot.theme) root.setAttribute('data-theme', boot.theme);
    if (boot.accent) root.setAttribute('data-accent', boot.accent);
    if (boot.density) root.setAttribute('data-density', boot.density);
    if (boot.radius) root.style.setProperty('--radius', boot.radius);
  } catch (err) {}
})();
