// ===== Careers openings (careers.html) =====
// Location chips and the search box narrow the openings list; both apply together.
(function () {
    var list = document.getElementById('career-jobs');
    var search = document.getElementById('career-search');
    var count = document.getElementById('career-count');
    var empty = document.getElementById('career-empty');
    if (!list || !search) return;

    var jobs = list.querySelectorAll('.career-job');
    var chips = document.querySelectorAll('.career-chip');
    var filter = 'all';

    function apply() {
        var q = search.value.trim().toLowerCase();
        var shown = 0;
        jobs.forEach(function (job) {
            var locs = (job.dataset.loc || '').split(' ');
            var ok = (filter === 'all' || locs.indexOf(filter) !== -1) &&
                (!q || job.dataset.search.indexOf(q) !== -1);
            job.hidden = !ok;
            if (ok) shown++;
        });
        count.textContent = shown;
        empty.hidden = shown !== 0;
    }

    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
            filter = chip.dataset.filter;
            apply();
        });
    });
    search.addEventListener('input', apply);
})();
