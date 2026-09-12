/* =========================================================
   SHELTER
   The player's living situation. Each tier costs money to
   move up to and grants a permanent bonus.
========================================================= */

Game.SHELTERS = [
    { id: "street", name: "The Street", cost: 0, offlineRecovery: 0, energyRegen: 0, offlineIncome: 0, jobIncome: 0,
      desc: "No roof. No walls. Just you and the concrete." },
    { id: "cardboard", name: "Cardboard Shelter", cost: 50, offlineRecovery: 0.05, energyRegen: 0, offlineIncome: 0, jobIncome: 0,
      desc: "A flattened box and a dry corner. It's something." },
    { id: "abandoned_room", name: "Abandoned Room", cost: 300, offlineRecovery: 0.08, energyRegen: 0.08, offlineIncome: 0, jobIncome: 0,
      desc: "Four walls, a hole in the roof, and nobody bothers you." },
    { id: "hostel", name: "Cheap Hostel", cost: 1200, offlineRecovery: 0.1, energyRegen: 0.1, offlineIncome: 0.05, jobIncome: 0,
      desc: "A bunk bed and a lock on the door. Luxury." },
    { id: "small_apartment", name: "Small Apartment", cost: 5000, offlineRecovery: 0.12, energyRegen: 0.12, offlineIncome: 0.15, jobIncome: 0.05,
      desc: "Your own place. Small, but yours." },
    { id: "apartment", name: "Apartment", cost: 20000, offlineRecovery: 0.15, energyRegen: 0.15, offlineIncome: 0.2, jobIncome: 0.08,
      desc: "Real furniture. A real fridge. A real life, maybe." },
    { id: "house", name: "House", cost: 75000, offlineRecovery: 0.18, energyRegen: 0.18, offlineIncome: 0.25, jobIncome: 0.12,
      desc: "A house with your name on the deed. People notice." },
    { id: "safehouse", name: "Safehouse", cost: 250000, offlineRecovery: 0.22, energyRegen: 0.2, offlineIncome: 0.3, jobIncome: 0.15,
      desc: "Reinforced doors. No one gets in you don't want in." },
    { id: "penthouse", name: "Penthouse", cost: 1000000, offlineRecovery: 0.3, energyRegen: 0.25, offlineIncome: 0.5, jobIncome: 0.2,
      desc: "The whole city, lit up below you. You made it." }
];

Game.shelter = {};

Game.shelter.current = function () {
    return Game.SHELTERS[Game.state.shelterIndex];
};

Game.shelter.next = function () {
    return Game.SHELTERS[Game.state.shelterIndex + 1] || null;
};

Game.shelter.upgrade = function () {
    const next = Game.shelter.next();
    if (!next) return false;
    if (!Game.player.spendMoney(next.cost)) {
        Game.ui.toast("Not enough money for that.", "warn");
        return false;
    }
    Game.state.shelterIndex++;
    Game.audio.purchase();
    Game.player.log(`You moved into: ${next.name}.`);
    Game.ui.toast(`New home: ${next.name}!`, "shelter");
    Game.missions.checkAll();
    Game.achievements.checkAll();
    Game.ui.renderAll();
    return true;
};
