/* =========================================================
   COMBAT
   Turn-based street fights. The player picks an action each
   round (attack/heavy/block/rest/flee); the enemy responds
   automatically. No persistent combat state is saved — a fight
   in progress ends if the page reloads.
========================================================= */

Game.ENEMIES = [
    { id: "drunk_guy", name: "Drunk Guy", unlockLevel: 1, health: 18, strength: 3, defense: 1,
      xp: 6, moneyMin: 4, moneyMax: 10, respect: 2, fear: 1, dropLuckBonus: 0 },
    { id: "street_thug", name: "Street Thug", unlockLevel: 3, health: 32, strength: 6, defense: 2,
      xp: 10, moneyMin: 8, moneyMax: 18, respect: 4, fear: 2, dropLuckBonus: 1 },
    { id: "gang_member", name: "Gang Member", unlockLevel: 6, health: 55, strength: 10, defense: 4,
      xp: 16, moneyMin: 15, moneyMax: 30, respect: 7, fear: 4, dropLuckBonus: 2 },
    { id: "brawler", name: "Brawler", unlockLevel: 9, health: 80, strength: 14, defense: 6,
      xp: 24, moneyMin: 25, moneyMax: 45, respect: 10, fear: 6, dropLuckBonus: 3 },
    { id: "enforcer", name: "Enforcer", unlockLevel: 13, health: 120, strength: 20, defense: 10,
      xp: 36, moneyMin: 40, moneyMax: 70, respect: 15, fear: 10, dropLuckBonus: 4 },
    { id: "rival_boss", name: "Rival Boss", unlockLevel: 20, health: 180, strength: 26, defense: 14,
      xp: 55, moneyMin: 70, moneyMax: 120, respect: 22, fear: 16, dropLuckBonus: 5 }
];

Game.BOSSES = {
    the_rat: { id: "the_rat", name: "The Rat", unlockLevel: 8, health: 220, strength: 22, defense: 10,
      xp: 120, moneyMin: 150, moneyMax: 250, respect: 40, fear: 25,
      rewardItemId: "combat_knife", territory: "Back Alley" }
};

Game.combat = {};
Game.combat.session = null;

Game.combat.isUnlocked = function (enemy) {
    return Game.state.player.level >= enemy.unlockLevel;
};

Game.combat.unlockedEnemies = function () {
    return Game.ENEMIES.filter(Game.combat.isUnlocked);
};

Game.combat.bossUnlocked = function () {
    return Game.state.player.level >= Game.BOSSES.the_rat.unlockLevel;
};

Game.combat.start = function (enemyId, isBoss = false) {
    const source = isBoss ? Game.BOSSES[enemyId] : Game.ENEMIES.find(e => e.id === enemyId);
    if (!source) return;

    Game.combat.session = {
        enemyId,
        isBoss,
        enemyName: source.name,
        enemyMaxHealth: source.health,
        enemyHealth: source.health,
        enemyStrength: source.strength,
        enemyDefense: source.defense,
        playerHealth: Game.state.player.health,
        playerMaxHealth: Game.player.maxHealth(),
        stamina: Game.player.maxStamina(),
        maxStamina: Game.player.maxStamina(),
        log: [`A fight breaks out with ${source.name}.`],
        over: false,
        result: null
    };

    Game.audio.fightStart();
    Game.ui.renderFight();
};

function combatLog(text) {
    const s = Game.combat.session;
    s.log.unshift(text);
    if (s.log.length > 20) s.log.length = 20;
}

function enemyStrike(damageMult = 1) {
    const s = Game.combat.session;
    const variance = Game.util.randFloat(0.8, 1.2);
    let dmg = Math.max(1, Math.round(s.enemyStrength * variance * damageMult - Game.player.effectiveDefense() * 0.5));

    if (Game.skills.has("steel_nerves") && s.playerHealth / s.playerMaxHealth <= 0.25) {
        dmg = Math.round(dmg * 0.85);
    }

    s.playerHealth = Game.util.clamp(s.playerHealth - dmg, 0, s.playerMaxHealth);
    combatLog(`${s.enemyName} hits you for ${dmg}.`);
    return dmg;
}

function enemyTurn() {
    const s = Game.combat.session;
    if (s.over) return;
    const heavy = Game.util.chance(0.25);
    enemyStrike(heavy ? 1.6 : 1);
    if (heavy) combatLog(`${s.enemyName} used a heavy strike.`);
}

function checkOutcome() {
    const s = Game.combat.session;
    if (s.enemyHealth <= 0) {
        finishFight(true);
        return true;
    }
    if (s.playerHealth <= 0) {
        finishFight(false);
        return true;
    }
    return false;
}

function finishFight(won) {
    const s = Game.combat.session;
    s.over = true;
    s.result = won ? "win" : "lose";
    Game.state.player.health = s.playerHealth;

    if (won) {
        const source = s.isBoss ? Game.BOSSES[s.enemyId] : Game.ENEMIES.find(e => e.id === s.enemyId);
        let money = Game.util.randInt(source.moneyMin, source.moneyMax);
        if (Game.skills.has("feared_name")) money = Math.round(money * 1.1);

        Game.player.addMoney(money);
        Game.player.addXp(source.xp);
        Game.player.addReputation({ respect: source.respect, fear: source.fear });
        Game.state.stats.totalFightsWon++;

        combatLog(`You defeated ${s.enemyName}! +${Game.util.formatMoney(money)}, +${source.xp} XP.`);
        Game.audio.victory();
        Game.player.log(`Won a fight against ${s.enemyName}.`);

        const dropLuck = Game.player.effectiveLuck() + (source.dropLuckBonus || 0);
        const item = Game.equipment.rollDrop(dropLuck);
        if (item) combatLog(`Found: ${item.name}.`);

        if (s.isBoss) {
            Game.audio.bossDefeat();
            if (!Game.state.city.defeatedBosses.includes(s.enemyId)) {
                Game.state.city.defeatedBosses.push(s.enemyId);
                if (source.rewardItemId) Game.equipment.grant(source.rewardItemId);
                Game.ui.toast(`${source.name} defeated! ${source.territory} is a little safer.`, "boss");
            }
        }
    } else {
        const lostMoney = Math.min(Game.state.resources.money, Math.round(Game.state.resources.money * 0.1));
        Game.state.resources.money -= lostMoney;
        Game.state.stats.totalFightsLost++;
        Game.state.player.health = Math.max(1, Math.round(s.playerMaxHealth * 0.15));
        combatLog(`You were beaten badly. Lost ${Game.util.formatMoney(lostMoney)}.`);
        Game.audio.defeat();
        Game.player.log(`Lost a fight against ${s.enemyName}.`);
    }

    Game.missions.checkAll();
    Game.achievements.checkAll();
    Game.ui.renderHud();
}

Game.combat.action = function (type) {
    const s = Game.combat.session;
    if (!s || s.over) return;

    if (type === "attack") {
        if (s.stamina < 3) { Game.ui.toast("Not enough stamina.", "warn"); return; }
        s.stamina -= 3;
        const variance = Game.util.randFloat(0.85, 1.15);
        let critChance = 0.05 + Game.player.effectiveLuck() * 0.005;
        if (Game.equipment.hasSpecial("crit8")) critChance += 0.08;
        const isCrit = Game.util.chance(critChance);

        let dmg = Math.max(1, Math.round(Game.player.effectiveStrength() * variance - s.enemyDefense * 0.5));
        if (isCrit) {
            let critMult = 1.5;
            if (Game.skills.has("dirty_fighter")) { critMult = 1.8; s.stamina = Math.max(0, s.stamina - 2); }
            dmg = Math.round(dmg * critMult);
            Game.audio.crit();
            combatLog(`Critical hit! You deal ${dmg}.`);
        } else {
            Game.audio.hit();
            combatLog(`You hit ${s.enemyName} for ${dmg}.`);
        }
        s.enemyHealth = Game.util.clamp(s.enemyHealth - dmg, 0, s.enemyMaxHealth);
        if (checkOutcome()) return Game.ui.renderFight();
        enemyTurn();
    } else if (type === "heavy") {
        if (s.stamina < 7) { Game.ui.toast("Not enough stamina.", "warn"); return; }
        s.stamina -= 7;
        const variance = Game.util.randFloat(0.85, 1.15);
        let mult = 1.8;
        if (Game.skills.has("finisher")) mult = 2.16;
        let dmg = Math.max(1, Math.round(Game.player.effectiveStrength() * mult * variance - s.enemyDefense * 0.5));

        if (Game.equipment.hasSpecial("stun10") && Game.util.chance(0.1)) {
            combatLog(`Heavy hit stuns ${s.enemyName}! You deal ${dmg} and they lose their turn.`);
            s.enemyHealth = Game.util.clamp(s.enemyHealth - dmg, 0, s.enemyMaxHealth);
            Game.audio.hit();
            if (checkOutcome()) return Game.ui.renderFight();
            return Game.ui.renderFight();
        }

        Game.audio.hit();
        combatLog(`Heavy attack! You deal ${dmg}.`);
        s.enemyHealth = Game.util.clamp(s.enemyHealth - dmg, 0, s.enemyMaxHealth);
        if (checkOutcome()) return Game.ui.renderFight();
        enemyTurn();
    } else if (type === "block") {
        s.stamina = Game.util.clamp(s.stamina + 1, 0, s.maxStamina);
        const variance = Game.util.randFloat(0.8, 1.2);
        let dmg = Math.max(0, Math.round((s.enemyStrength * variance - Game.player.effectiveDefense() * 0.5) * 0.3));
        s.playerHealth = Game.util.clamp(s.playerHealth - dmg, 0, s.playerMaxHealth);
        combatLog(`You block. ${s.enemyName} only gets through for ${dmg}.`);
        if (checkOutcome()) return Game.ui.renderFight();
    } else if (type === "rest") {
        s.stamina = Game.util.clamp(s.stamina + 6, 0, s.maxStamina);
        combatLog("You catch your breath.");
        enemyTurn();
        if (checkOutcome()) return Game.ui.renderFight();
    } else if (type === "flee") {
        const fleeChance = 0.4 + Game.player.effectiveLuck() * 0.02;
        if (Game.util.chance(fleeChance)) {
            combatLog(`You slip away from ${s.enemyName}.`);
            s.over = true;
            s.result = "fled";
            Game.state.player.health = s.playerHealth;
            Game.ui.renderFight();
            return;
        }
        combatLog("You fail to get away!");
        enemyTurn();
        if (checkOutcome()) return Game.ui.renderFight();
    }

    Game.ui.renderFight();
};

Game.combat.exit = function () {
    Game.combat.session = null;
    Game.ui.renderFight();
};
