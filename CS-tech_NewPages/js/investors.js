// ===== Investors (investors.html) =====
// The sidebar and quick links jump to a disclosure section and open it; the sidebar marks the
// section in view. Sections open and close independently, as on the original page.
(function () {
    var items = [].slice.call(document.querySelectorAll('.inv-item'));
    if (!items.length) return;
    var navLinks = [].slice.call(document.querySelectorAll('.inv-nav a[data-inv-target]'));

    function open(id) {
        var panel = document.getElementById(id);
        if (!panel) return;
        bootstrap.Collapse.getOrCreateInstance(panel, { toggle: false }).show();
        document.getElementById('item-' + id).scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + id);
    }

    document.querySelectorAll('[data-inv-target]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            e.preventDefault();
            open(a.dataset.invTarget);
        });
    });

    // Highlight the sidebar entry for the section nearest the top of the screen
    function spy() {
        var current = items[0];
        items.forEach(function (it) {
            if (it.getBoundingClientRect().top < 160) current = it;
        });
        var id = current.id.replace(/^item-/, '');
        navLinks.forEach(function (a) { a.classList.toggle('active', a.dataset.invTarget === id); });
    }
    window.addEventListener('scroll', spy, { passive: true });
    spy();

    // A link like investors.html#annual-reports opens that section
    if (location.hash && document.getElementById(location.hash.slice(1)) && document.getElementById('item-' + location.hash.slice(1))) {
        window.addEventListener('load', function () { open(location.hash.slice(1)); });
    }
})();
