(function () {
    // Site root = the folder above /js/, so pages in sub-folders (e.g. mobility/) share the same header and footer
    var root = new URL('../', document.currentScript.src);

    // includes/header.html and includes/footer.html use root-relative links; resolve them against the site root, not the current page
    function fixLinks(container) {
        container.querySelectorAll('[href], [src]').forEach(function (el) {
            ['href', 'src'].forEach(function (attr) {
                var value = el.getAttribute(attr);
                if (!value || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return;
                el.setAttribute(attr, new URL(value, root).href);
            });
        });
    }

    function loadHTML(file, target) {
        return fetch(new URL(file, root))
            .then(function (res) { return res.text(); })
            .then(function (html) {
                if (base) {
                    html = html.replace(/href="(?!https?:\/\/|#|mailto:)([^"]+)"/g, 'href="' + base + '$1"');
                    html = html.replace(/src="(?!https?:\/\/|data:)([^"]+)"/g, 'src="' + base + '$1"');
                }
                target.innerHTML = html;
                fixLinks(target);
                target.replaceWith.apply(target, target.childNodes);
            });
    }

    var header = document.getElementById('site-header');
    var footer = document.getElementById('site-footer');

    var tasks = [];
    if (header) tasks.push(loadHTML('includes/header.html', header));
    if (footer) tasks.push(loadHTML('includes/footer.html', footer));

    Promise.all(tasks).then(function () {
        var path = location.pathname.replace(/\/$/, '/index.html');
        document.querySelectorAll('.navbar-nav .nav-link').forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href || href.charAt(0) === '#' || link.hash) return;
            if (link.pathname === path || link.pathname === path.replace('.html', '')) {
                link.classList.add('active');
            }
        });
    });
})();
