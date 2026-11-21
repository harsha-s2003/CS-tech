# Website forms -> Google Sheet (email optional)

Every form on the site is saved as a new row in the Google Sheet **CS Tech Leads**, tab
**Website Enquiries**. Each lead can also be emailed (PHPMailer over SMTP, account
`contactus@cstech.ai`); that is switched off for now (`'send_email' => false`).

| Form | Where | "Form Name" in the sheet |
|---|---|---|
| Common enquiry form | `includes/form.html` (on every page) | Website enquiry |
| Service-page form | 9 pages in `services/` | Service page enquiry |
| Support ticket | `services/support-ticket.html` | Support ticket |

After a successful save the visitor goes to the **Thank You page** (`thank-you.html`, address
`/thank-you`). It is noindex and not in the sitemap. In Google Analytics, a view of `/thank-you`
= one form submission (useful as a conversion). If the lead could not be saved, the visitor stays
on the form and sees an error message, so they can try again.

## How a submission travels

1. `js/enquiry-form.js` sends the form in the background to `mail/send-enquiry.php`.
2. `send-enquiry.php` checks it (spam trap, a valid email address, a name) and posts it, with the
   secret, to the sheet's Apps Script web app (`sheet_url` in `mail-config.php`).
3. The Apps Script checks the secret and adds the row.
4. If `send_email` is `true`, the email goes out as well.
5. The visitor gets the Thank You page when the row was added (or the email was sent).

Saving takes about 3-5 seconds; the button shows "Submitting..." meanwhile.

## Files

| File | What it does |
|---|---|
| `mail/mail-config.php` | **Settings**: sheet URL and secret, email on/off, recipients, SMTP account and password, subjects. The only file to edit. |
| `mail/send-enquiry.php` | Receives the form, checks it, saves it in the sheet, emails it if switched on (answers `success` / `error`). |
| `mail/google-apps-script.js` | A copy of the code that runs inside the sheet (*Extensions > Apps Script*). Changing this file changes nothing by itself: see "Change the Apps Script" below. |
| `js/enquiry-form.js` | Sends the form in the background and shows "Submitting...", then opens the Thank You page (or shows the red error message). Loaded on every page from `includes/header.html`. |
| `thank-you.html` | The Thank You page shown after a successful submit. |
| `PHPMailer/` | The email library (version 7.2.0). Only `PHPMailer/src/` is used. |

`mail-config.php` holds the sheet secret and the email password: it cannot be opened in a browser
(blocked twice), and it is in `.gitignore` so it never goes to GitHub. Keep secrets there, never in
`send-enquiry.php` (that file is in git). Upload it to the server together with the site.

## The sheet

Columns, left to right (the script writes by position):

A Submission Date, B Form Name, C Full Name (service pages: First Name), D Last Name, E Email,
F Phone, G Company/Organization, H Purpose, I Comments, J Consent, K Job Title, L Country,
M Ticket Type, N Ticket Subject, O Priority, P Due Date, Q Problem Observed, R Page URL.

- The tab must be named exactly `Website Enquiries`.
- A form only fills its own columns; the others stay empty.
- Empty header cells in row 1 are filled in by the script. Headers already there are never changed,
  so they can be renamed. Do not insert, delete or move columns.
- Values are stored as plain text: nothing typed in a form can become a formula, and phone numbers
  keep a leading 0.

## Common changes

- **Change the Apps Script:** edit `mail/google-apps-script.js`, paste the whole file into
  *Extensions > Apps Script* (replacing the code there), Save, then *Deploy > Manage deployments >*
  pencil (Edit) *> Version: New version > Deploy*. The URL stays the same. (*Deploy > New deployment*
  gives a new URL: then put it in `sheet_url`.) If Google then asks to *Authorize access*, the sheet
  owner clicks it, picks their account and allows it (on "Google hasn't verified this app":
  *Advanced > Go to CSTECH Website Form Integration (unsafe)*). The new version is live only after that.
- **Change the secret:** put the same new value in `sheet_secret` (`mail-config.php`) and in
  *Apps Script > Project Settings > Script Properties >* `FORM_SECRET`. Any long random text works.
- **New field in a form:** give the field a `name`, then add it at the END of `COLUMNS` in the
  Apps Script (for the sheet) and to `$labels` in `send-enquiry.php` (for the email).
- **Email as well:** `'send_email' => true` in `mail-config.php` (read "Email" below first).
  Recipients: the `'to'` list.

## Test on this PC

1. Double-click `seo-migration\local-apache\start-local-server.bat`.
2. Open http://localhost:8080/ , fill in a form, press Submit.
3. Check the sheet for the new row. This adds a **real** row: delete it afterwards.

(Not http://localhost/CS-tech_NewPages/ - the site's clean URLs only work at the root of a domain.
Stopping Apache in XAMPP stops this server too: start it again with the .bat file.)

## If a lead does not arrive

The visitor only sees "There was an error...". The reason is in the PHP error log (on cPanel:
*Metrics > Errors*, or the `error_log` file next to `send-enquiry.php`; on this PC:
`seo-migration\local-apache\logs\error.log`), in a line with `CS TECH website form:`.

| The line says | What to do |
|---|---|
| `not saved to Google Sheet - Unauthorized` | `sheet_secret` and `FORM_SECRET` (Script Properties) are not the same. |
| `not saved to Google Sheet - Save failed: tab "Website Enquiries" not found` | Rename the sheet tab to exactly `Website Enquiries`. |
| `not saved to Google Sheet - HTTP ..., the answer did not come from the script` | *Deploy > Manage deployments*: "Who has access" must be **Anyone**, "Execute as" **Me**. |
| `not saved to Google Sheet - Could not resolve host` / `timed out` / `SSL ...` | The server cannot reach `script.google.com` over HTTPS: ask the hosting. |
| `email not sent - ...` | Only when `send_email` is on: an SMTP problem (see "Email"). |

A form that worked before and stops after an Apps Script change: the new version was probably not
deployed (*Manage deployments > New version*). The script's own log: *Apps Script > Executions*.

## Email (optional)

Off by default: `'send_email' => false`. With `true`, every lead is also emailed to the `'to'` list,
and the visitor gets the Thank You page if the sheet or the email worked.

- `'smtp_servers'` are tried in order. Each needs `tls://` (port 587) or `ssl://` (port 465) in front;
  a server written without one gets `tls://`, so the password is never sent unencrypted.
- The office PC this was set up on blocks port 587: there only `ssl://smtp.rediffmailpro.com:465` works.
- The live server's hosting blocks outbound SMTP (error log: "Connection timed out", code 110). Keep
  `send_email` off on the live site until the hosting allows `smtp.rediffmailpro.com` on 587/465,
  or every submission waits ~30 seconds for the timeouts.

## Spam protection

Each form has a hidden "website" field. People never see it; bots fill it in. Such submissions get a
fake "success" and nothing is saved or sent.
