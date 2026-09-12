/* =========================================================
   PRESTIGE ("NEW LIFE")
   Not implemented in v1 — see crew.js for why. Gated behind a
   high level so it only appears once a run is genuinely mature.
========================================================= */

Game.prestige = {};

Game.prestige.unlockLevel = 30;

Game.prestige.isUnlocked = function () {
    return Game.state.player.level >= Game.prestige.unlockLevel;
};
