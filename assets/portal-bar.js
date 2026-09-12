/* Injects the shared "back to Playground" bar. See portal-bar.css
   for the two-line include and the host page's layout requirement. */

(function () {
    const bar = document.createElement("div");
    bar.className = "portal-bar";
    bar.innerHTML = `
        <a href="../../index.html">
            <span class="portal-bar-arrow" aria-hidden="true">←</span>
            <span class="portal-bar-mark">P</span>
            <span>Playground</span>
        </a>
    `;

    document.body.insertBefore(bar, document.body.firstChild);
})();
