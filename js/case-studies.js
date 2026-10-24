// ===== Case studies listing (case-studies.html) =====
// Category tabs, the three dropdowns and the search box all narrow the grid together.
// Filters can be preset from the URL, e.g. case-studies.html?category=gcc&industry=water&service=bim
(function () {
    var grid = document.getElementById('cs-grid');
    if (!grid) return;

    var PAGE = 12;
    var items = [].slice.call(grid.querySelectorAll('.cs-item'));
    var tabs = [].slice.call(document.querySelectorAll('.cs-tab'));
    var search = document.getElementById('cs-search');
    var selects = {
        industry: document.getElementById('cs-industry'),
        service: document.getElementById('cs-service')
    };
    var count = document.getElementById('cs-count');
    var empty = document.getElementById('cs-empty');
    var more = document.getElementById('cs-more');
    var clear = document.getElementById('cs-clear');
    var cat = 'all';
    var limit = PAGE;

    function has(el, key, value) {
        return !value || (' ' + el.dataset[key] + ' ').indexOf(' ' + value + ' ') !== -1;
    }

    function matches(el) {
        var q = search.value.trim().toLowerCase();
        return (cat === 'all' || has(el, 'cat', cat)) &&
            has(el, 'industry', selects.industry.value) &&
            has(el, 'service', selects.service.value) &&
            (!q || el.dataset.search.indexOf(q) !== -1);
    }

    function render() {
        var shown = 0, total = 0;
        items.forEach(function (el) {
            var ok = matches(el);
            if (ok) total++;
            el.hidden = !ok || total > limit;
            if (!el.hidden) shown++;
        });
        count.textContent = total;
        empty.hidden = total !== 0;
        more.parentElement.hidden = total <= limit;
        clear.hidden = cat === 'all' && !search.value && !selects.industry.value && !selects.service.value;
    }

    function reset() {
        limit = PAGE;
        render();
    }

    function setCat(value) {
        cat = value;
        tabs.forEach(function (t) {
            var on = t.dataset.cat === value;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on);
        });
    }

    tabs.forEach(function (t) {
        t.addEventListener('click', function () { setCat(t.dataset.cat); reset(); });
    });
    Object.keys(selects).forEach(function (k) { selects[k].addEventListener('change', reset); });
    search.addEventListener('input', reset);
    more.addEventListener('click', function () { limit += PAGE; render(); });

    function clearAll() {
        setCat('all');
        search.value = '';
        Object.keys(selects).forEach(function (k) { selects[k].value = ''; });
        reset();
    }
    clear.addEventListener('click', clearAll);
    document.getElementById('cs-clear-2').addEventListener('click', clearAll);

    // Preset from the URL
    var params = new URLSearchParams(location.search);
    if (params.get('category')) setCat(params.get('category'));
    Object.keys(selects).forEach(function (k) {
        var v = params.get(k);
        if (v && selects[k].querySelector('option[value="' + v + '"]')) selects[k].value = v;
    });
    if (params.get('q')) search.value = params.get('q');

    render();
})();
