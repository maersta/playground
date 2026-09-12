/* =========================================================
   ACHIEVEMENTS
   Auto-unlocking badges (no claim step). A few carry a small
   permanent bonus so they're not pure vanity. Secret ones show
   as "???" until unlocked.
========================================================= */

Game.ACHIEVEMENTS = [
    { id: "first_dollar", name: "First Dollar", desc: "Earn your first dollar.",
      condition: () => Game.state.stats.totalMoneyEarned >= 1 },
    { id: "survivor", name: "Survivor", desc: "Survive your first week (in-game).",
      condition: () => Date.now() - Game.state.meta.createdAt >= 7 * 24 * 60 * 60 * 1000 },
    { id: "bloodied", name: "Bloodied", desc: "Win your first fight.",
      condition: () => Game.state.stats.totalFightsWon >= 1 },
    { id: "rooftop", name: "Rooftop", desc: "Get your first real shelter.",
      condition: () => Game.state.shelterIndex >= 3 },
    { id: "known_name", name: "Known Name", desc: "Reach 1,000 reputation.",
      condition: () => Game.state.resources.reputation >= 1000 },
    { id: "boss_slayer", name: "Boss", desc: "Defeat your first territory boss.",
      condition: () => Game.state.city.defeatedBosses.length >= 1,
      bonus: { luck: 1 } },
    { id: "specialist", name: "Specialist", desc: "Learn 4 skills.",
      condition: () => Game.state.ownedSkillIds.length >= 4,
      bonus: { charisma: 1 } },
    { id: "well_dressed", name: "Well Dressed", desc: "Fill every equipment slot.",
      condition: () => Object.values(Game.state.equipment).every(Boolean) },
    { id: "legend", name: "Legend", desc: "Reach Level 30.",
      condition: () => Game.state.player.level >= 30,
      bonus: { strength: 2, defense: 2 } },
    { id: "penny_pincher", name: "Penny Pincher", desc: "Hold $50,000 at once.",
      condition: () => Game.state.resources.money >= 50000 },

    { id: "secret_click_1000", name: "???", realName: "Repetitive Strain", desc: "Perform 1,000 work actions.",
      secret: true, condition: () => Game.state.stats.totalClicks >= 1000 },
    { id: "secret_lost_fight", name: "???", realName: "Humbled", desc: "Lose a street fight.",
      secret: true, condition: () => Game.state.stats.totalFightsLost >= 1 },
    { id: "secret_starving", name: "???", realName: "Rock Bottom", desc: "Run out of food.",
      secret: true, condition: () => Game.player.isStarving() }
];

Game.achievements = {};

Game.achievements.isUnlocked = function (id) {
    return Game.state.unlockedAchievementIds.includes(id);
};

Game.achievements.checkAll = function () {
    for (const a of Game.ACHIEVEMENTS) {
        if (Game.achievements.isUnlocked(a.id)) continue;
        if (a.condition()) {
            Game.state.unlockedAchievementIds.push(a.id);
            if (a.bonus) {
                for (const [stat, value] of Object.entries(a.bonus)) {
                    Game.state.player[stat] = (Game.state.player[stat] || 0) + value;
                }
            }
            Game.audio.achievement();
            Game.ui.toast(`Achievement unlocked: ${a.realName || a.name}`, "achievement");
            Game.player.log(`Achievement unlocked: ${a.realName || a.name}.`);
        }
    }
    if (Game.ui.currentTab === "achievements") Game.ui.renderAchievements();
};
