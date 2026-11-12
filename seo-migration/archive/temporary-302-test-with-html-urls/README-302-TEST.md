# Temporary 302 test: old cstech.ai URLs -> demo site

**Not installed anywhere.** These files only exist in this folder. Do not use them as the production
redirects: at cutover the 301 rules in `../production/` are used instead.

## Files

| File | Use |
|---|---|
| `cstech-temporary-302-redirects.htaccess` | **Recommended.** 74 rules, redirects **testers only** (browsers with the cookie `cst_redirect_test=1`). Public visitors and Google keep the old pages. |
| `cstech-temporary-302-redirects-PUBLIC.htaccess` | Same 74 rules for **every** visitor and search engine. Only for a short, planned window. |
| `optional-302-proposed-manual-review.htaccess` | 45 proposed Manual Review mappings (not approved), same tester-only format. Optional. |
| `302-test-list.csv` | The 74 old URLs and the exact `Location` each must return. |

Mapping: the 74 approved "301 Redirect" rows of `CS_Tech_Old_to_New_301_Redirect_Mapping.xlsx`
(column D path), with the domain swapped to `https://cst.convomax.online`. The same old->new paths as the
production 301 rules. Manual Review rows, `/sitemap.xml` and the homepage are not included.

Each rule: `RewriteRule ^old/path/?$ https://cst.convomax.online/new/path.html [R=302,L,NC,...]`
- 302 temporary; with or without trailing slash; any letter case; query string kept (`utm_*` etc.).
- Every 302 response also sends `Cache-Control: no-store, private` and `X-Robots-Tag: noindex`.
- Unmapped URLs are never redirected.

## Where to install

On the **old production server that serves https://cstech.ai today** (Apache, 162.214.80.12):
the `.htaccess` in the **document root of cstech.ai**, at the **very top**, above every existing rule.

- **Not** on cst.convomax.online: the demo is the destination, and it runs nginx (ignores `.htaccess`).
- Installing changes the live production site: **needs your approval first.**
- The old site already sends `http://` and `www.` to `https://cstech.ai`; these rules sit above that and
  answer every variant directly (one hop to the demo).
- Today the old site answers `500` for old URLs with a trailing slash and `404` for upper case. These
  rules catch both before the old site's own rules run.

## Steps (when approved)

1. Download a backup of the current cstech.ai `.htaccess`.
2. Paste the whole block of `cstech-temporary-302-redirects.htaccess` at the top. Save.
3. Turn testing on in your browser: open `https://cstech.ai/?cst_redirect_test=on`
   (sets the cookie for 1 day; the page itself does not redirect).
4. Open old URLs, e.g. `https://cstech.ai/geospatial/data-acquisition` -> demo page.
5. Turn it off: `https://cstech.ai/?cst_redirect_test=off`.
6. **After testing, remove the block** (or restore the backup).

## Check from a terminal (after install)

```bash
tail -n +2 302-test-list.csv | tr -d '\r' | while IFS=, read old want; do
  read code loc < <(curl -s -o /dev/null -b 'cst_redirect_test=1' -w '%{http_code} %{redirect_url}' "$old")
  final=$(curl -s -o /dev/null -w '%{http_code}' "$want")
  [ "$code" = 302 ] && [ "$loc" = "$want" ] && [ "$final" = 200 ] && echo "OK   $old" || echo "FAIL $old -> $code $loc (dest $final)"
done
```

Without `-b 'cst_redirect_test=1'` every old URL must still return the old page (200).

## Tested locally (Apache 2.4.58, Host cstech.ai, simulated old-site rules below the block)

- Tester-only file: 824 checks, 0 failures. 74 URLs x (no slash, slash, upper case, slash + query string):
  302 to the exact URL, query kept, no-store + noindex headers. No cookie / wrong cookie: no redirect.
  Homepage, `/sitemap.xml`, Manual Review and unmapped URLs: no redirect. On/off switch sets/clears the
  cookie (secure, HttpOnly, domain `.cstech.ai`).
- Public file: 600 checks, 0 failures.
- Live demo: all 108 destinations (73 approved + optional) return 200 directly, with and without a query
  string, each with `X-Robots-Tag: noindex, nofollow`.

## Demo stays noindex, nofollow

The demo already sends `X-Robots-Tag: noindex, nofollow` (nginx) and the shared head adds the robots meta
tag on every host except cstech.ai. Keep both until cutover; do not submit the demo sitemap to Google.
