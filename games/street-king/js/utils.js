/* =========================================================
   UTILS
   Shared namespace + generic helpers used by every module.
   Loaded first: `Game` is declared here and every other file
   attaches to it (classic scripts share one global scope).
========================================================= */

const Game = {};

Game.util = {
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    },

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    chance(probability) {
        return Math.random() < probability;
    },

    pick(list) {
        return list[Game.util.randInt(0, list.length - 1)];
    },

    weightedPick(entries) {
        const total = entries.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * total;
        for (const entry of entries) {
            roll -= entry.weight;
            if (roll <= 0) return entry;
        }
        return entries[entries.length - 1];
    },

    formatMoney(amount) {
        const n = Math.floor(amount);
        const sign = n < 0 ? "-" : "";
        const abs = Math.abs(n);

        if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
        if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
        return `${sign}$${abs.toLocaleString("en-US")}`;
    },

    formatNumber(amount) {
        const n = Math.floor(amount);
        if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
        if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toLocaleString("en-US");
    },

    formatDuration(ms) {
        const totalMinutes = Math.floor(ms / 60000);
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    round1(n) {
        return Math.round(n * 10) / 10;
    },

    el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    },

    escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
};
