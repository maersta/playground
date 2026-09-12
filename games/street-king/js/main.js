/* =========================================================
   MAIN
   Boots the game: load save, apply offline progress, render,
   start the tick/autosave loop, save on exit.
========================================================= */

(function () {
    const hadSave = Game.save.load();
    const offlineResult = hadSave ? Game.loop.applyOfflineProgress() : null;

    Game.ui.init();
    Game.ui.renderAll();

    if (offlineResult) {
        Game.ui.showWelcomeBack(offlineResult);
    }

    Game.missions.checkAll();
    Game.achievements.checkAll();
    Game.loop.start();

    window.addEventListener("beforeunload", Game.save.write);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) Game.save.write();
    });
})();
