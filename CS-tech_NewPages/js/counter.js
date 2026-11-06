// ===== Counter animation =====
// Any element with [data-count] is treated as a counter.
// Options via data-attributes:
//   data-count       target numeric value (e.g. 28, 1400, 18.6)
//   data-decimals    number of decimal places to show (default 0)
//   data-format      "comma" to add thousands separators
//   data-duration    animation length in ms (default 2000)
// The counter starts at 0 when it enters the viewport.
(function () {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    function formatValue(value, decimals, useCommas) {
        var text;
        if (decimals > 0) {
            text = value.toFixed(decimals);
        } else {
            text = String(Math.round(value));
        }
        if (useCommas) {
            var parts = text.split('.');
            parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
            text = parts.join('.');
        }
        return text;
    }

    function animate(el) {
        var target = parseFloat(el.getAttribute('data-count'));
        if (isNaN(target)) return;
        var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
        var useCommas = el.getAttribute('data-format') === 'comma';
        var duration = parseInt(el.getAttribute('data-duration') || '2000', 10);
        var start = null;

        function tick(now) {
            if (start === null) start = now;
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            // easeOutCubic for a smooth, decelerating count
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = formatValue(target * eased, decimals, useCommas);
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = formatValue(target, decimals, useCommas);
            }
        }

        requestAnimationFrame(tick);
    }

    // Initialise visible numbers to 0 so there is no flash of the real value
    counters.forEach(function (el) {
        el.textContent = '0';
    });

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !entry.target.dataset.animated) {
                    entry.target.dataset.animated = 'true';
                    animate(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3, rootMargin: '0px 0px -50px 0px' });

        counters.forEach(function (el) {
            observer.observe(el);
        });
    } else {
        // Fallback: animate everything immediately
        counters.forEach(animate);
    }
})();
