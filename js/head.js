(function () {
    // Adds the <head> part of includes/header.html (shared CSS + tracking codes) to this page's <head>.
    // It is written while the page is still loading, so the CSS applies before the page shows
    // (no flash of unstyled content) and the tracking scripts run normally.
    // The page itself keeps its own <title>, description and canonical.
    var me = document.currentScript;
    var root = new URL('../', me.src); // site root = the folder above /js/
    var trackingOnly = me.hasAttribute('data-tracking-only'); // 404.html has its own styles

    var xhr = new XMLHttpRequest();
    xhr.open('GET', new URL('includes/header.html', root), false); // synchronous on purpose: CSS must be in place before the page renders
    xhr.send();
    if (xhr.status !== 200) return;

    var m = xhr.responseText.match(/<head>([\s\S]*?)<\/head>/i);
    if (!m) return;

    var tpl = document.createElement('template');
    tpl.innerHTML = m[1];
    var out = '';
    tpl.content.childNodes.forEach(function (node) {
        if (node.nodeType !== 1) return; // comments, whitespace
        if (/^(TITLE|BASE)$/.test(node.tagName)) return; // these belong to the page
        if (trackingOnly && node.tagName !== 'SCRIPT') return;
        // header.html paths are from the site root; make them work from pages in sub-folders too
        ['href', 'src'].forEach(function (attr) {
            var v = node.getAttribute(attr);
            if (v && !/^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(v)) node.setAttribute(attr, new URL(v, root).href);
        });
        out += node.outerHTML + '\n';
    });
    document.write(out);
})();
