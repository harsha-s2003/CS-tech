(function () {
    var scripts = document.querySelectorAll('script[src*="include.js"]');
    var scriptSrc = scripts[scripts.length - 1].getAttribute('src');
    var base = scriptSrc.replace('js/include.js', '');

    function loadHTML(url, target) {
        return fetch(base + url)
            .then(function (res) { return res.text(); })
            .then(function (html) {
                if (base) {
                    html = html.replace(/href="(?!https?:\/\/|#|mailto:)([^"]+)"/g, 'href="' + base + '$1"');
                    html = html.replace(/src="(?!https?:\/\/|data:)([^"]+)"/g, 'src="' + base + '$1"');
                }
                target.innerHTML = html;
                target.replaceWith.apply(target, target.childNodes);
            });
    }

    var header = document.getElementById('site-header');
    var footer = document.getElementById('site-footer');

    var tasks = [];
    if (header) tasks.push(loadHTML('header.html', header));
    if (footer) tasks.push(loadHTML('footer.html', footer));

    Promise.all(tasks).then(function () {
        var path = location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.navbar-nav .nav-link').forEach(function (link) {
            var href = link.getAttribute('href');
            if (href === path || href === path.replace('.html', '') ||
                (path === 'index.html' && (href === '#services' || href === '#contact'))) {
                link.classList.add('active');
            }
        });
    });
})();
