// ===== News listing (news.html) =====
// Year chips filter the grid; Load More reveals it 12 cards at a time. The newest item is
// already shown in the "Latest news" block, so the grid leaves it out under "All".
(function () {
    var grid = document.getElementById('news-grid');
    if (!grid) return;

    var PAGE = 12;
    var items = [].slice.call(grid.querySelectorAll('.news-item'));
    var chips = [].slice.call(document.querySelectorAll('.news-years .career-chip'));
    var more = document.getElementById('news-more');
    var year = 'all';
    var limit = PAGE;

    function render() {
        var total = 0;
        items.forEach(function (el) {
            var ok = year === 'all' ? !el.hasAttribute('data-featured') : el.dataset.year === year;
            if (ok) total++;
            el.hidden = !ok || total > limit;
        });
        more.parentElement.hidden = total <= limit;
    }

    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
            year = chip.dataset.year;
            limit = PAGE;
            render();
        });
    });
    more.addEventListener('click', function () { limit += PAGE; render(); });

    render();
})();
