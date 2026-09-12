/* =========================================================
   BUSINESSES
   Not implemented in v1 — see crew.js for why. Gated behind
   Crew since businesses are framed as the next step after
   building a crew.
========================================================= */

Game.businesses = {};

Game.businesses.unlockReputation = 6000;

Game.businesses.isUnlocked = function () {
    return Game.state.resources.reputation >= Game.businesses.unlockReputation;
};
