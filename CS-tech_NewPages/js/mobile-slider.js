// ===== Mobile card slider =====
// Any row with [data-mobile-slider] becomes a swipeable, snapping slider on phones
// (below 768px) and stays a normal grid above that. Dots go in the element right
// after the row (.mobile-slider-dots). Auto-advances like the index sliders and
// pauses while the visitor is touching it.
(function () {
    var mq = window.matchMedia('(max-width: 767.98px)');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var AUTO_DELAY = 3500;
    var RESUME_AFTER = 5000;

    document.querySelectorAll('[data-mobile-slider]').forEach(function (row) {
        var slides = Array.prototype.slice.call(row.children);
        var dotsWrap = row.nextElementSibling && row.nextElementSibling.classList.contains('mobile-slider-dots')
            ? row.nextElementSibling : null;
        if (slides.length < 2) return;

        var dots = [];
        var timer = null;
        var resumeTimer = null;

        if (dotsWrap) {
            slides.forEach(function (_, i) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'mobile-slider-dot';
                dot.setAttribute('aria-label', 'Go to card ' + (i + 1));
                dot.addEventListener('click', function () {
                    goTo(i);
                    pause();
                });
                dotsWrap.appendChild(dot);
                dots.push(dot);
            });
        }

        function current() {
            var left = row.scrollLeft;
            var best = 0;
            slides.forEach(function (s, i) {
                if (Math.abs(s.offsetLeft - row.offsetLeft - left) < Math.abs(slides[best].offsetLeft - row.offsetLeft - left)) best = i;
            });
            return best;
        }

        function goTo(i) {
            row.scrollTo({ left: slides[i].offsetLeft - row.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
        }

        function markActive() {
            var i = current();
            dots.forEach(function (d, k) {
                d.classList.toggle('active', k === i);
            });
        }

        function next() {
            // Never slide away from a card the visitor has opened
            if (row.contains(document.activeElement)) return;
            var i = current();
            goTo(i >= slides.length - 1 ? 0 : i + 1);
        }

        function stop() {
            clearInterval(timer);
            timer = null;
        }

        function start() {
            stop();
            if (mq.matches && !reduceMotion && !document.hidden) timer = setInterval(next, AUTO_DELAY);
        }

        // A touch or tap pauses auto-advance, then it resumes a few seconds later
        function pause() {
            stop();
            clearTimeout(resumeTimer);
            resumeTimer = setTimeout(start, RESUME_AFTER);
        }

        row.addEventListener('scroll', markActive, { passive: true });
        row.addEventListener('touchstart', pause, { passive: true });
        row.addEventListener('pointerdown', pause);
        // Hold still while a card inside is open (e.g. a tapped flip card), carry on once it closes
        row.addEventListener('focusin', function () {
            stop();
            clearTimeout(resumeTimer);
        });
        row.addEventListener('focusout', pause);
        document.addEventListener('visibilitychange', start);
        mq.addEventListener('change', function () {
            row.scrollLeft = 0;
            markActive();
            start();
        });

        markActive();
        start();
    });
})();
