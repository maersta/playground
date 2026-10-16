/* Little Ocean - entry point. Scripts load in order (see index.html); this runs last. */
(function () {
  function boot() {
    LO.Save.load();
    LO.Player.refreshLook();
    LO.UI.init();
    LO.Game.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
