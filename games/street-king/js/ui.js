/* =========================================================
   UI
   Tab switching, all panel rendering, modals, toasts and the
   floating-number effect. DOM writes are skipped when the
   underlying value hasn't changed, to keep long sessions fast.
========================================================= */

Game.ui = {};
Game.ui.currentTab = "home";
Game.ui._hudCache = {};
Game.ui._navAttention = new Set();

const NAV_TABS = [
    { id: "home", label: "Home" },
    { id: "work", label: "Work" },
    { id: "fight", label: "Fight" },
    { id: "equipment", label: "Equipment" },
    { id: "skills", label: "Skills" },
    { id: "city", label: "City" },
    { id: "crew", label: "Crew" },
    { id: "businesses", label: "Businesses" },
    { id: "missions", label: "Missions" },
    { id: "achievements", label: "Achievements" },
    { id: "newlife", label: "New Life" }
];

/* ---------- init / nav ---------- */

Game.ui.init = function () {
    const nav = document.getElementById("mainNav");
    nav.innerHTML = NAV_TABS.map(t => `
        <button class="nav-btn" data-tab="${t.id}" type="button">
            ${Game.util.escapeHtml(t.label)}
            <span class="nav-dot" hidden></span>
        </button>
    `).join("");

    nav.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => Game.ui.switchTab(btn.dataset.tab));
    });

    document.getElementById("doItBtn").addEventListener("click", () => {
        Game.audio.click();
        Game.jobs.perform();
    });

    document.getElementById("shelterUpgradeBtn").addEventListener("click", Game.shelter.upgrade);
    document.getElementById("menuBtn").addEventListener("click", () => Game.ui.toggleModal("settingsModal", true));
    document.getElementById("closeSettingsBtn").addEventListener("click", () => Game.ui.toggleModal("settingsModal", false));
    document.getElementById("saveBtn").addEventListener("click", Game.save.manualSave);
    document.getElementById("exportBtn").addEventListener("click", Game.ui.handleExport);
    document.getElementById("importBtn").addEventListener("click", Game.ui.handleImport);
    document.getElementById("resetBtn").addEventListener("click", Game.ui.handleReset);
    document.getElementById("soundToggleBtn").addEventListener("click", Game.ui.toggleSound);
    document.getElementById("closeWelcomeBtn").addEventListener("click", () => Game.ui.toggleModal("welcomeModal", false));

    Game.ui.updateSoundLabel();
    Game.ui.switchTab("home");
};

Game.ui.switchTab = function (tabId) {
    Game.ui.currentTab = tabId;
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
        if (btn.dataset.tab === tabId) {
            btn.querySelector(".nav-dot").hidden = true;
            Game.ui._navAttention.delete(tabId);
        }
    });
    document.querySelectorAll(".panel").forEach(panel => {
        panel.hidden = panel.id !== `panel-${tabId}`;
    });
    Game.ui.renderCurrentTab();
};

Game.ui.markNavAttention = function (tabId) {
    Game.ui._navAttention.add(tabId);
    const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"] .nav-dot`);
    if (btn) btn.hidden = tabId === Game.ui.currentTab;
};

Game.ui.renderCurrentTab = function () {
    const renderers = {
        home: Game.ui.renderHome,
        work: Game.ui.renderWork,
        fight: Game.ui.renderFight,
        equipment: Game.ui.renderEquipment,
        skills: Game.ui.renderSkills,
        city: Game.ui.renderCity,
        crew: () => Game.ui.renderLockedPanel("crew", Game.crew, "Recruit a crew to run the streets while you sleep."),
        businesses: () => Game.ui.renderLockedPanel("businesses", Game.businesses, "Own real businesses that generate steady income."),
        missions: Game.ui.renderMissions,
        achievements: Game.ui.renderAchievements,
        newlife: () => Game.ui.renderLockedPanel("newlife", Game.prestige, "Start a New Life with permanent bonuses once you've proven yourself.")
    };
    (renderers[Game.ui.currentTab] || Game.ui.renderHome)();
};

Game.ui.renderAll = function () {
    Game.ui.renderHud();
    Game.ui.renderCurrentTab();
};

/* ---------- HUD ---------- */

Game.ui.renderHud = function () {
    const r = Game.state.resources;
    const p = Game.state.player;
    const cache = Game.ui._hudCache;
    const set = (id, value) => {
        if (cache[id] === value) return;
        cache[id] = value;
        const node = document.getElementById(id);
        if (node) node.textContent = value;
    };

    set("hudMoney", Game.util.formatMoney(r.money));
    set("hudFood", `${Math.round(r.food)}/${r.maxFood}`);
    set("hudHealth", `${Math.round(p.health)}/${Game.player.maxHealth()}`);
    set("hudEnergy", `${Math.round(p.energy)}/${Game.player.maxEnergy()}`);
    set("hudReputation", `${Game.util.formatNumber(r.reputation)} · ${Game.player.reputationTitle()}`);
    set("hudLevel", p.level);

    const xpNeeded = Game.balance.xpToNext(p.level);
    const xpPct = Game.util.clamp((p.xp / xpNeeded) * 100, 0, 100);
    const xpBar = document.getElementById("hudXpBar");
    if (xpBar && cache.xpPct !== xpPct) {
        cache.xpPct = xpPct;
        xpBar.style.width = `${xpPct}%`;
    }
    set("hudXpText", `${Math.floor(p.xp)}/${xpNeeded} XP`);

    const foodBar = document.getElementById("hudFoodBar");
    const foodPct = Game.util.clamp((r.food / r.maxFood) * 100, 0, 100);
    if (foodBar && cache.foodPct !== foodPct) {
        cache.foodPct = foodPct;
        foodBar.style.width = `${foodPct}%`;
        foodBar.classList.toggle("bar-danger", foodPct <= 15);
    }

    const healthBar = document.getElementById("hudHealthBar");
    const healthPct = Game.util.clamp((p.health / Game.player.maxHealth()) * 100, 0, 100);
    if (healthBar && cache.healthPct !== healthPct) {
        cache.healthPct = healthPct;
        healthBar.style.width = `${healthPct}%`;
        healthBar.classList.toggle("bar-danger", healthPct <= 25);
    }

    const energyBar = document.getElementById("hudEnergyBar");
    const energyPct = Game.util.clamp((p.energy / Game.player.maxEnergy()) * 100, 0, 100);
    if (energyBar && cache.energyPct !== energyPct) {
        cache.energyPct = energyPct;
        energyBar.style.width = `${energyPct}%`;
    }
};

/* ---------- HOME ---------- */

Game.ui.renderHome = function () {
    const job = Game.jobs.current();
    const shelter = Game.shelter.current();
    const next = Game.shelter.next();

    document.getElementById("homeStatusTitle").textContent =
        Game.state.shelterIndex === 0 ? "HOMELESS" : shelter.name.toUpperCase();
    document.getElementById("homeJobName").textContent = job.name.toUpperCase();
    document.getElementById("homeJobDesc").textContent = job.desc;
    document.getElementById("doItBtn").textContent = `DO IT (-${job.energyCost} Energy)`;

    const shelterCard = document.getElementById("homeShelterCard");
    if (next) {
        shelterCard.innerHTML = `
            <div class="shelter-current">Living at: <strong>${Game.util.escapeHtml(shelter.name)}</strong></div>
            <div class="shelter-next">Next: ${Game.util.escapeHtml(next.name)} — ${Game.util.formatMoney(next.cost)}</div>
        `;
        document.getElementById("shelterUpgradeBtn").hidden = false;
        document.getElementById("shelterUpgradeBtn").textContent = `Move In (${Game.util.formatMoney(next.cost)})`;
        document.getElementById("shelterUpgradeBtn").disabled = Game.state.resources.money < next.cost;
    } else {
        shelterCard.innerHTML = `<div class="shelter-current">Living at: <strong>${Game.util.escapeHtml(shelter.name)}</strong> — you've made it to the top.</div>`;
        document.getElementById("shelterUpgradeBtn").hidden = true;
    }

    Game.ui.renderLog();
};

Game.ui.renderLog = function () {
    if (Game.ui.currentTab !== "home") return;
    const logEl = document.getElementById("homeLog");
    if (!logEl) return;
    logEl.innerHTML = Game.state.log.slice(0, 12).map(entry =>
        `<div class="log-entry">${Game.util.escapeHtml(entry.text)}</div>`
    ).join("") || `<div class="log-entry log-empty">Nothing has happened yet. Get to work.</div>`;
};

Game.ui.spawnFloatingText = function (text, type) {
    const layer = document.getElementById("floatingLayer");
    if (!layer) return;
    const el = Game.util.el("div", `floating-text floating-${type}`, text);
    el.style.left = `${45 + Game.util.randInt(-10, 10)}%`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
};

/* ---------- WORK ---------- */

Game.ui.renderWork = function () {
    const list = document.getElementById("workList");
    list.innerHTML = Game.JOBS.map(job => {
        const unlocked = Game.jobs.isUnlocked(job);
        const active = job.id === Game.state.currentJobId;
        const reqText = !unlocked
            ? `Requires Level ${job.unlockLevel}${job.repRequired ? ` &amp; ${job.repRequired} Reputation` : ""}`
            : `${Game.util.formatMoney(job.moneyMin)}–${Game.util.formatMoney(job.moneyMax)} · ${job.xp} XP · -${job.energyCost} Energy`;

        return `
            <div class="card job-card ${active ? "active" : ""} ${unlocked ? "" : "locked"}">
                <div class="card-title">${Game.util.escapeHtml(job.name)}</div>
                <div class="card-desc">${Game.util.escapeHtml(job.desc)}</div>
                <div class="card-meta">${reqText}</div>
                ${unlocked
                    ? `<button class="btn-small" data-job="${job.id}" ${active ? "disabled" : ""}>${active ? "ACTIVE" : "SELECT"}</button>`
                    : `<button class="btn-small" disabled>LOCKED</button>`}
            </div>
        `;
    }).join("");

    list.querySelectorAll("button[data-job]").forEach(btn => {
        btn.addEventListener("click", () => Game.jobs.select(btn.dataset.job));
    });
};

/* ---------- FIGHT ---------- */

Game.ui.renderFight = function () {
    const container = document.getElementById("panel-fight");
    const session = Game.combat.session;

    if (!session) {
        const enemies = Game.combat.unlockedEnemies();
        const bossUnlocked = Game.combat.bossUnlocked();
        const bossDefeated = Game.state.city.defeatedBosses.includes("the_rat");

        container.innerHTML = `
            <h2 class="panel-title">Find a Fight</h2>
            <div class="card-grid" id="enemyGrid"></div>
        `;
        const grid = document.getElementById("enemyGrid");

        if (bossUnlocked) {
            const bossCard = Game.util.el("div", "card boss-card");
            bossCard.innerHTML = `
                <div class="card-title">The Rat ${bossDefeated ? "(Defeated)" : "— BOSS"}</div>
                <div class="card-desc">Back Alley's boss. Beat it to prove you're more than a nobody.</div>
                <button class="btn-small btn-boss">CHALLENGE</button>
            `;
            bossCard.querySelector("button").addEventListener("click", () => Game.combat.start("the_rat", true));
            grid.appendChild(bossCard);
        }

        enemies.forEach(enemy => {
            const card = Game.util.el("div", "card");
            card.innerHTML = `
                <div class="card-title">${Game.util.escapeHtml(enemy.name)}</div>
                <div class="card-meta">HP ${enemy.health} · STR ${enemy.strength} · DEF ${enemy.defense}</div>
                <div class="card-meta">${Game.util.formatMoney(enemy.moneyMin)}–${Game.util.formatMoney(enemy.moneyMax)} · ${enemy.xp} XP</div>
                <button class="btn-small">FIGHT</button>
            `;
            card.querySelector("button").addEventListener("click", () => Game.combat.start(enemy.id));
            grid.appendChild(card);
        });
        return;
    }

    const playerPct = Game.util.clamp((session.playerHealth / session.playerMaxHealth) * 100, 0, 100);
    const enemyPct = Game.util.clamp((session.enemyHealth / session.enemyMaxHealth) * 100, 0, 100);
    const staminaPct = Game.util.clamp((session.stamina / session.maxStamina) * 100, 0, 100);

    container.innerHTML = `
        <h2 class="panel-title">${session.over ? "Fight Over" : `Fighting ${Game.util.escapeHtml(session.enemyName)}`}</h2>
        <div class="fight-arena">
            <div class="fight-side">
                <div class="fight-label">You</div>
                <div class="bar bar-health"><div class="bar-fill" style="width:${playerPct}%"></div></div>
                <div class="fight-sub">${Math.round(session.playerHealth)}/${session.playerMaxHealth} HP</div>
                <div class="bar bar-stamina"><div class="bar-fill" style="width:${staminaPct}%"></div></div>
                <div class="fight-sub">${Math.round(session.stamina)}/${session.maxStamina} Stamina</div>
            </div>
            <div class="fight-vs">VS</div>
            <div class="fight-side">
                <div class="fight-label">${Game.util.escapeHtml(session.enemyName)}</div>
                <div class="bar bar-enemy"><div class="bar-fill" style="width:${enemyPct}%"></div></div>
                <div class="fight-sub">${Math.round(session.enemyHealth)}/${session.enemyMaxHealth} HP</div>
            </div>
        </div>
        <div class="fight-log" id="fightLog">
            ${session.log.map(line => `<div>${Game.util.escapeHtml(line)}</div>`).join("")}
        </div>
        ${session.over
            ? `<button class="btn-primary" id="fightExitBtn">CONTINUE</button>`
            : `<div class="fight-actions">
                <button class="btn-action" data-action="attack">ATTACK</button>
                <button class="btn-action" data-action="heavy">HEAVY</button>
                <button class="btn-action" data-action="block">BLOCK</button>
                <button class="btn-action" data-action="rest">REST</button>
                <button class="btn-action btn-flee" data-action="flee">FLEE</button>
              </div>`
        }
    `;

    if (session.over) {
        document.getElementById("fightExitBtn").addEventListener("click", Game.combat.exit);
    } else {
        container.querySelectorAll("button[data-action]").forEach(btn => {
            btn.addEventListener("click", () => Game.combat.action(btn.dataset.action));
        });
    }
};

/* ---------- EQUIPMENT ---------- */

Game.ui.renderEquipment = function () {
    const slots = ["head", "body", "hands", "legs", "feet", "weapon"];
    const slotsEl = document.getElementById("equipSlots");
    slotsEl.innerHTML = slots.map(slot => {
        const itemId = Game.state.equipment[slot];
        const item = itemId ? Game.equipment.getItem(itemId) : null;
        return `
            <div class="equip-slot">
                <div class="equip-slot-label">${slot.toUpperCase()}</div>
                ${item
                    ? `<div class="equip-item-name" style="color:${Game.RARITY[item.rarity].color}">${Game.util.escapeHtml(item.name)}</div>
                       <div class="card-meta">${Game.ui.bonusText(item.bonuses)}</div>
                       <button class="btn-small" data-unequip="${slot}">UNEQUIP</button>`
                    : `<div class="equip-item-empty">Empty</div>`}
            </div>
        `;
    }).join("");
    slotsEl.querySelectorAll("button[data-unequip]").forEach(btn => {
        btn.addEventListener("click", () => Game.equipment.unequip(btn.dataset.unequip));
    });

    const inv = Game.equipment.owned();
    const invEl = document.getElementById("equipInventory");
    invEl.innerHTML = inv.length
        ? inv.map(item => `
            <div class="card">
                <div class="card-title" style="color:${Game.RARITY[item.rarity].color}">${Game.util.escapeHtml(item.name)}</div>
                <div class="card-meta">${Game.ui.bonusText(item.bonuses)}</div>
                <button class="btn-small" data-equip="${item.id}">EQUIP</button>
            </div>
        `).join("")
        : `<div class="empty-note">No unequipped items. Work, fight, or buy to find gear.</div>`;
    invEl.querySelectorAll("button[data-equip]").forEach(btn => {
        btn.addEventListener("click", () => Game.equipment.equip(btn.dataset.equip));
    });

    const shopEl = document.getElementById("equipShop");
    const shopItems = Game.ITEMS.filter(i => i.shopCost != null && !Game.equipment.isOwned(i.id));
    shopEl.innerHTML = shopItems.length
        ? shopItems.map(item => {
            const locked = Game.state.player.level < item.unlockLevel;
            return `
                <div class="card ${locked ? "locked" : ""}">
                    <div class="card-title" style="color:${Game.RARITY[item.rarity].color}">${Game.util.escapeHtml(item.name)}</div>
                    <div class="card-desc">${Game.util.escapeHtml(item.desc)}</div>
                    <div class="card-meta">${Game.ui.bonusText(item.bonuses)}</div>
                    ${locked
                        ? `<button class="btn-small" disabled>Needs Level ${item.unlockLevel}</button>`
                        : `<button class="btn-small" data-buy="${item.id}">BUY ${Game.util.formatMoney(item.shopCost)}</button>`}
                </div>
            `;
        }).join("")
        : `<div class="empty-note">Shop's empty for now. Check back after you level up.</div>`;
    shopEl.querySelectorAll("button[data-buy]").forEach(btn => {
        btn.addEventListener("click", () => Game.equipment.buy(btn.dataset.buy));
    });
};

Game.ui.bonusText = function (bonuses) {
    if (!bonuses) return "";
    return Object.entries(bonuses).map(([k, v]) => `+${v} ${k}`).join(" · ");
};

/* ---------- SKILLS ---------- */

Game.ui.renderSkills = function () {
    const container = document.getElementById("skillBranches");
    document.getElementById("skillPointsLabel").textContent =
        `${Game.state.player.skillPoints} skill point${Game.state.player.skillPoints === 1 ? "" : "s"} available`;

    container.innerHTML = Game.SKILL_BRANCHES.map(branch => `
        <div class="skill-branch">
            <div class="skill-branch-title">${Game.util.escapeHtml(branch.name)}</div>
            <div class="skill-branch-desc">${Game.util.escapeHtml(branch.desc)}</div>
            ${branch.skills.map(skill => {
                const owned = Game.skills.has(skill.id);
                const canBuy = Game.skills.canBuy(skill.id);
                return `
                    <div class="skill-node ${owned ? "owned" : ""}">
                        <div class="skill-node-name">${Game.util.escapeHtml(skill.name)} <span class="skill-node-level">Lv.${skill.level}</span></div>
                        <div class="skill-node-desc">${Game.util.escapeHtml(skill.desc)}</div>
                        ${owned
                            ? `<span class="skill-owned-tag">LEARNED</span>`
                            : `<button class="btn-small" data-skill="${skill.id}" ${canBuy ? "" : "disabled"}>LEARN (1 pt)</button>`}
                    </div>
                `;
            }).join("")}
        </div>
    `).join("");

    container.querySelectorAll("button[data-skill]").forEach(btn => {
        btn.addEventListener("click", () => Game.skills.buy(btn.dataset.skill));
    });
};

/* ---------- CITY ---------- */

Game.ui.renderCity = function () {
    const list = document.getElementById("cityList");
    list.innerHTML = Game.TERRITORIES.map(territory => {
        const unlocked = Game.city.isUnlocked(territory);
        const isCurrent = territory.id === "back_alley";
        return `
            <div class="card ${unlocked ? "" : "locked"} ${isCurrent ? "active" : ""}">
                <div class="card-title">${Game.util.escapeHtml(territory.name)}${isCurrent ? " (Current)" : ""}</div>
                <div class="card-desc">${unlocked ? Game.util.escapeHtml(territory.desc) : "???"}</div>
                <div class="card-meta">
                    ${unlocked
                        ? (territory.bossName ? `Boss: ${Game.util.escapeHtml(territory.bossName)}` : "No boss here")
                        : `Unlocks at ${Game.util.formatNumber(territory.unlockReputation)} Reputation`}
                </div>
                ${isCurrent ? `<div class="card-meta">Go to the FIGHT tab to challenge The Rat.</div>` : ""}
            </div>
        `;
    }).join("");
};

/* ---------- LOCKED PANELS (crew / businesses / new life) ---------- */

Game.ui.renderLockedPanel = function (tabId, module, blurb) {
    const el = document.getElementById(`panel-${tabId}`);
    const unlocked = module.isUnlocked();
    const progressLabel = module.unlockReputation !== undefined
        ? `${Game.util.formatNumber(Game.state.resources.reputation)} / ${Game.util.formatNumber(module.unlockReputation)} Reputation`
        : `Level ${Game.state.player.level} / ${module.unlockLevel}`;

    el.innerHTML = `
        <div class="locked-panel">
            <div class="locked-icon">${unlocked ? "🔓" : "🔒"}</div>
            <h2 class="panel-title">${unlocked ? "Coming soon" : "Locked"}</h2>
            <p>${Game.util.escapeHtml(blurb)}</p>
            <p class="locked-progress">${unlocked ? "Requirement met — this system arrives in a future update." : progressLabel}</p>
        </div>
    `;
};

/* ---------- MISSIONS ---------- */

Game.ui.renderMissions = function () {
    const list = document.getElementById("missionsList");
    list.innerHTML = Game.MISSIONS.map(mission => {
        const completed = Game.missions.isCompleted(mission.id);
        const progress = Math.min(mission.progress(), mission.target);
        const pct = Game.util.clamp((progress / mission.target) * 100, 0, 100);
        const claimable = Game.missions.isClaimable(mission);
        const rewardText = [
            mission.reward.money ? Game.util.formatMoney(mission.reward.money) : null,
            mission.reward.xp ? `${mission.reward.xp} XP` : null
        ].filter(Boolean).join(" + ");

        return `
            <div class="card ${completed ? "locked" : ""}">
                <div class="card-title">${Game.util.escapeHtml(mission.name)}</div>
                <div class="card-desc">${Game.util.escapeHtml(mission.desc)}</div>
                <div class="bar bar-mission"><div class="bar-fill" style="width:${pct}%"></div></div>
                <div class="card-meta">${completed ? "Completed" : `${Game.util.formatNumber(progress)} / ${Game.util.formatNumber(mission.target)}`} · Reward: ${rewardText}</div>
                ${completed
                    ? ""
                    : `<button class="btn-small" data-claim="${mission.id}" ${claimable ? "" : "disabled"}>${claimable ? "CLAIM" : "IN PROGRESS"}</button>`}
            </div>
        `;
    }).join("");

    list.querySelectorAll("button[data-claim]").forEach(btn => {
        btn.addEventListener("click", () => Game.missions.claim(btn.dataset.claim));
    });
};

/* ---------- ACHIEVEMENTS ---------- */

Game.ui.renderAchievements = function () {
    const grid = document.getElementById("achievementsGrid");
    grid.innerHTML = Game.ACHIEVEMENTS.map(a => {
        const unlocked = Game.achievements.isUnlocked(a.id);
        const name = a.secret && !unlocked ? "???" : (a.realName || a.name);
        const desc = a.secret && !unlocked ? "Secret achievement." : a.desc;
        return `
            <div class="achievement-badge ${unlocked ? "unlocked" : ""}">
                <div class="achievement-name">${Game.util.escapeHtml(name)}</div>
                <div class="achievement-desc">${Game.util.escapeHtml(desc)}</div>
            </div>
        `;
    }).join("");
};

/* ---------- TOASTS ---------- */

Game.ui.toast = function (message, type = "info") {
    const container = document.getElementById("toastContainer");
    const el = Game.util.el("div", `toast toast-${type}`, message);
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 300);
    }, 3200);
};

/* ---------- EVENT MODAL ---------- */

Game.ui.showEventModal = function (event) {
    document.getElementById("eventText").textContent = event.text;
    const choicesEl = document.getElementById("eventChoices");
    choicesEl.innerHTML = event.choices.map((c, i) => `<button class="btn-action" data-choice="${i}">${Game.util.escapeHtml(c.label)}</button>`).join("");

    choicesEl.querySelectorAll("button[data-choice]").forEach(btn => {
        btn.addEventListener("click", () => {
            const choice = event.choices[Number(btn.dataset.choice)];
            const outcome = choice.resolve();
            Game.ui.toggleModal("eventModal", false);
            if (outcome) {
                Game.player.log(outcome);
                Game.ui.toast(outcome, "event");
            } else {
                Game.ui.switchTab("fight");
            }
            Game.ui.renderHud();
            Game.ui.renderHome();
        }, { once: true });
    });

    Game.ui.toggleModal("eventModal", true);
};

/* ---------- WELCOME BACK MODAL ---------- */

Game.ui.showWelcomeBack = function (result) {
    document.getElementById("welcomeAwayTime").textContent = Game.util.formatDuration(result.elapsedMs);
    document.getElementById("welcomeGains").innerHTML = `
        <div>+${Game.util.formatMoney(result.money)}</div>
        <div>+${result.energy} Energy</div>
        <div>${result.food >= 0 ? "+" : ""}${result.food} Food</div>
        <div>Events encountered while away: ${result.events}</div>
    `;
    Game.ui.toggleModal("welcomeModal", true);
};

/* ---------- MODALS / SETTINGS ---------- */

Game.ui.toggleModal = function (id, show) {
    document.getElementById(id).hidden = !show;
};

Game.ui.handleExport = function () {
    const textarea = document.getElementById("saveTextarea");
    textarea.value = Game.save.exportText();
    textarea.select();
    try {
        navigator.clipboard?.writeText(textarea.value);
        Game.ui.toast("Save copied to clipboard.", "good");
    } catch (e) {
        Game.ui.toast("Save shown below — copy it manually.", "info");
    }
};

Game.ui.handleImport = function () {
    const textarea = document.getElementById("saveTextarea");
    if (!textarea.value.trim()) {
        Game.ui.toast("Paste your save data first.", "warn");
        return;
    }
    Game.save.importText(textarea.value.trim());
};

Game.ui.handleReset = function () {
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    Game.save.reset();
};

Game.ui.toggleSound = function () {
    Game.state.settings.soundEnabled = !Game.state.settings.soundEnabled;
    Game.ui.updateSoundLabel();
    if (Game.state.settings.soundEnabled) Game.audio.click();
};

Game.ui.updateSoundLabel = function () {
    document.getElementById("soundToggleBtn").innerHTML =
        Game.state.settings.soundEnabled ? "&#128266; Sound" : "&#128263; Sound";
};
