/* =========================================================
   SAVE
   localStorage persistence: autosave, manual save, export
   (as copyable JSON text), import (validated, never crashes
   on bad input), and reset.
========================================================= */

Game.save = {};

Game.save.write = function () {
    Game.state.meta.lastSaved = Date.now();
    try {
        localStorage.setItem(Game.SAVE_KEY, JSON.stringify(Game.state));
        return true;
    } catch (e) {
        return false;
    }
};

Game.save.isValidSave = function (data) {
    return (
        data &&
        typeof data === "object" &&
        data.resources &&
        data.player &&
        typeof data.player.level === "number" &&
        typeof data.resources.money === "number"
    );
};

Game.save.load = function () {
    let raw;
    try {
        raw = localStorage.getItem(Game.SAVE_KEY);
    } catch (e) {
        return false;
    }
    if (!raw) return false;

    try {
        const data = JSON.parse(raw);
        if (!Game.save.isValidSave(data)) return false;
        Game.state = Object.assign(createDefaultState(), data);
        Game.state.resources = Object.assign(createDefaultState().resources, data.resources);
        Game.state.player = Object.assign(createDefaultState().player, data.player);
        Game.state.equipment = Object.assign(createDefaultState().equipment, data.equipment || {});
        Game.state.stats = Object.assign(createDefaultState().stats, data.stats || {});
        Game.state.city = Object.assign(createDefaultState().city, data.city || {});
        return true;
    } catch (e) {
        return false;
    }
};

Game.save.manualSave = function () {
    if (Game.save.write()) {
        Game.ui.toast("Game saved.", "good");
    } else {
        Game.ui.toast("Could not save (storage unavailable).", "warn");
    }
};

Game.save.exportText = function () {
    return JSON.stringify(Game.state);
};

Game.save.importText = function (text) {
    try {
        const data = JSON.parse(text);
        if (!Game.save.isValidSave(data)) {
            Game.ui.toast("That save file looks invalid.", "warn");
            return false;
        }
        Game.state = Object.assign(createDefaultState(), data);
        Game.save.write();
        Game.ui.toast("Save imported.", "good");
        Game.ui.renderAll();
        return true;
    } catch (e) {
        Game.ui.toast("Could not read that save data.", "warn");
        return false;
    }
};

Game.save.reset = function () {
    try {
        localStorage.removeItem(Game.SAVE_KEY);
    } catch (e) {
        /* ignore */
    }
    Game.resetState();
    Game.ui.renderAll();
    Game.ui.toast("Fresh start. Good luck out there.", "good");
};
