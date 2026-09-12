/* =========================================================
   GAME DATA

   To add a new game later, add one entry to this array.
   Nothing else needs to change — cards, filters and search
   are all rendered/derived from this list.
========================================================= */

const games = [
    {
        title: "Brutal Questions",
        slug: "brutal-questions",
        category: "Party",
        status: "Available",
        description: "A party game filled with questions you probably shouldn't ask.",
        featured: true
    },
    {
        title: "Ball Drop",
        slug: "ball-drop",
        category: "Arcade",
        status: "Available",
        description: "Drop the ball, dodge the chaos and chase a higher score."
    },
    {
        title: "Tower Defence",
        slug: "tower-defence",
        category: "Arcade",
        status: "Available",
        description: "Place towers, hold the line and survive wave after wave."
    },
    {
        title: "Something New",
        slug: "something-new",
        category: "Casual",
        status: "Coming Soon",
        description: "A relaxed casual game that's still taking shape."
    },
    {
        title: "Another Game",
        slug: "another-game",
        category: "Experimental",
        status: "Coming Soon",
        description: "A weird little experiment we're not ready to talk about yet."
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
    const featuredGame = games.find(game => game.featured);
    const container = document.getElementById("featuredCard");

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
}


/* =========================================================
   RENDER: GAME GRID
========================================================= */

function renderGames() {
    const grid = document.getElementById("gameGrid");

    grid.innerHTML = games.map(game => {
        const available = isAvailable(game);
        const categoryLower = game.category.toLowerCase();

        const inner = `
            <div class="game-image">
                <div class="game-icon">${initials(game.title)}</div>
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
