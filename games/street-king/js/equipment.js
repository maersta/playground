/* =========================================================
   EQUIPMENT
   Items, slots, rarity, and the small shop used to buy gear
   that isn't found through work/combat/missions.
========================================================= */

Game.RARITY = {
    common: { name: "Common", color: "#9aa1ab" },
    uncommon: { name: "Uncommon", color: "#5fd06a" },
    rare: { name: "Rare", color: "#5b9bff" },
    epic: { name: "Epic", color: "#c26bff" },
    legendary: { name: "Legendary", color: "#ffb020" }
};

Game.ITEMS = [
    { id: "broken_stick", name: "Broken Stick", slot: "weapon", rarity: "common",
      bonuses: { strength: 2 }, shopCost: 15, unlockLevel: 1,
      desc: "Better than fists. Barely." },
    { id: "old_hoodie", name: "Old Hoodie", slot: "body", rarity: "common",
      bonuses: { defense: 1 }, shopCost: 15, unlockLevel: 1,
      desc: "Smells like someone else's life." },
    { id: "work_gloves", name: "Work Gloves", slot: "hands", rarity: "common",
      bonuses: { strength: 1 }, shopCost: 20, unlockLevel: 1,
      desc: "Fewer splinters, more grip." },
    { id: "cheap_shoes", name: "Cheap Shoes", slot: "feet", rarity: "common",
      bonuses: { defense: 1 }, shopCost: 20, unlockLevel: 1,
      desc: "They fit. Mostly." },

    { id: "baseball_bat", name: "Baseball Bat", slot: "weapon", rarity: "uncommon",
      bonuses: { strength: 6 }, special: "stun10", shopCost: 250, unlockLevel: 6,
      desc: "10% chance to stun on a heavy attack." },
    { id: "leather_jacket", name: "Leather Jacket", slot: "body", rarity: "uncommon",
      bonuses: { defense: 5, health: 6 }, shopCost: 300, unlockLevel: 6,
      desc: "Looks tough. Actually is tough." },
    { id: "steel_toe_boots", name: "Steel-Toe Boots", slot: "feet", rarity: "uncommon",
      bonuses: { defense: 4, strength: 1 }, shopCost: 220, unlockLevel: 6,
      desc: "Kicks hit different now." },

    { id: "combat_knife", name: "Combat Knife", slot: "weapon", rarity: "rare",
      bonuses: { strength: 10 }, special: "crit8", shopCost: 1200, unlockLevel: 14,
      desc: "+8% critical hit chance. Don't ask where it's been." },
    { id: "reinforced_jacket", name: "Reinforced Jacket", slot: "body", rarity: "rare",
      bonuses: { defense: 10, health: 14 }, shopCost: 1500, unlockLevel: 14,
      desc: "Padded, plated, and paid for in blood money." },
    { id: "heavy_boots", name: "Heavy Boots", slot: "feet", rarity: "rare",
      bonuses: { defense: 7, strength: 1 }, shopCost: 1100, unlockLevel: 14,
      desc: "Steel plates. Steady stance." },

    { id: "enforcer_helmet", name: "Enforcer Helmet", slot: "head", rarity: "epic",
      bonuses: { defense: 12, health: 10 }, shopCost: 6000, unlockLevel: 24,
      desc: "Nobody sees your face. Nobody forgets your name." },
    { id: "kingpins_ring", name: "Kingpin's Ring", slot: "hands", rarity: "epic",
      bonuses: { luck: 6, charisma: 6 }, shopCost: 7000, unlockLevel: 24,
      desc: "Everyone at the table notices it." },

    { id: "crown_of_the_streets", name: "Crown of the Streets", slot: "head", rarity: "legendary",
      bonuses: { strength: 8, defense: 8, luck: 8, charisma: 8, health: 20 }, shopCost: null, unlockLevel: 30,
      desc: "Not for sale. You take this, or you earn it." }
];

Game.equipment = {};

Game.equipment.getItem = function (id) {
    return Game.ITEMS.find(i => i.id === id) || null;
};

Game.equipment.owned = function () {
    return Game.state.inventory.map(Game.equipment.getItem).filter(Boolean);
};

Game.equipment.isOwned = function (id) {
    return Game.state.inventory.includes(id) || Object.values(Game.state.equipment).includes(id);
};

Game.equipment.totalBonus = function (stat) {
    let total = 0;
    for (const itemId of Object.values(Game.state.equipment)) {
        if (!itemId) continue;
        const item = Game.equipment.getItem(itemId);
        if (item && item.bonuses && item.bonuses[stat]) total += item.bonuses[stat];
    }
    return total;
};

Game.equipment.hasSpecial = function (key) {
    for (const itemId of Object.values(Game.state.equipment)) {
        if (!itemId) continue;
        const item = Game.equipment.getItem(itemId);
        if (item && item.special === key) return true;
    }
    return false;
};

Game.equipment.grant = function (itemId, { silent = false } = {}) {
    if (Game.equipment.isOwned(itemId)) return false;
    Game.state.inventory.push(itemId);
    Game.state.stats.itemsFound++;
    const item = Game.equipment.getItem(itemId);
    if (!silent && item) {
        Game.ui.toast(`Found: ${item.name} (${Game.RARITY[item.rarity].name})`, "item");
    }
    Game.missions.checkAll();
    Game.achievements.checkAll();
    return true;
};

Game.equipment.rollDrop = function (luck) {
    const dropChance = Game.util.clamp(0.03 + luck * 0.004, 0.02, 0.18);
    if (!Game.util.chance(dropChance)) return null;

    const level = Game.state.player.level;
    const pool = Game.ITEMS.filter(i => i.unlockLevel <= level + 3 && !Game.equipment.isOwned(i.id) && i.rarity !== "legendary");
    if (pool.length === 0) return null;

    const weighted = pool.map(item => ({
        item,
        weight: item.rarity === "common" ? 40 : item.rarity === "uncommon" ? 18 : item.rarity === "rare" ? 6 : 2
    }));
    const chosen = Game.util.weightedPick(weighted).item;
    Game.equipment.grant(chosen.id);
    return chosen;
};

Game.equipment.equip = function (itemId) {
    const item = Game.equipment.getItem(itemId);
    if (!item || !Game.state.inventory.includes(itemId)) return;

    const currentlyEquipped = Game.state.equipment[item.slot];
    if (currentlyEquipped) Game.state.inventory.push(currentlyEquipped);

    Game.state.inventory = Game.state.inventory.filter(id => id !== itemId);
    Game.state.equipment[item.slot] = itemId;

    Game.audio.click();
    Game.player.log(`Equipped ${item.name}.`);
    Game.ui.renderEquipment();
    Game.ui.renderHud();
};

Game.equipment.unequip = function (slot) {
    const itemId = Game.state.equipment[slot];
    if (!itemId) return;
    Game.state.equipment[slot] = null;
    Game.state.inventory.push(itemId);
    Game.ui.renderEquipment();
    Game.ui.renderHud();
};

Game.equipment.buy = function (itemId) {
    const item = Game.equipment.getItem(itemId);
    if (!item || item.shopCost == null) return;
    if (Game.equipment.isOwned(itemId)) return;
    if (!Game.player.spendMoney(item.shopCost)) {
        Game.ui.toast("Not enough money for that.", "warn");
        return;
    }
    Game.state.inventory.push(itemId);
    Game.audio.purchase();
    Game.player.log(`Bought ${item.name}.`);
    Game.ui.renderEquipment();
    Game.ui.renderHud();
};
