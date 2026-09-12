/* =========================================================
   GAME LOOP
   The 1-second tick: energy/health/food regen and drain,
   plus offline progress calculated once on load.
========================================================= */

Game.loop = {};

Game.loop.energyRegenRate = function () {
    let rate = Game.balance.energyRegenPerTick;
    rate *= 1 + Game.shelter.current().energyRegen;
    if (Game.skills.has("quick_recovery")) rate *= 1.25;
    if (Game.player.isStarving()) rate *= Game.balance.starvingEnergyRegenMult;
    return rate;
};

Game.loop.foodDrainRate = function () {
    let rate = Game.balance.foodDrainPerTick;
    if (Game.skills.has("iron_stomach")) rate *= 0.8;
    return rate;
};

Game.loop.tick = function () {
    const p = Game.state.player;
    const r = Game.state.resources;

    p.energy = Game.util.clamp(p.energy + Game.loop.energyRegenRate(), 0, Game.player.maxEnergy());
    r.food = Game.util.clamp(r.food - Game.loop.foodDrainRate(), 0, r.maxFood);

    if (Game.player.isStarving()) {
        p.health = Game.util.clamp(p.health - Game.balance.starvingHealthDrainPerTick, 0, Game.player.maxHealth());
    } else if (!Game.combat.session) {
        p.health = Game.util.clamp(p.health + Game.balance.healthRegenPerTick, 0, Game.player.maxHealth());
    }

    Game.ui.renderHud();
};

Game.loop.start = function () {
    setInterval(Game.loop.tick, Game.balance.tickIntervalMs);
    setInterval(Game.save.write, Game.balance.autosaveIntervalMs);
};

Game.loop.applyOfflineProgress = function () {
    const now = Date.now();
    const elapsed = Math.min(now - Game.state.meta.lastSaved, Game.balance.offlineCapMs);
    if (elapsed < 30000) return null;

    const seconds = elapsed / 1000;
    const shelter = Game.shelter.current();
    const never = Game.skills.has("never_sleep") ? 1.25 : 1;

    const maxEnergy = Game.player.maxEnergy();
    const energyBefore = Game.state.player.energy;
    const rawEnergyGain = Game.loop.energyRegenRate() * seconds * (1 + shelter.offlineRecovery) * never;
    const energyAfter = Game.util.clamp(energyBefore + rawEnergyGain, 0, maxEnergy);

    const maxFood = Game.state.resources.maxFood;
    const foodBefore = Game.state.resources.food;
    const foodDrain = Game.loop.foodDrainRate() * seconds * (1 / never);
    const rawFoodChange = -foodDrain + shelter.offlineRecovery * 20;
    const foodAfter = Game.util.clamp(foodBefore + rawFoodChange, 0, maxFood);

    const job = Game.jobs.current();
    const avgMoney = (job.moneyMin + job.moneyMax) / 2;
    const moneyPerSecond = (avgMoney / 20) * shelter.offlineIncome;
    const moneyGain = Math.round(moneyPerSecond * seconds);

    const eventsSeen = shelter.offlineIncome > 0 ? Game.util.randInt(0, Math.floor(seconds / 1800)) : 0;

    Game.state.player.energy = energyAfter;
    Game.state.resources.food = foodAfter;
    const energyGain = Math.round(energyAfter - energyBefore);
    const foodGain = Math.round(foodAfter - foodBefore);
    if (moneyGain > 0) Game.player.addMoney(moneyGain);

    return {
        elapsedMs: elapsed,
        money: moneyGain,
        energy: energyGain,
        food: foodGain,
        events: eventsSeen
    };
};
