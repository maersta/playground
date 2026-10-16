/* Wraps a game page in the shared "back to Playground" bar without touching the game's own layout.
   Include as the FIRST script in the game's <head>:
     <script src="../../assets/portal-frame.js"></script>
   The page reloads itself inside an iframe below the bar; inside the iframe this script does nothing. */
(function () {
    if (window.top !== window.self) return;
    var url = location.href;
    var css = document.currentScript.src.replace(/portal-frame\.js.*$/, "portal-bar.css");
    document.open();
    document.write(
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>Playground</title><link rel="stylesheet" href="' + css + '">' +
        '<style>html,body{margin:0;height:100%;background:#000}' +
        'body{display:flex;flex-direction:column}' +
        '#gameFrame{flex:1 1 auto;min-height:0;width:100%;border:0;display:block}</style></head><body>' +
        '<div class="portal-bar"><a href="../../index.html"><span class="portal-bar-arrow" aria-hidden="true">←</span>' +
        '<span class="portal-bar-mark">P</span><span>Playground</span></a></div>' +
        '<iframe id="gameFrame" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>' +
        /* The browser keeps parsing the rest of the original page; swallow it as inert hidden text. */
        '<style>plaintext{display:none}</style><plaintext>'
    );
    document.close();
    var f = document.getElementById("gameFrame");
    f.addEventListener("load", function () {
        try { document.title = f.contentDocument.title || "Playground"; } catch (e) {}
        f.focus();
    });
    f.src = url;
})();
