// ===== Case studies listing (/case-studies) =====
// Category tabs and the dropdowns narrow the grid together. Clicking a tab resets both
// dropdowns. Only one dropdown filters at a time: picking an Industry resets Service to
// "All Services" and vice versa.
//
// The category and the active dropdown live in the path (clean URLs; the server serves
// case-studies.html for these paths, see .htaccess "case-studies filter views"):
//   /case-studies                                     All, no filter
//   /case-studies/Mobility                            category
//   /case-studies/Industries/Water-Wastewater         industry (All category)
//   /case-studies/Services/Data-Acquisition           service (All category)
//   /case-studies/Mobility/Industries/Automotive-Mobility        category + industry
//   /case-studies/Industries/Industries/Water-Wastewater         Industries tab + industry
// "Industries"/"Services" right before an option slug is the dropdown, otherwise the tab.
// Slugs come from the tab and option labels, so they read like the UI. Older links
// (case-studies.html/..., ?category=gcc&industry=water, and ?route=... from 404.html)
// are read and rewritten to this form.
(function () {
    var grid = document.getElementById('cs-grid');
    if (!grid) return;

    var PAGE = 12;
    var items = [].slice.call(grid.querySelectorAll('.cs-item'));
    var tabs = [].slice.call(document.querySelectorAll('.cs-tab'));
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

    // ---- URL <-> filters ----
    // The listing itself: /case-studies (clean URL) or .../case-studies.html (file URL, local preview)
    var pageMatch = location.pathname.match(/^(.*?\/case-studies(?:\.html)?)(?=\/|$)/);
    var pagePath = pageMatch ? pageMatch[1] : location.pathname;
    var KEY = { industry: 'Industries', service: 'Services' };

    // "Water & Wastewater" -> "Water-Wastewater", "BIM, 3D Modelling & Digital Twins" -> "BIM-3D-Modelling-Digital-Twins"
    function slugify(label) {
        return label.replace(/&/g, ' ').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function same(a, b) {
        return a.toLowerCase() === b.toLowerCase();
    }

    // Each filter value with its slug: tabs by their label, dropdown options by their text
    var catSlugs = tabs.map(function (t) {
        return { value: t.dataset.cat, slug: slugify(t.firstChild.textContent) };
    });
    var optionSlugs = {};
    Object.keys(selects).forEach(function (k) {
        optionSlugs[k] = [].slice.call(selects[k].options).filter(function (o) { return o.value; })
            .map(function (o) { return { value: o.value, slug: slugify(o.textContent) }; });
    });

    function slugOf(list, value) {
        var hit = list.filter(function (x) { return x.value === value; })[0];
        return hit ? hit.slug : value;
    }

    // Accepts the slug in any case, or the internal value ("emerging-tech", "water")
    function valueOf(list, segment) {
        var s = slugify(decodeURIComponent(segment || ''));
        var hit = list.filter(function (x) { return same(x.slug, s) || same(x.value, s); })[0];
        return hit ? hit.value : null;
    }

    // Which dropdown a segment names ("Industries" -> 'industry'), if any
    function keyOf(segment) {
        return Object.keys(KEY).filter(function (k) { return same(segment || '', KEY[k]); })[0];
    }

    function stateFromSegments(segs) {
        var state = { cat: 'all', industry: '', service: '' };
        var i = 0;
        var first = valueOf(catSlugs, segs[0]);
        // A leading "Industries"/"Services" followed by an option is the dropdown, not the tab
        var k0 = keyOf(segs[0]);
        if (first && !(k0 && segs[1] && valueOf(optionSlugs[k0], segs[1]))) {
            state.cat = first;
            i = 1;
        } else if (!first && !k0) {
            i = 1; // unknown category: skip it, keep any filter after it
        }
        for (; i < segs.length - 1; i += 2) {
            var k = keyOf(segs[i]);
            var v = k && valueOf(optionSlugs[k], segs[i + 1]);
            if (!v) continue;
            // one dropdown at a time: a later filter in the path wins
            state.industry = state.service = '';
            state[k] = v;
        }
        return state;
    }

    function stateFromUrl() {
        var rest = location.pathname.slice(pagePath.length);
        var params = new URLSearchParams(location.search);
        if (!rest.replace(/\//g, '') && params.get('route')) rest = params.get('route');
        var segs = rest.split('/').filter(Boolean);
        var state = stateFromSegments(segs);
        if (!segs.length) {
            // older ?category=&industry=&service= links
            state.cat = valueOf(catSlugs, params.get('category')) || 'all';
            Object.keys(selects).forEach(function (k) { state[k] = valueOf(optionSlugs[k], params.get(k)) || ''; });
            if (state.industry) state.service = '';
        }
        return state;
    }

    function pathFor(state) {
        var segs = [];
        if (state.cat !== 'all') segs.push(slugOf(catSlugs, state.cat));
        if (state.industry) segs.push(KEY.industry, slugOf(optionSlugs.industry, state.industry));
        else if (state.service) segs.push(KEY.service, slugOf(optionSlugs.service, state.service));
        return pagePath + (segs.length ? '/' + segs.join('/') : '');
    }

    function currentState() {
        return { cat: cat, industry: selects.industry.value, service: selects.service.value };
    }

    function urlFor(state) {
        var params = new URLSearchParams(location.search);
        ['category', 'industry', 'service', 'route'].forEach(function (k) { params.delete(k); });
        var query = params.toString();
        return pathFor(state) + (query ? '?' + query : '') + location.hash;
    }

    // push: a user choice (Back returns to the previous filters); otherwise only tidy the current entry
    function syncUrl(push) {
        var url = urlFor(currentState());
        if (url === location.pathname + location.search + location.hash) return;
        history[push ? 'pushState' : 'replaceState'](currentState(), '', url);
    }

    function applyState(state) {
        setCat(state.cat);
        Object.keys(selects).forEach(function (k) { selects[k].value = state[k] || ''; });
    }

    // ---- filtering ----
    function has(el, key, value) {
        return !value || (' ' + el.dataset[key] + ' ').indexOf(' ' + value + ' ') !== -1;
    }

    function matches(el) {
        return (cat === 'all' || has(el, 'cat', cat)) &&
            has(el, 'industry', selects.industry.value) &&
            has(el, 'service', selects.service.value);
    }


    // ---- SEO per filter view (CS_Tech_On_Page_SEO_2.xlsx): title, description, keywords, H1 ----
    var SEO = {
        "Industries/Land-Natural-Resources": {
            "t": "Land Natural Resources Case Studies",
            "d": "Explore CS TECH Ai case studies in land natural resources, with project approaches and practical applications across client engagements.",
            "h": "Land Natural Resources Case Studies",
            "k": "land natural resources case studies"
        },
        "Services/Data-Acquisition": {
            "t": "Data Acquisition Case Studies",
            "d": "Explore CS TECH Ai case studies in data acquisition, with project approaches and practical applications across client engagements.",
            "h": "Data Acquisition Case Studies",
            "k": "data acquisition case studies"
        },
        "Industries/Industrial-Manufacturing": {
            "t": "Industrial Manufacturing Case Studies",
            "d": "Explore CS TECH Ai case studies in industrial manufacturing, with project approaches and practical applications across client engagements.",
            "h": "Industrial Manufacturing Case Studies",
            "k": "industrial manufacturing case studies"
        },
        "Services/Engineering-Consulting": {
            "t": "Engineering Consulting Case Studies",
            "d": "Explore CS TECH Ai case studies in engineering consulting, with project approaches and practical applications across client engagements.",
            "h": "Engineering Consulting Case Studies",
            "k": "engineering consulting case studies"
        },
        "Services/Mobility-Engineering": {
            "t": "Mobility Engineering Case Studies",
            "d": "Explore CS TECH Ai case studies in mobility engineering, with project approaches and practical applications across client engagements.",
            "h": "Mobility Engineering Case Studies",
            "k": "mobility engineering case studies"
        },
        "Services/Enterprise-GIS-Spatial-Intelligence": {
            "t": "Enterprise GIS & Spatial Intelligence Case Studies",
            "d": "Explore CS TECH Ai case studies in enterprise gis & spatial intelligence, with project approaches and practical applications across client engagements.",
            "h": "Enterprise GIS Spatial Intelligence Case Studies",
            "k": "enterprise gis & spatial intelligence case studies"
        },
        "Services/Geospatial-Data-Processing-Mapping": {
            "t": "Geospatial Mapping Case Studies",
            "d": "Explore CS TECH Ai case studies in geospatial mapping, with project approaches and practical applications across client engagements.",
            "h": "Geospatial Data Processing Mapping Case Studies",
            "k": "geospatial mapping case studies"
        },
        "Industries/Automotive-Mobility": {
            "t": "Automotive Mobility Case Studies",
            "d": "Explore CS TECH Ai case studies in automotive mobility, with project approaches and practical applications across client engagements.",
            "h": "Automotive Mobility Case Studies",
            "k": "automotive mobility case studies"
        },
        "Industries/Architecture-Engineering-Construction": {
            "t": "AEC Case Studies",
            "d": "Explore CS TECH Ai case studies in aec, with project approaches and practical applications across client engagements.",
            "h": "Architecture Engineering Construction Case Studies",
            "k": "aec case studies"
        },
        "Industries/Transportation-Infrastructure": {
            "t": "Transportation Infrastructure Case Studies",
            "d": "Explore CS TECH Ai case studies in transportation infrastructure, with project approaches and practical applications across client engagements.",
            "h": "Transportation Infrastructure Case Studies",
            "k": "transportation infrastructure case studies"
        },
        "Services/BIM-3D-Modelling-Digital-Twins": {
            "t": "BIM & Digital Twins Case Studies",
            "d": "Explore CS TECH Ai case studies in bim & digital twins, with project approaches and practical applications across client engagements.",
            "h": "BIM 3D Modelling Digital Twins Case Studies",
            "k": "bim & digital twins case studies"
        },
        "Industries/Water-Wastewater": {
            "t": "Water Wastewater Case Studies",
            "d": "Explore CS TECH Ai case studies in water wastewater, with project approaches and practical applications across client engagements.",
            "h": "Water Wastewater Case Studies",
            "k": "water wastewater case studies"
        },
        "Industries/Power-Energy": {
            "t": "Power Energy Case Studies",
            "d": "Explore CS TECH Ai case studies in power energy, with project approaches and practical applications across client engagements.",
            "h": "Power Energy Case Studies",
            "k": "power energy case studies"
        },
        "Services/Modelling-Analytics": {
            "t": "Modelling Analytics Case Studies",
            "d": "Explore CS TECH Ai case studies in modelling analytics, with project approaches and practical applications across client engagements.",
            "h": "Modelling Analytics Case Studies",
            "k": "modelling analytics case studies"
        },
        "Services/Solution-Development": {
            "t": "Solution Development Case Studies",
            "d": "Explore CS TECH Ai case studies in solution development, with project approaches and practical applications across client engagements.",
            "h": "Solution Development Case Studies",
            "k": "solution development case studies"
        }
    };
    var seoH1 = document.querySelector(".hero-content h1");
    var seoMeta = function (name) { return document.querySelector('meta[name="' + name + '"]'); };
    var seoBase = {
        t: document.title,
        d: (seoMeta("description") || {}).content,
        k: (seoMeta("keywords") || {}).content,
        h: seoH1 ? seoH1.lastChild.textContent : ""
    };
    // Canonical of each view: a filter view with its own SEO entry is its own page
    // (https://cstech.ai/case-studies/Industries/Water-Wastewater); every other combination
    // points to the main listing, so thin filter mixes are not indexed separately.
    var CANONICAL_BASE = 'https://cstech.ai/case-studies';
    function setCanonical(href) {
        var link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = href;
    }

    function updateSeo() {
        var route = pathFor(currentState()).slice(pagePath.length + 1).toLowerCase();
        var hit = null, hitRoute = '';
        Object.keys(SEO).forEach(function (r) { if (r.toLowerCase() === route) { hit = SEO[r]; hitRoute = r; } });
        var v = hit || seoBase;
        document.title = v.t;
        if (seoMeta("description") && v.d) seoMeta("description").content = v.d;
        if (seoMeta("keywords") && v.k) seoMeta("keywords").content = v.k;
        if (seoH1 && v.h) seoH1.lastChild.textContent = v.h;
        setCanonical(hit ? CANONICAL_BASE + '/' + hitRoute : CANONICAL_BASE);
    }

    function render() {
        var shown = 0, total = 0;
        items.forEach(function (el) {
            var ok = matches(el);
            if (ok) total++;
            el.hidden = !ok || total > limit;
            if (!el.hidden) shown++;
        });
        if (count) count.textContent = total;
        empty.hidden = total !== 0;
        more.parentElement.hidden = total <= limit;
        clear.hidden = cat === 'all' && !selects.industry.value && !selects.service.value;
        updateSeo();
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
        t.addEventListener('click', function () {
            setCat(t.dataset.cat);
            // A tab is a fresh view of that category: drop any Industry/Service filter
            Object.keys(selects).forEach(function (k) { selects[k].value = ''; });
            reset();
            syncUrl(true);
        });
    });
    Object.keys(selects).forEach(function (k) {
        selects[k].addEventListener('change', function () {
            // switching filter type: the other dropdown goes back to "All"
            if (selects[k].value) Object.keys(selects).forEach(function (o) { if (o !== k) selects[o].value = ''; });
            reset();
            syncUrl(true);
        });
    });
    more.addEventListener('click', function () { limit += PAGE; render(); });

    function clearAll() {
        setCat('all');
        Object.keys(selects).forEach(function (k) { selects[k].value = ''; });
        reset();
        syncUrl(true);
    }
    clear.addEventListener('click', clearAll);
    document.getElementById('cs-clear-2').addEventListener('click', clearAll);

    // Back / Forward restore the category and dropdowns of that entry
    window.addEventListener('popstate', function () {
        applyState(stateFromUrl());
        reset();
    });

    // The page sets <base> to the site folder (see case-studies.html), which would turn in-page
    // links like #case-list into links to the home page; keep them on this page.
    if (document.querySelector('base')) {
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[href^="#"]');
            if (!a || e.defaultPrevented) return;
            e.preventDefault();
            var id = a.getAttribute('href').slice(1);
            var target = id && document.getElementById(id);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Preset from the URL
    applyState(stateFromUrl());

    render();
    syncUrl(false);
})();
