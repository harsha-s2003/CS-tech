// ===== Card carousel (about.html: Board, Management, Certifications) =====
// A row of cards that shows a fixed number per view (6 desktop / 4 tablet / 2 phone,
// set in CSS). When the cards fit, the arrows hide and it is a plain row; when
// they do not, the arrows step one card at a time and touch screens can swipe.
(function () {
    document.querySelectorAll('.about-carousel').forEach(function (wrap) {
        var track = wrap.querySelector('.about-track');
        var prev = wrap.querySelector('.slider-prev');
        var next = wrap.querySelector('.slider-next');
        if (!track || !prev || !next) return;

        function step() {
            var first = track.children[0];
            if (!first) return 0;
            var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            return first.getBoundingClientRect().width + gap;
        }

        function update() {
            var max = track.scrollWidth - track.clientWidth;
            wrap.classList.toggle('is-scrollable', max > 2);
            prev.disabled = track.scrollLeft <= 2;
            next.disabled = track.scrollLeft >= max - 2;
        }

        prev.addEventListener('click', function () {
            track.scrollBy({ left: -step(), behavior: 'smooth' });
        });
        next.addEventListener('click', function () {
            track.scrollBy({ left: step(), behavior: 'smooth' });
        });

        track.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        // Fonts and images can change the row's size after first paint
        window.addEventListener('load', update);
        if (window.ResizeObserver) new ResizeObserver(update).observe(track);
        update();
    });
})();
