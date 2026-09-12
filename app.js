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
    }
];


/* =========================================================
   HELPERS
========================================================= */

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


/* =========================================================
   RENDER: FEATURED CARD
========================================================= */

function renderFeatured() {
    const container = document.getElementById("featuredCard");
    if (!container) return;

    const featuredGame = games.find(game => game.featured);

    if (!featuredGame) {
        container.style.display = "none";
        return;
    }

    container.innerHTML = `
        <div class="featured-glow" aria-hidden="true"></div>
        <div class="featured-content">
            <div class="featured-label">Featured game</div>
            <h2>${featuredGame.title}</h2>
            <p>${featuredGame.description}</p>
            <a href="games/${featuredGame.slug}/" class="play-button">
                Play Game
                <span aria-hidden="true">→</span>
            </a>
        </div>
    `;

    if (featuredGame.image) {
        container.classList.add("has-image");
        container.style.backgroundImage = `
            linear-gradient(120deg, rgba(13, 15, 21, 0.55), rgba(13, 15, 21, 0.88)),
            url('${featuredGame.image}')
        `;
    }
}


/* =========================================================
   RENDER: GAME GRID
========================================================= */

function renderGames() {
    const grid = document.getElementById("gameGrid");

    grid.innerHTML = games.map(game => {
        const available = isAvailable(game);
        const categoryLower = game.category.toLowerCase();

        const imageStyle = game.image ? ` style="background-image: url('${game.image}')"` : "";
        const imageIcon = game.image ? "" : `<div class="game-icon">${initials(game.title)}</div>`;

        const inner = `
            <div class="game-image${game.image ? " has-image" : ""}"${imageStyle}>
                ${imageIcon}
            </div>
            <div class="game-info">
                <div class="game-meta">
                    <span class="game-category">${game.category}</span>
                    <span class="game-status${available ? "" : " is-soon"}">${game.status}</span>
                </div>
                <h3>${game.title}</h3>
                <p>${game.description}</p>
                <div class="game-link${available ? "" : " is-disabled"}">
                    <span>${available ? "Play now" : "Coming soon"}</span>
                    <span aria-hidden="true">→</span>
                </div>
            </div>
        `;

        if (available) {
            return `
                <article class="game-card" data-category="${categoryLower}" data-title="${game.title}">
                    <a href="games/${game.slug}/">${inner}</a>
                </article>
            `;
        }

        return `
            <article class="game-card is-disabled" data-category="${categoryLower}" data-title="${game.title}" aria-disabled="true">
                ${inner}
            </article>
        `;
    }).join("");
}


/* =========================================================
   FILTERING + SEARCH
========================================================= */

function setupControls() {
    const filters = document.querySelectorAll(".filter");
    const searchInput = document.getElementById("searchInput");
    const emptyState = document.getElementById("emptyState");

    let activeCategory = "all";

    function updateGames() {
        const cards = document.querySelectorAll(".game-card");
        const searchTerm = searchInput.value.toLowerCase().trim();

        let visibleGames = 0;

        cards.forEach(card => {
            const category = card.dataset.category;
            const title = card.dataset.title.toLowerCase();

            const matchesCategory = activeCategory === "all" || category === activeCategory;
            const matchesSearch = title.includes(searchTerm);

            if (matchesCategory && matchesSearch) {
                card.style.display = "";
                visibleGames++;
            } else {
                card.style.display = "none";
            }
        });

        emptyState.style.display = visibleGames === 0 ? "block" : "none";
    }

    filters.forEach(filter => {
        filter.addEventListener("click", () => {
            filters.forEach(button => button.classList.remove("active"));
            filter.classList.add("active");

            activeCategory = filter.dataset.category;
            updateGames();
        });
    });

    searchInput.addEventListener("input", updateGames);
}


/* =========================================================
   INIT
========================================================= */

renderFeatured();
renderGames();
setupControls();
