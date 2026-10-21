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
                target.innerHTML = html;
                fixLinks(target);
                target.replaceWith.apply(target, target.childNodes);
            });
    }

    var header = document.getElementById('site-header');
    var footer = document.getElementById('site-footer');
    var form = document.getElementById('site-form');

    var tasks = [];
    if (header) tasks.push(loadHTML('includes/header.html', header));
    if (footer) tasks.push(loadHTML('includes/footer.html', footer));
    if (form) tasks.push(loadHTML('includes/form.html', form));

    Promise.all(tasks).then(function () {
        var path = location.pathname.replace(/\/$/, '/index.html');
        document.querySelectorAll('.navbar-nav .nav-link').forEach(function (link) {
            var href = link.getAttribute('href');
            if (!href || href.charAt(0) === '#' || link.hash) return;
            if (link.pathname === path || link.pathname === path.replace('.html', '')) {
                link.classList.add('active');
            }
        });
        // A page reached through a dropdown highlights its item and the menu it sits in
        document.querySelectorAll('.navbar-nav .dropdown-item').forEach(function (item) {
            if (item.hash || item.pathname !== path) return;
            item.classList.add('active');
            var toggle = item.closest('.dropdown').querySelector('.nav-link');
            if (toggle) toggle.classList.add('active');
            var sub = item.closest('.dropdown-submenu');
            if (sub && !item.classList.contains('submenu-toggle')) sub.querySelector('.submenu-toggle').classList.add('active');
        });

        // Nested submenu (e.g. Solutions & Products > Products): a click opens it without closing the parent menu
        document.querySelectorAll('.navbar .submenu-toggle').forEach(function (toggle) {
            var sub = toggle.parentElement;
            toggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var open = !sub.classList.contains('show');
                sub.parentElement.querySelectorAll('.dropdown-submenu.show').forEach(function (s) {
                    s.classList.remove('show');
                    s.querySelector('.submenu-toggle').setAttribute('aria-expanded', 'false');
                });
                sub.classList.toggle('show', open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            // Close the submenu whenever its parent dropdown closes
            var parentToggle = sub.closest('.dropdown').querySelector('[data-bs-toggle="dropdown"]');
            if (parentToggle) parentToggle.addEventListener('hidden.bs.dropdown', function () {
                sub.classList.remove('show');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });

        // Targets like #contact only exist once the includes are in, so jump to them now
        if (location.hash) {
            var target = document.getElementById(location.hash.slice(1));
            if (target) target.scrollIntoView({ behavior: 'instant' });
        }
    });
})();
