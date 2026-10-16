/* =========================================================
   GAME DATA

   To add a new game later, add one entry to this array.
   Nothing else needs to change — cards, filters and search
   are all rendered/derived from this list.
========================================================= */

const games = [
    {
        title: "Tower Defence",
        slug: "tower-defence",
        category: "Arcade",
        status: "Available",
        description: "Place towers, hold the line and survive wave after wave.",
        image: "assets/screenshots/tower-defence.png",
        featured: true
    },
    {
        title: "Bloody Tic-Tac-Toe",
        slug: "bloody-tic-tac-toe",
        category: "Casual",
        status: "Available",
        description: "Classic tic-tac-toe, except The Curse plays perfectly and always wants your soul.",
        image: "assets/screenshots/bloody-tic-tac-toe.png"
    },
    {
        title: "Wild Reels",
        slug: "wild-reels",
        category: "Casual",
        status: "Available",
        description: "A 10-line slot machine with wilds and free spins. Starts you off with $100 in fake money.",
        image: "assets/screenshots/wild-reels.png"
    },
    {
        title: "Dachshund Dash",
        slug: "dachshund-dash",
        category: "Arcade",
        status: "Available",
        description: "The classic snake game, but you're a dachshund chasing a bone. Don't bite your own tail.",
        image: "assets/screenshots/dachshund-dash.png"
    },
    {
        title: "Street King",
        slug: "street-king",
        category: "Experimental",
        status: "Available",
        description: "A gritty clicker/idle RPG. Start homeless and broke, work the streets, fight your way up, and take over the city.",
        image: "assets/screenshots/street-king.png"
    },
    {
        title: "Little Tides",
        slug: "Little Tides",
        category: "Casual",
        status: "Available",
        description: "A cozy, hand-drawn fishing game. Catch 84 fish across seven seas, upgrade your boat and fill your fish book.",
        image: "assets/screenshots/little-tides.png"
    },
    {
        title: "Little Ocean",
        slug: "Little Ocean",
        category: "Casual",
        status: "Available",
        description: "A cozy tale of growing up in the deep blue. Swim, eat, evolve and pick upgrades each run.",
        image: "assets/screenshots/little-ocean.png"
    },
    {
        title: "Triangle Breakout",
        slug: "Triangle Breakout",
        category: "Experimental",
        status: "Available",
        description: "A breakout-style incremental: buy upgrades, escape cores and permanent progression.",
        image: "assets/screenshots/triangle-breakout.png"
    },
    {
        title: "Pixel Tower Defense",
        slug: "TOWERDEFENCE YO",
        category: "Arcade",
        status: "Available",
        description: "Pixel-style tower defense with archers, cannons, frost and snipers across 10 waves.",
        image: "assets/screenshots/pixel-tower-defense.png"
    },
    {
        title: "MOPS - Pug Slingshot",
        slug: "PugShot",
        category: "Arcade",
        status: "Available",
        description: "Sling a pug across the land in a pixel-art launcher with coins, upgrades and daily gifts.",
        image: "assets/screenshots/mops-pug-slingshot.png"
    },
    {
        title: "FIST CLUB",
        slug: "MEGAFIGHTER",
        category: "Arcade",
        status: "Available",
        description: "A fighting game with levels, combat log and achievements. Step into the ring.",
        image: "assets/screenshots/fist-club.png"
    },
    {
        title: "Asphalt All-Stars",
        slug: "Streetworks TheGame",
        category: "Casual",
        status: "Available",
        description: "A Streetworks painting competition. Move, aim and paint the asphalt against your coworkers.",
        image: "assets/screenshots/asphalt-all-stars.png"
    }
];


/* =========================================================
   HELPERS
========================================================= */

const FAV_KEY = "playground:favorites";

function initials(title) {
    return title
        .split(" ")
        .map(word => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function isAvailable(game) {
    return game.status.toLowerCase() === "available";
}

function gameUrl(game) {
    return `games/${encodeURIComponent(game.slug)}/`;
}

function loadFavorites() {
    try {
        const saved = JSON.parse(localStorage.getItem(FAV_KEY));
        return new Set(Array.isArray(saved) ? saved : []);
    } catch (e) {
        return new Set();
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
    } catch (e) {
        /* storage unavailable: favourites last for this visit only */
    }
}

const favorites = loadFavorites();
const playable = games.filter(isAvailable);


/* =========================================================
   RENDER: HERO (featured game, stats, ticker)
========================================================= */

function renderFeatured() {
    const container = document.getElementById("featuredCard");
    const featuredGame = games.find(game => game.featured) || playable[0];

    if (!featuredGame) {
        container.style.display = "none";
        return;
    }

    const bg = featuredGame.image
        ? ` style="background-image: url('${featuredGame.image}')"`
        : "";

    container.innerHTML = `
        <a class="feature-cabinet" href="${gameUrl(featuredGame)}">
            <span class="feature-sticker">★ Featured</span>
            <span class="feature-screen${featuredGame.image ? " has-image" : ""}"${bg}>
                <span class="feature-play" aria-hidden="true">▶</span>
            </span>
            <span class="feature-info">
                <span class="feature-text">
                    <span class="feature-cat">${featuredGame.category}</span>
                    <strong>${featuredGame.title}</strong>
                    <span class="feature-desc">${featuredGame.description}</span>
                </span>
                <span class="feature-go">Play</span>
            </span>
        </a>
    `;
}

function renderStats() {
    const categories = new Set(games.map(game => game.category));

    document.getElementById("heroStats").innerHTML = `
        <div class="stat"><strong>${playable.length}</strong><span>Games</span></div>
        <div class="stat"><strong>${categories.size}</strong><span>Genres</span></div>
        <div class="stat"><strong>0</strong><span>Sign-ups</span></div>
    `;
}

function renderTicker() {
    const items = games.map(game => `<span>★ ${game.title}</span>`).join("");
    // doubled so the CSS loop is seamless
    document.getElementById("tickerTrack").innerHTML = items + items;
}


/* =========================================================
   RENDER: GAME GRID
========================================================= */

function renderGames() {
    const grid = document.getElementById("gameGrid");

    grid.innerHTML = games.map((game, index) => {
        const available = isAvailable(game);
        const categoryLower = game.category.toLowerCase();
        const isFav = favorites.has(game.slug);

        const imageStyle = game.image ? ` style="background-image: url('${game.image}')"` : "";
        const imageIcon = game.image ? "" : `<div class="game-icon">${initials(game.title)}</div>`;

        const inner = `
            <div class="game-image${game.image ? " has-image" : ""}"${imageStyle}>
                ${imageIcon}
                <span class="game-category">${game.category}</span>
            </div>
            <div class="game-info">
                <h3>${game.title}</h3>
                <p>${game.description}</p>
                <div class="game-link${available ? "" : " is-disabled"}">
                    <span class="game-status${available ? "" : " is-soon"}">● ${available ? "Ready" : game.status}</span>
                    <span class="game-cta">${available ? 'Play <i aria-hidden="true">▶</i>' : "Coming soon"}</span>
                </div>
            </div>
        `;

        const fav = `
            <button class="fav-btn${isFav ? " is-fav" : ""}" type="button"
                    data-slug="${game.slug}"
                    aria-pressed="${isFav}"
                    aria-label="Favourite ${game.title}">♥</button>
        `;

        const attrs = `data-category="${categoryLower}" data-title="${game.title}" data-slug="${game.slug}" style="--i: ${index}"`;

        if (available) {
            return `
                <article class="game-card" ${attrs}>
                    <a href="${gameUrl(game)}">${inner}</a>
                    ${fav}
                </article>
            `;
        }

        return `
            <article class="game-card is-disabled" ${attrs} aria-disabled="true">
                ${inner}
            </article>
        `;
    }).join("");
}


/* =========================================================
   FILTERING + SEARCH + FAVOURITES
========================================================= */

function setupControls() {
    const filters = document.querySelectorAll(".filter");
    const searchInput = document.getElementById("searchInput");
    const emptyState = document.getElementById("emptyState");
    const emptyHint = document.getElementById("emptyHint");
    const grid = document.getElementById("gameGrid");
    const favCount = document.getElementById("favCount");

    let activeCategory = "all";

    // show how many games sit in each category
    filters.forEach(filter => {
        const cat = filter.dataset.category;
        if (cat === "favorites") return;

        const count = cat === "all"
            ? games.length
            : games.filter(game => game.category.toLowerCase() === cat).length;

        filter.insertAdjacentHTML("beforeend", `<em>${count}</em>`);
    });

    function updateGames() {
        const cards = document.querySelectorAll(".game-card");
        const searchTerm = searchInput.value.toLowerCase().trim();

        let visibleGames = 0;

        cards.forEach(card => {
            const category = card.dataset.category;
            const title = card.dataset.title.toLowerCase();

            const matchesCategory =
                activeCategory === "all" ||
                (activeCategory === "favorites" ? favorites.has(card.dataset.slug) : category === activeCategory);
            const matchesSearch = title.includes(searchTerm);

            if (matchesCategory && matchesSearch) {
                card.style.display = "";
                visibleGames++;
            } else {
                card.style.display = "none";
            }
        });

        emptyHint.textContent = activeCategory === "favorites" && !searchTerm
            ? "Tap the heart on a game to save it here."
            : "Try a different search or category.";
        emptyState.style.display = visibleGames === 0 ? "flex" : "none";
        favCount.textContent = favorites.size;
    }

    function selectCategory(category) {
        activeCategory = category;
        filters.forEach(button => button.classList.toggle("active", button.dataset.category === category));
        updateGames();
    }

    filters.forEach(filter => {
        filter.addEventListener("click", () => selectCategory(filter.dataset.category));
    });

    searchInput.addEventListener("input", updateGames);

    grid.addEventListener("click", event => {
        const btn = event.target.closest(".fav-btn");
        if (!btn) return;

        const slug = btn.dataset.slug;
        if (favorites.has(slug)) favorites.delete(slug);
        else favorites.add(slug);

        btn.classList.toggle("is-fav", favorites.has(slug));
        btn.setAttribute("aria-pressed", favorites.has(slug));
        saveFavorites();
        updateGames();
    });

    document.getElementById("favNav").addEventListener("click", () => {
        selectCategory("favorites");
        document.getElementById("games").scrollIntoView({ behavior: "smooth" });
    });

    updateGames();
}

function setupSurprise() {
    const go = () => {
        if (!playable.length) return;
        const pick = playable[Math.floor(Math.random() * playable.length)];
        window.location.href = gameUrl(pick);
    };

    document.getElementById("surpriseNav").addEventListener("click", go);
    document.getElementById("surpriseHero").addEventListener("click", go);
}


/* =========================================================
   INIT
========================================================= */

renderFeatured();
renderStats();
renderTicker();
renderGames();
setupControls();
setupSurprise();
