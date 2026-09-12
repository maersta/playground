/* =========================================================
   STATE
   Central game state + core balancing constants that don't
   belong to one specific system (leveling curve, reputation
   titles, base regen rates). System-specific data (jobs,
   items, enemies, skills, missions...) lives in its own file.
========================================================= */

Game.SAVE_KEY = "playground.streetKing.save";
Game.SAVE_VERSION = 1;

Game.balance = {
    xpToNext(level) {
        return Math.floor(25 * Math.pow(level, 1.55)) + 15;
    },
    baseMaxHealth: 30,
    baseMaxEnergy: 20,
    baseMaxStamina: 20,
    healthPerLevel: 4,
    energyPerLevel: 1.5,
    energyRegenPerTick: 0.6, // per 1s tick, before shelter/skill multipliers
    healthRegenPerTick: 0.15,
    foodDrainPerTick: 0.04, // slow passive drain, ~1 food per 25s
    maxFoodBase: 100,
    starvingEnergyRegenMult: 0.3,
    starvingHealthDrainPerTick: 0.08,
    offlineCapMs: 10 * 60 * 60 * 1000, // 10 hours max simulated offline
    autosaveIntervalMs: 10000,
    tickIntervalMs: 1000
};

Game.REPUTATION_TITLES = [
    { min: 0, name: "Nobody" },
    { min: 50, name: "Known Face" },
    { min: 150, name: "Street Survivor" },
    { min: 400, name: "Tough Guy" },
    { min: 800, name: "Fighter" },
    { min: 1500, name: "Local Name" },
    { min: 3000, name: "Enforcer" },
    { min: 6000, name: "Gang Boss" },
    { min: 12000, name: "Street King" }
];

function createDefaultState() {
    return {
        version: Game.SAVE_VERSION,
        meta: {
            createdAt: Date.now(),
            lastSaved: Date.now()
        },
        settings: {
            soundEnabled: true
        },
        resources: {
            money: 0,
            food: 40,
            maxFood: Game.balance.maxFoodBase,
            reputation: 0,
            respect: 0,
            fear: 0,
            trust: 0
        },
        player: {
            level: 1,
            xp: 0,
            health: Game.balance.baseMaxHealth,
            energy: Game.balance.baseMaxEnergy,
            strength: 3,
            defense: 2,
            luck: 2,
            charisma: 2,
            skillPoints: 0
        },
        shelterIndex: 0,
        equipment: { head: null, body: null, hands: null, legs: null, feet: null, weapon: null },
        inventory: [],
        currentJobId: "search_trash",
        ownedSkillIds: [],
        completedMissionIds: [],
        unlockedAchievementIds: [],
        city: {
            defeatedBosses: []
        },
        stats: {
            totalClicks: 0,
            totalMoneyEarned: 0,
            totalFightsWon: 0,
            totalFightsLost: 0,
            totalEventsSeen: 0,
            itemsFound: 0
        },
        log: []
    };
}

Game.state = createDefaultState();

Game.resetState = function () {
    Game.state = createDefaultState();
};
