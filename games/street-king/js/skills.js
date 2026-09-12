/* =========================================================
   SKILLS
   A flat skill tree split into four playstyle branches. Each
   node costs 1 skill point (earned on level up) and is gated
   by a minimum level. Effects are read via Game.skills.has()
   by whichever system they affect.
========================================================= */

Game.SKILL_BRANCHES = [
    {
        id: "survivor",
        name: "Survivor",
        desc: "Health, defense, food, recovery.",
        skills: [
            { id: "steel_nerves", name: "Steel Nerves", level: 1,
              desc: "Take 15% less damage when below 25% HP." },
            { id: "iron_stomach", name: "Iron Stomach", level: 5,
              desc: "Food depletes 20% slower." },
            { id: "quick_recovery", name: "Quick Recovery", level: 10,
              desc: "+25% energy regeneration." },
            { id: "reinforced_body", name: "Reinforced Body", level: 18,
              desc: "+10% max health." }
        ]
    },
    {
        id: "hustler",
        name: "Hustler",
        desc: "Money, luck, jobs, trading.",
        skills: [
            { id: "street_smarts", name: "Street Smarts", level: 1,
              desc: "Work actions have a chance to find a rare bonus." },
            { id: "silver_tongue", name: "Silver Tongue", level: 5,
              desc: "+10% income from all jobs." },
            { id: "fast_hands", name: "Fast Hands", level: 10,
              desc: "8% chance for a work action to pay double." },
            { id: "lucky_bastard", name: "Lucky Bastard", level: 18,
              desc: "+25% chance of favorable random events." }
        ]
    },
    {
        id: "fighter",
        name: "Fighter",
        desc: "Strength, combat, weapons, crits.",
        skills: [
            { id: "iron_fists", name: "Iron Fists", level: 1,
              desc: "+15% Strength." },
            { id: "thick_skin", name: "Thick Skin", level: 5,
              desc: "+15% Defense." },
            { id: "dirty_fighter", name: "Dirty Fighter", level: 10,
              desc: "Critical hits deal +30% damage, but cost +2 stamina." },
            { id: "finisher", name: "Finisher", level: 18,
              desc: "Heavy attacks deal +20% damage." }
        ]
    },
    {
        id: "kingpin",
        name: "Kingpin",
        desc: "Reputation, passive income, influence.",
        skills: [
            { id: "known_face", name: "Known Face", level: 1,
              desc: "Hostile street encounters are 20% less likely." },
            { id: "never_sleep", name: "Never Sleep", level: 5,
              desc: "+25% offline energy and food recovery." },
            { id: "natural_leader", name: "Natural Leader", level: 10,
              desc: "+10% reputation gained from all sources." },
            { id: "feared_name", name: "Feared Name", level: 18,
              desc: "+10% money from combat victories." }
        ]
    }
];

Game.skills = {};

Game.skills.all = function () {
    return Game.SKILL_BRANCHES.flatMap(b => b.skills.map(s => ({ ...s, branch: b.id })));
};

Game.skills.get = function (id) {
    return Game.skills.all().find(s => s.id === id) || null;
};

Game.skills.has = function (id) {
    return Game.state.ownedSkillIds.includes(id);
};

Game.skills.canBuy = function (id) {
    const skill = Game.skills.get(id);
    if (!skill) return false;
    if (Game.skills.has(id)) return false;
    if (Game.state.player.skillPoints <= 0) return false;
    if (Game.state.player.level < skill.level) return false;
    return true;
};

Game.skills.buy = function (id) {
    if (!Game.skills.canBuy(id)) return;
    Game.state.ownedSkillIds.push(id);
    Game.state.player.skillPoints--;
    Game.audio.purchase();
    Game.player.log(`Learned skill: ${Game.skills.get(id).name}.`);
    Game.ui.renderSkills();
    Game.ui.renderHud();
    Game.missions.checkAll();
    Game.achievements.checkAll();
};
