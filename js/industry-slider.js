// ===== Industries slider (same behaviour as the home page) =====
// 4 cards on desktop, 2 on tablet, 1 on mobile; arrows loop; auto-advances and pauses on hover/focus.
(function () {
    const wrap = document.querySelector('.industry-slider-wrap');
    const track = document.querySelector('.industry-track');
    const slides = document.querySelectorAll('.industry-slide');
    const prevBtn = document.querySelector('.slider-prev');
    const nextBtn = document.querySelector('.slider-next');
    if (!track || !slides.length || !prevBtn || !nextBtn) return;

    const AUTO_DELAY = 3500;
    let index = 0;
    let timer = null;

    function visibleCount() {
        const w = window.innerWidth;
        if (w >= 992) return 4;
        if (w >= 768) return 2;
        return 1;
    }

    function maxIndex() {
        return Math.max(0, slides.length - visibleCount());
    }

    function update() {
        const vc = visibleCount();
        const m = maxIndex();
        if (index > m) index = m;
        if (index < 0) index = 0;
        track.style.transform = `translateX(${-(index * (100 / vc))}%)`;
    }

    function next() {
        index = index >= maxIndex() ? 0 : index + 1;
        update();
    }

    function prev() {
        index = index <= 0 ? maxIndex() : index - 1;
        update();
    }

    function startAuto() {
        stopAuto();
        timer = setInterval(next, AUTO_DELAY);
    }

    function stopAuto() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    prevBtn.addEventListener('click', function () { prev(); startAuto(); });
    nextBtn.addEventListener('click', function () { next(); startAuto(); });

    if (wrap) {
        wrap.addEventListener('mouseenter', stopAuto);
        wrap.addEventListener('mouseleave', startAuto);
        wrap.addEventListener('focusin', stopAuto);
        wrap.addEventListener('focusout', startAuto);
    }

    document.addEventListener('visibilitychange', function () {
        document.hidden ? stopAuto() : startAuto();
    });

    window.addEventListener('resize', update);
    update();
    startAuto();
})();
