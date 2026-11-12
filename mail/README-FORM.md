# Website forms -> email

Every form on the site sends its enquiry by email, the same way as the old website
(PHPMailer over SMTP, account `contactus@cstech.ai`).

| Form | Where | Email subject |
|---|---|---|
| Common enquiry form | `includes/form.html` (on every page) | CS TECH Ai lead from *name* |
| Service-page form | 9 pages in `services/` | CS TECH Ai lead from *name* |
| Support ticket | `services/support-ticket.html` | CS TECH Ai support ticket: *subject* (*name*) |

All of them go to the addresses in the `'to'` list of `mail/mail-config.php`.
"Reply" in the inbox answers the visitor. The email also says which page the form was sent from.

After a successful send the visitor goes to the **Thank You page** (`thank-you.html`, address
`/thank-you`). It is noindex and not in the sitemap. In Google Analytics, a view of `/thank-you`
= one form submission (useful as a conversion). If the email could not be sent, the visitor stays
on the form and sees an error message, so they can try again.

## Files

| File | What it does |
|---|---|
| `mail/mail-config.php` | **Settings**: who receives the emails, SMTP account and password, subjects. The only file to edit. |
| `mail/send-enquiry.php` | Receives the form, checks it, sends the email (answers `success` / `error`). |
| `js/enquiry-form.js` | Sends the form in the background and shows "Submitting...", then opens the Thank You page (or shows the red error message). Loaded on every page from `includes/header.html`. |
| `thank-you.html` | The Thank You page shown after a successful submit. |
| `PHPMailer/` | The email library (version 7.2.0). Only `PHPMailer/src/` is used. |

`mail-config.php` holds the email password: it cannot be opened in a browser (blocked twice), and it
is in `.gitignore` so it never goes to GitHub. Upload it to the server together with the site.

## Common changes

- **Add / remove a recipient:** edit the `'to'` list in `mail/mail-config.php`.
- **Email password changed:** update `'smtp_password'` in `mail/mail-config.php`.
- **Different subject:** edit `'subject_enquiry'` / `'subject_ticket'`.
- **New field in a form:** give the field a `name` and add the same name with a label to the
  `$labels` list in `mail/send-enquiry.php`.

## Test on this PC

1. Double-click `seo-migration\local-apache\start-local-server.bat`.
2. Open http://localhost:8080/ , fill in a form, press Submit.
3. Check both inboxes (and spam). This sends a **real** email through the real account.

(Not http://localhost/CS-tech_NewPages/ - the site's clean URLs only work at the root of a domain.)

## If emails do not arrive

The visitor only sees "There was an error...". The real reason is written to the PHP error log
(on cPanel: *Metrics > Errors*, or the `error_log` file next to `send-enquiry.php`; on this PC:
`seo-migration\local-apache\logs\error.log`). Usual causes: the email password was changed, or the
network blocks the mail ports.

The mail server is tried on port 587 first (as on the old website) and then on port 465
(`'smtp_servers'` in `mail-config.php`). Some networks, like the office PC this was set up on, block
port 587: there the email goes through 465, about 10 seconds later.

## Spam protection

Each form has a hidden "website" field. People never see it; bots fill it in. Such submissions get a
fake "success" and no email is sent.
