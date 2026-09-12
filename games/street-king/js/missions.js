/* =========================================================
   MISSIONS
   One-time goals with a progress value and a claimable reward.
   checkAll() runs after most actions to flag newly-completable
   missions; claim() applies the reward once.
========================================================= */

Game.MISSIONS = [
    { id: "first_dollar", name: "First Dollar", desc: "Earn your first dollar.",
      target: 1, progress: () => Game.state.stats.totalMoneyEarned,
      reward: { money: 5 } },
    { id: "earn_100", name: "Getting By", desc: "Earn $100 total.",
      target: 100, progress: () => Game.state.stats.totalMoneyEarned,
      reward: { money: 20, xp: 10 } },
    { id: "reach_level_5", name: "Finding Your Feet", desc: "Reach Level 5.",
      target: 5, progress: () => Game.state.player.level,
      reward: { money: 30 } },
    { id: "first_shelter", name: "A Roof, Sort Of", desc: "Get your first shelter.",
      target: 1, progress: () => (Game.state.shelterIndex > 0 ? 1 : 0),
      reward: { money: 25, xp: 15 } },
    { id: "first_fight_won", name: "Bloodied", desc: "Win your first street fight.",
      target: 1, progress: () => Game.state.stats.totalFightsWon,
      reward: { money: 25, xp: 10 } },
    { id: "win_3_fights", name: "Not To Be Messed With", desc: "Win 3 fights.",
      target: 3, progress: () => Game.state.stats.totalFightsWon,
      reward: { money: 60, xp: 25 } },
    { id: "reach_level_10", name: "Getting Stronger", desc: "Reach Level 10.",
      target: 10, progress: () => Game.state.player.level,
      reward: { money: 100, xp: 30 } },
    { id: "defeat_the_rat", name: "Rat Problem, Solved", desc: "Defeat the Back Alley boss, The Rat.",
      target: 1, progress: () => (Game.state.city.defeatedBosses.includes("the_rat") ? 1 : 0),
      reward: { money: 200, xp: 60 } },
    { id: "earn_10000", name: "Real Money", desc: "Earn $10,000 total.",
      target: 10000, progress: () => Game.state.stats.totalMoneyEarned,
      reward: { money: 500, xp: 80 } },
    { id: "learn_first_skill", name: "Sharpening Up", desc: "Learn your first skill.",
      target: 1, progress: () => Game.state.ownedSkillIds.length,
      reward: { money: 40 } },
    { id: "own_5_items", name: "Getting Equipped", desc: "Own 5 pieces of equipment.",
      target: 5, progress: () => Game.state.stats.itemsFound,
      reward: { money: 75, xp: 20 } },
    { id: "reach_level_25", name: "A Name on the Street", desc: "Reach Level 25.",
      target: 25, progress: () => Game.state.player.level,
      reward: { money: 1000, xp: 150 } }
];

Game.missions = {};

Game.missions.isCompleted = function (id) {
    return Game.state.completedMissionIds.includes(id);
};

Game.missions.isClaimable = function (mission) {
    if (Game.missions.isCompleted(mission.id)) return false;
    return mission.progress() >= mission.target;
};

Game.missions.checkAll = function () {
    let anyNewlyClaimable = false;
    for (const mission of Game.MISSIONS) {
        if (Game.missions.isClaimable(mission) && !Game.state._notifiedMissions?.includes(mission.id)) {
            anyNewlyClaimable = true;
            Game.state._notifiedMissions = Game.state._notifiedMissions || [];
            Game.state._notifiedMissions.push(mission.id);
        }
    }
    if (anyNewlyClaimable) Game.ui.markNavAttention("missions");
    if (typeof Game.ui.renderMissions === "function" && Game.ui.currentTab === "missions") {
        Game.ui.renderMissions();
    }
};

Game.missions.claim = function (id) {
    const mission = Game.MISSIONS.find(m => m.id === id);
    if (!mission || !Game.missions.isClaimable(mission)) return;

    Game.state.completedMissionIds.push(id);
    if (mission.reward.money) Game.player.addMoney(mission.reward.money);
    if (mission.reward.xp) Game.player.addXp(mission.reward.xp);

    Game.audio.achievement();
    Game.ui.toast(`Mission complete: ${mission.name}!`, "mission");
    Game.player.log(`Completed mission: ${mission.name}.`);
    Game.ui.renderMissions();
    Game.ui.renderHud();
};
