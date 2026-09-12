/* =========================================================
   CREW
   Not implemented in v1 — this stub defines the unlock gate
   so the nav tab can honestly show real progress toward it
   instead of a fake working button. Recruiting/managing a
   crew is future work.
========================================================= */

Game.crew = {};

Game.crew.unlockReputation = 3000;

Game.crew.isUnlocked = function () {
    return Game.state.resources.reputation >= Game.crew.unlockReputation;
};
