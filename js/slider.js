// ===== Card slider =====
// Same behaviour as the Industries slider on index.html, but drives every
// .industry-slider-wrap on the page independently. Slide widths come from the
// CSS breakpoints; the script reads how many fit instead of hard-coding them.
(function () {
    var AUTO_DELAY = 3500;

    document.querySelectorAll('.industry-slider-wrap').forEach(function (wrap) {
        var slider = wrap.querySelector('.industry-slider');
        var track = wrap.querySelector('.industry-track');
        var slides = wrap.querySelectorAll('.industry-slide');
        var prevBtn = wrap.querySelector('.slider-prev');
        var nextBtn = wrap.querySelector('.slider-next');
        if (!slider || !track || !slides.length || !prevBtn || !nextBtn) return;

        var index = 0;
        var timer = null;

        function visibleCount() {
            return Math.max(1, Math.round(slider.clientWidth / slides[0].offsetWidth));
        }

        function maxIndex() {
            return Math.max(0, slides.length - visibleCount());
        }

        function update() {
            index = Math.min(Math.max(index, 0), maxIndex());
            track.style.transform = 'translateX(' + -(index * (100 / visibleCount())) + '%)';
        }

        function next() {
            index = index >= maxIndex() ? 0 : index + 1;
            update();
        }

        function prev() {
            index = index <= 0 ? maxIndex() : index - 1;
            update();
        }

        function stopAuto() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        function startAuto() {
            stopAuto();
            if (maxIndex() > 0) timer = setInterval(next, AUTO_DELAY);
        }

        prevBtn.addEventListener('click', function () { prev(); startAuto(); });
        nextBtn.addEventListener('click', function () { next(); startAuto(); });

        wrap.addEventListener('mouseenter', stopAuto);
        wrap.addEventListener('mouseleave', startAuto);
        wrap.addEventListener('focusin', stopAuto);
        wrap.addEventListener('focusout', startAuto);

        document.addEventListener('visibilitychange', function () {
            document.hidden ? stopAuto() : startAuto();
        });

        window.addEventListener('resize', update);
        update();
        startAuto();
    });
})();
