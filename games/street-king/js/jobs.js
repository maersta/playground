/* =========================================================
   JOBS
   The activities the player performs by pressing DO IT. Each
   job has a tier, an unlock requirement, an energy cost and a
   money/xp range. Selecting a job (WORK tab) sets it active;
   clicking DO IT (HOME tab) performs the active job.
========================================================= */

Game.JOBS = [
    { id: "search_trash", name: "Search Trash", tier: "early", unlockLevel: 1,
      energyCost: 2, moneyMin: 1, moneyMax: 3, xp: 2, foodChance: 0.12, foodAmount: [1, 3],
      riskChance: 0.05, desc: "Dig through what the city throws away." },
    { id: "collect_bottles", name: "Collect Bottles", tier: "early", unlockLevel: 2,
      energyCost: 3, moneyMin: 2, moneyMax: 5, xp: 3, foodChance: 0.05, foodAmount: [1, 2],
      riskChance: 0.06, desc: "Every bottle is a few more cents toward tomorrow." },
    { id: "wash_cars", name: "Wash Cars", tier: "early", unlockLevel: 4,
      energyCost: 4, moneyMin: 4, moneyMax: 9, xp: 4, foodChance: 0.02, foodAmount: [1, 1],
      riskChance: 0.05, desc: "A bucket, a rag, and low standards from drivers." },
    { id: "delivery_worker", name: "Delivery Worker", tier: "early", unlockLevel: 6,
      energyCost: 5, moneyMin: 8, moneyMax: 16, xp: 6, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.08, desc: "Running packages across town, fast and unbothered." },
    { id: "street_performer", name: "Street Performer", tier: "early", unlockLevel: 8,
      energyCost: 4, moneyMin: 6, moneyMax: 20, xp: 5, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.04, charismaScaled: true, desc: "Charisma pays. Sometimes literally." },

    { id: "security_guard", name: "Security Guard", tier: "mid", unlockLevel: 12, repRequired: 50,
      energyCost: 6, moneyMin: 20, moneyMax: 38, xp: 10, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.1, desc: "Standing between trouble and someone who pays you not to." },
    { id: "construction_worker", name: "Construction Worker", tier: "mid", unlockLevel: 16,
      energyCost: 7, moneyMin: 30, moneyMax: 55, xp: 13, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.06, strengthScaled: true, desc: "Hard labor, decent pay, no questions asked." },
    { id: "bouncer", name: "Bouncer", tier: "mid", unlockLevel: 20, repRequired: 150,
      energyCost: 8, moneyMin: 45, moneyMax: 80, xp: 16, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.14, strengthScaled: true, desc: "You decide who gets in. Some don't like that." },
    { id: "debt_collector", name: "Debt Collector", tier: "mid", unlockLevel: 28, repRequired: 400,
      energyCost: 9, moneyMin: 70, moneyMax: 130, xp: 22, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.18, desc: "People don't like it when you knock. They pay anyway." },

    { id: "street_boss_ops", name: "Street Boss Operations", tier: "late", unlockLevel: 40, repRequired: 1500,
      energyCost: 12, moneyMin: 150, moneyMax: 300, xp: 40, foodChance: 0, foodAmount: [0, 0],
      riskChance: 0.2, desc: "You don't work the street anymore. The street works for you." }
];

Game.jobs = {};

Game.jobs.get = function (id) {
    return Game.JOBS.find(j => j.id === id) || null;
};

Game.jobs.isUnlocked = function (job) {
    const level = Game.state.player.level;
    const rep = Game.state.resources.reputation;
    if (level < job.unlockLevel) return false;
    if (job.repRequired && rep < job.repRequired) return false;
    return true;
};

Game.jobs.unlockedJobs = function () {
    return Game.JOBS.filter(Game.jobs.isUnlocked);
};

Game.jobs.current = function () {
    return Game.jobs.get(Game.state.currentJobId) || Game.JOBS[0];
};

Game.jobs.select = function (id) {
    const job = Game.jobs.get(id);
    if (!job || !Game.jobs.isUnlocked(job)) return;
    Game.state.currentJobId = id;
    Game.audio.click();
    Game.ui.renderAll();
};

Game.jobs.perform = function () {
    const job = Game.jobs.current();
    const energy = Game.state.player.energy;

    if (energy < job.energyCost) {
        Game.ui.toast("Too tired. Rest a moment.", "warn");
        return;
    }

    Game.state.player.energy -= job.energyCost;
    Game.state.stats.totalClicks++;

    let money = Game.util.randInt(job.moneyMin, job.moneyMax);
    if (job.charismaScaled) money += Math.round(Game.player.effectiveCharisma() * 0.8);
    if (job.strengthScaled) money += Math.round(Game.player.effectiveStrength() * 0.6);

    const shelterBonus = Game.shelter.current().jobIncome;
    money = Math.round(money * (1 + shelterBonus));

    if (Game.skills.has("silver_tongue")) money = Math.round(money * 1.1);

    let doubled = false;
    if (Game.skills.has("fast_hands") && Game.util.chance(0.08)) {
        money *= 2;
        doubled = true;
    }

    let xp = job.xp;
    let foundFood = 0;
    let bonusFind = false;

    if (job.foodChance && Game.util.chance(job.foodChance)) {
        foundFood = Game.util.randInt(job.foodAmount[0], job.foodAmount[1]);
    }

    if (Game.skills.has("street_smarts") && Game.util.chance(0.05)) {
        bonusFind = true;
        money += Game.util.randInt(5, 15);
    }

    Game.player.addMoney(money);
    Game.player.addXp(xp);
    if (foundFood > 0) Game.player.addFood(foundFood);
    Game.player.addReputation({ respect: 0.3 });

    Game.audio.money();
    Game.ui.spawnFloatingText(`+${Game.util.formatMoney(money)}`, "money");
    Game.ui.spawnFloatingText(`+${xp} XP`, "xp");
    if (foundFood > 0) Game.ui.spawnFloatingText(`+${foundFood} Food`, "food");
    if (doubled) Game.ui.toast("Fast Hands: double pay!", "good");
    if (bonusFind) Game.ui.toast("Street Smarts: found extra cash.", "good");

    const item = Game.player.effectiveLuck() ? Game.equipment.rollDrop(Game.player.effectiveLuck()) : null;
    if (item) Game.audio.achievement();

    if (job.riskChance && Game.util.chance(job.riskChance)) {
        Game.events.trigger();
    }

    Game.missions.checkAll();
    Game.achievements.checkAll();
    Game.ui.renderHud();
    Game.ui.renderHome();
};
