
(function () {
    var script = document.currentScript;
    var root = new URL('../', script ? script.src : location.href); // site root = the folder above /js/
    var ENDPOINT = new URL('mail/send-enquiry.php', root).href;
    var THANK_YOU = new URL('thank-you', root).href;
    var TEXT = {
        sending: 'Submitting...',
        success: 'We have received your details and will be in touch shortly.',
        error: 'There was an error sending your message. Please try again.'
    };

    // The result message under the button (Bootstrap alert styles)
    function showStatus(form, ok) {
        var box = form.querySelector('.form-status');
        if (!box) {
            box = document.createElement('div');
            box.setAttribute('role', 'status');
            box.setAttribute('aria-live', 'polite');
            var button = form.querySelector('[type="submit"]');
            (button && button.parentNode ? button.parentNode : form).appendChild(box);
        }
        box.className = 'form-status alert py-2 mt-3 mb-0 ' + (ok ? 'alert-success' : 'alert-danger');
        box.textContent = ok ? TEXT.success : TEXT.error;
    }

    // One listener for the whole page: also works for forms added later (includes/form.html)
    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || !form.matches || !form.matches('form.contact-form')) return;
        e.preventDefault();
        if (form.getAttribute('data-sending')) return;
        form.setAttribute('data-sending', '1');

        var data = new FormData(form);
        data.set('pageTitle', document.title);
        data.set('pageUrl', location.href);

        var button = form.querySelector('[type="submit"]');
        var label = button ? button.textContent : '';
        var fields = [].slice.call(form.elements);
        var old = form.querySelector('.form-status');
        if (old) old.parentNode.removeChild(old);
        if (button) button.textContent = TEXT.sending;
        form.style.opacity = '0.6';
        fields.forEach(function (el) { el.disabled = true; });

        fetch(ENDPOINT, { method: 'POST', body: data, credentials: 'same-origin' })
            .then(function (res) {
                return res.ok;
            })
            .catch(function () { return false; })
            .then(function (ok) {
                fields.forEach(function (el) { el.disabled = false; });
                form.style.opacity = '';
                if (button) button.textContent = label;
                form.removeAttribute('data-sending');
                if (ok) {
                    form.reset();                    // a clean form if the visitor comes Back
                    window.location.href = THANK_YOU;
                    return;
                }
                showStatus(form, false);
            });
    });
})();
