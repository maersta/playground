# Little Tides

A cozy, hand-drawn fishing and collection game for the browser. Steer a little wooden boat, cast your line, sell your catch in the harbor, upgrade your gear, and fill an illustrated fish book across seven seas.

Everything in the game world (boats, fishermen, fish, pets, water, islands, effects) is drawn procedurally on an HTML Canvas, and all sound is generated with the Web Audio API. There are no images, fonts, frameworks, build steps or backend services. Progress is saved in your browser's `localStorage`.

## Run it locally

The game uses ES modules, so it must be served over HTTP (opening `index.html` directly from disk will not work in most browsers). Any static server works:

Just double-click `index.html`: the game ships as a pre-built classic script (`js/bundle.js`), so no server is needed. If you edit files in `js/`, run `python build.py` to regenerate the bundle.

```bash
# Python 3 (no install needed)
python -m http.server 8000
# then open http://localhost:8000
```

```bash
# or Node
npx serve .
```

## Publish on GitHub Pages

1. Put this folder's contents in a GitHub repository (so `index.html` is at the root, or in a `/docs` folder).
2. In the repository go to **Settings -> Pages**.
3. Under **Build and deployment** choose **Deploy from a branch**, pick your branch (e.g. `main`) and the `/ (root)` folder (or `/docs`), then **Save**.
4. After a minute the game is live at `https://<user>.github.io/<repo>/`.

All asset paths are relative, so it also works from a sub-path.

## Controls

| Key | Action |
| --- | --- |
| `A` / `D` or `Left` / `Right` | Steer the boat |
| `W` / `S` or `Up` / `Down` | Choose fishing depth (the depth bar on the right is clickable too) |
| `SPACE` | Cast the line (also dismisses a catch card) |
| `H` | Toggle harbor / set sail |
| `M`, `B`, `C`, `P` | World map, fish book, cargo, pets |
| `ESC` | Close the open menu, or open the pause menu |
| `Enter` | Confirm the primary action in a menu |

There are no reflex minigames: cast, wait, and the line retrieves automatically.

## How the game works

* **Fish** in seven zones (84 species). Depth, hook size, bait, rod, boosts, pets and time of day shape what can bite.
* **Cargo** is limited by your boat. When it is full, casting is blocked; sail to the **harbor** and sell manually (use the star to protect favourites).
* **Upgrades:** 7 rods, 6 lines, 6 hooks, 10 baits, 7 boats and 6 temporary boosts. Rods speed up bites, lines set max depth, hooks set the largest fish you can land, baits steer *which* species show up.
* **Zones unlock** from boats, lines, rods, hooks and discoveries (see the World Map for each checklist). The Forgotten Trench also needs the Trench Chart (three map fragments hidden in Coral Garden, Twilight Deep and Frostfall Sea).
* **Fish Book**, personal records, collection milestones (25/50/75/100% per zone and overall), harbor requests (up to 3 active), 6 companions, secrets, junk and treasure.
* **Lighthouse (prestige)** is optional and requires 45 discovered species plus Twilight Deep. It resets coins/gear/zones but keeps the book, records, pets, secrets and cosmetics, and awards Tide Stars for permanent bonuses.
* No offline progression: time only passes while the game is open and unpaused. Menus pause fishing timers.

## Project structure

```
index.html        page shell (canvas + HUD + modal roots)
style.css         storybook UI theme
js/
  main.js         entry point, requestAnimationFrame loop, saving hooks
  game.js         central Game object: owns the one state tree, player actions, zone unlocks
  config.js       global balance constants (rarities, bite times, caps, prestige...)
  fish-data.js    84 species + junk + treasure definitions
  zone-data.js    zone themes, unlock requirements, map positions
  upgrades.js     rods/lines/hooks/baits/boats/boosts data + getEffects() (all bonuses in one place)
  economy.js      earning, spending, pricing, shop purchases
  inventory.js    cargo hold, favourites, selling
  fishing.js      encounter tables, catch/size generation, fishing state machine
  fish-book.js    discoveries, records, completion, milestones
  pets.js         companions and their unlock rules
  quests.js       harbor requests
  secrets.js      secrets, map fragments, sealed bottles
  prestige.js     optional prestige
  save.js         versioned localStorage save, validation, migration, import/export
  audio.js        generated music, ambience and sound effects
  input.js        keyboard handling
  renderer.js     canvas scenes (sea, harbor), particles
  draw.js         hand-drawn style helpers, boats, fisherman, pets
  fish-art.js     fish bodies, loot and gear illustrations
  ui.js           HUD, menus, map, catch card, toasts
  events.js       tiny pub/sub bus
```

## Tuning the game

* **Economy / prices:** equipment, bait and boost prices are in `js/upgrades.js`. Zone fish values are `zoneBase` in `js/config.js` (each species multiplies it by a value factor in `fish-data.js`). Rarity sale multipliers are in `CONFIG.rarities[].mult`. Selling bonuses (pets, boosts, prestige) are combined in `getEffects()`.
* **Rarity rates:** `CONFIG.rarities[].prob` are the baseline probabilities. The encounter table in `buildTable()` (`js/fishing.js`) normalises over whatever species are eligible, and `CONFIG.rarityCaps` limits how far bonuses can push Legendary/Mythic.
* **Bite times / casting:** `CONFIG.fishing` (bite interval, retrieval time, depth step, junk/treasure/variant chances).
* **Add or change a species:** add a row in the matching zone list in `js/fish-data.js` (name, rarity letter, weight/length, depth layers `S/M/D`, body type, colours, pattern, bait tags, spawn weight, value factor). IDs are generated from the name. Special requirements (night-only, specific bait, rod tier) go in `SPECIES_REQ`. Body types are drawn in `js/fish-art.js`.
* **Zone progression:** each zone's `req` in `js/zone-data.js` (`boat`, `rod`, `line`, `hook` tier indices, `prev: {zone, count}` discoveries, and `secret`).
* **Pets / boosts / milestones / quests:** `js/pets.js`, `BOOSTS` in `js/upgrades.js`, `rewardFor()` in `js/fish-book.js`, `js/quests.js` (reward formulas) and `CONFIG.quests`.

## Saving

The game autosaves every 15 seconds, after every important event, and when the tab is hidden or closed. **Settings -> Save data** lets you download/import a backup, and erase everything. A corrupted save is backed up under `little-tides-save-corrupt-backup` and a fresh game starts.

## Notes

Developed and sanity-checked in a desktop browser (rendering, fishing loop, shops, selling, saving, import/export, keyboard input and every menu screen were exercised). It has not been through a full playthrough of all seven zones, so balance numbers in particular are first-pass targets.
