/* =========================================================
   CITY
   v1 ships with one playable territory (Back Alley) plus its
   boss fight. The rest of the map is shown as a locked preview
   of where the game is headed — honestly labelled, not a fake
   working feature. Extending this to full multi-territory play
   is future work the rest of the architecture leaves room for.
========================================================= */

Game.TERRITORIES = [
    { id: "back_alley", name: "Back Alley", unlockReputation: 0, bossId: "the_rat", bossName: "The Rat",
      desc: "Where every street king started: broke, cold, and unknown." },
    { id: "downtown", name: "Downtown", unlockReputation: 500, bossName: "Big Mike",
      desc: "Busy streets, easy marks, and eyes everywhere." },
    { id: "industrial", name: "Industrial District", unlockReputation: 1200, bossName: "The Foreman",
      desc: "Warehouses, scrap, and work that doesn't ask questions." },
    { id: "market", name: "Market", unlockReputation: 2200, bossName: null,
      desc: "Everything has a price if you know who to ask." },
    { id: "docks", name: "Docks", unlockReputation: 3500, bossName: "Captain",
      desc: "Whatever comes into this city comes in here first." },
    { id: "night_district", name: "Night District", unlockReputation: 5000, bossName: "The Dealer",
      desc: "The city's other economy runs after dark." },
    { id: "old_town", name: "Old Town", unlockReputation: 7000, bossName: null,
      desc: "Old money, older grudges." },
    { id: "rich_district", name: "Rich District", unlockReputation: 10000, bossName: "The Kingpin",
      desc: "The top of the city. The top of the game." }
];

Game.city = {};

Game.city.isUnlocked = function (territory) {
    return Game.state.resources.reputation >= territory.unlockReputation;
};
