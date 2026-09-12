/* =========================================================
   PLAYER
   Level/XP, derived stats (base + equipment + skills), and
   the core resource helpers (health/energy/food/reputation).
========================================================= */

Game.player = {};

Game.player.maxHealth = function () {
    const p = Game.state.player;
    let value = Game.balance.baseMaxHealth + (p.level - 1) * Game.balance.healthPerLevel;
    value += Game.equipment.totalBonus("health");
    if (Game.skills.has("reinforced_body")) value *= 1.1;
    return Math.round(value);
};

Game.player.maxEnergy = function () {
    const p = Game.state.player;
    let value = Game.balance.baseMaxEnergy + (p.level - 1) * Game.balance.energyPerLevel;
    value += Game.equipment.totalBonus("energy");
    return Math.round(value);
};

Game.player.maxStamina = function () {
    let value = Game.balance.baseMaxStamina + Game.player.effectiveStrength() * 0.5;
    return Math.round(value);
};

Game.player.effectiveStrength = function () {
    let value = Game.state.player.strength + Game.equipment.totalBonus("strength");
    if (Game.skills.has("iron_fists")) value *= 1.15;
    return Math.round(value * 10) / 10;
};

Game.player.effectiveDefense = function () {
    let value = Game.state.player.defense + Game.equipment.totalBonus("defense");
    if (Game.skills.has("thick_skin")) value *= 1.15;
    return Math.round(value * 10) / 10;
};

Game.player.effectiveLuck = function () {
    return Game.state.player.luck + Game.equipment.totalBonus("luck");
};

Game.player.effectiveCharisma = function () {
    return Game.state.player.charisma + Game.equipment.totalBonus("charisma");
};

Game.player.reputationTitle = function () {
    const rep = Game.state.resources.reputation;
    let title = Game.REPUTATION_TITLES[0].name;
    for (const tier of Game.REPUTATION_TITLES) {
        if (rep >= tier.min) title = tier.name;
    }
    return title;
};

Game.player.addMoney = function (amount) {
    Game.state.resources.money += amount;
    Game.state.stats.totalMoneyEarned += Math.max(0, amount);
};

Game.player.spendMoney = function (amount) {
    if (Game.state.resources.money < amount) return false;
    Game.state.resources.money -= amount;
    return true;
};

Game.player.addFood = function (amount) {
    const r = Game.state.resources;
    r.food = Game.util.clamp(r.food + amount, 0, r.maxFood);
};

Game.player.addHealth = function (amount) {
    const p = Game.state.player;
    p.health = Game.util.clamp(p.health + amount, 0, Game.player.maxHealth());
};

Game.player.addReputation = function ({ respect = 0, fear = 0, trust = 0 }) {
    const r = Game.state.resources;
    let mult = Game.skills.has("natural_leader") ? 1.1 : 1;
    r.respect += respect * mult;
    r.fear += fear * mult;
    r.trust += trust * mult;
    const before = r.reputation;
    r.reputation = Math.round(r.respect + r.fear + r.trust);
    if (Math.floor(before / 50) < Math.floor(r.reputation / 50)) {
        Game.ui.toast(`Reputation rising: ${Game.player.reputationTitle()}`, "rep");
    }
};

Game.player.addXp = function (amount) {
    const p = Game.state.player;
    p.xp += amount;
    let leveled = false;

    while (p.xp >= Game.balance.xpToNext(p.level)) {
        p.xp -= Game.balance.xpToNext(p.level);
        p.level++;
        p.skillPoints++;
        p.strength += 0.4;
        p.defense += 0.3;
        p.luck += 0.2;
        p.charisma += 0.2;
        p.health = Game.player.maxHealth();
        p.energy = Game.player.maxEnergy();
        leveled = true;
    }

    if (leveled) {
        Game.audio.levelUp();
        Game.ui.toast(`Level up! You are now Level ${p.level}.`, "level");
        Game.missions.checkAll();
        Game.achievements.checkAll();
    }
};

Game.player.isStarving = function () {
    return Game.state.resources.food <= 0;
};

Game.player.log = function (message) {
    Game.state.log.unshift({ text: message, t: Date.now() });
    if (Game.state.log.length > 40) Game.state.log.length = 40;
    Game.ui.renderLog();
};
