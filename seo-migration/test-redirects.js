#!/usr/bin/env node
// =====================================================================================
// Tests every redirect and every page.
//
//   node seo-migration/test-redirects.js           against the local Apache (http://127.0.0.1:8080,
//                                                  started with seo-migration/local-apache/httpd.conf)
//   node seo-migration/test-redirects.js --live    against the live site https://cstech.ai (after go-live)
//
// Checks
//   1. every row of redirects.csv: /old, /old/, /OLD, /old/?utm... -> ONE 301 to the exact new URL -> 200
//   2. safety net: an unknown URL in each old section -> 301 -> that section's page -> 200
//   3. every page of sitemap.xml: 200 without redirect; its ".html" and "/" variants -> 301 -> the page
//   4. http -> https, www -> cstech.ai, /index.html and /home -> /
//   5. unknown URLs -> 404 with the custom page; internal folders -> 404; includes/ -> noindex
//   6. every link and file used by every page (crawl) -> 200 without a redirect
// Exit code 0 = all passed. No packages needed.
// =====================================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const TOOLS = __dirname;
const SITE = path.resolve(TOOLS, '..');
const LIVE = process.argv.includes('--live');
const ORIGIN = 'https://cstech.ai';
const LOCAL = { host: '127.0.0.1', port: 8080 };
const FILTER_ROUTE = /^case-studies\/(Geospatial|Mobility|Emerging-Tech|Industries|Services|GCC|USA)(\/.*)?$/i;
// Files of the OLD website that the new pages use; they are copied into the website folder before upload
const OLD_FILES = /^\/(uploads\/|privacy-policy\.pdf$|img\/social-share\.jpg$)/i;

let failures = [], warnings = [], checks = 0;
const fail = m => failures.push(m);
const ok = (cond, m) => { checks++; if (!cond) fail(m); return cond; };

// ---------- HTTP ----------
// request(url, {scheme, host}) -> {status, location, headers, body}
// Locally every request goes to 127.0.0.1:8080 with the Host header of the URL; "https" is
// simulated with X-Forwarded-Proto (the .htaccess https rule honours it).
function request(url, opt = {}) {
    const u = new URL(url);
    const secure = u.protocol === 'https:';
    return new Promise(resolve => {
        const headers = { Host: u.host, 'User-Agent': 'cstech-redirect-test' };
        let lib, o;
        if (LIVE) { lib = secure ? https : http; o = { hostname: u.hostname, port: u.port || (secure ? 443 : 80), path: u.pathname + u.search, headers }; }
        else { if (secure) headers['X-Forwarded-Proto'] = 'https'; lib = http; o = { ...LOCAL, path: u.pathname + u.search, headers }; }
        const req = lib.request({ ...o, method: opt.method || 'GET' }, res => {
            const chunks = [];
            res.on('data', c => { if (opt.body) chunks.push(c); });
            res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location || '', headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', e => resolve({ status: 'ERR ' + e.code, location: '', headers: {}, body: '' }));
        req.setTimeout(30000, () => req.destroy(new Error('timeout')));
        req.end();
    });
}
// one-hop check: url -> 301 -> want -> 200 (no further redirect)
async function expectRedirect(url, want, label) {
    const r = await request(url);
    const loc = r.location && new URL(r.location, url).href;
    // relative redirects come back as http:// locally (Apache does not see the simulated https)
    const same = loc === want || (!LIVE && loc && loc.replace(/^http:/, 'https:') === want);
    if (!ok(r.status === 301 && same, `${label}: ${url} -> ${r.status} ${r.location || ''} (want 301 ${want})`)) return;
    const f = await request(want);
    ok(f.status === 200, `${label}: ${url} -> ${want} -> ${f.status} ${f.location || ''} (want 200, one hop)`);
}
async function expectPage(url, label) {
    const r = await request(url, { body: true });
    ok(r.status === 200, `${label}: ${url} -> ${r.status} ${r.location || ''} (want 200, no redirect)`);
    return r;
}
async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const x = items[i++]; await fn(x); } }));
}

// ---------- data ----------
function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
        else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}
const strip = s => s.replace(/^\/+|\/+$/g, '');
const cleanOf = u => { const x = new URL(u.trim()); return { p: strip(decodeURIComponent(x.pathname)).replace(/(^|\/)(index|home)\.html$/i, '$1').replace(/\.html$/i, ''), q: x.search }; };
const rows = parseCsv(fs.readFileSync(path.join(TOOLS, 'redirects.csv'), 'utf8').replace(/^\uFEFF/, ''))
    .slice(1).filter(r => r[0] && r[1] && !/^\s*#/.test(r[0]))
    .map(r => { const o = strip(decodeURIComponent(new URL(r[0].trim()).pathname)); const t = cleanOf(r[1]); return { old: o, want: ORIGIN + '/' + t.p + t.q, samePage: o.toLowerCase() === t.p.toLowerCase() && !t.q }; });
const sitemap = [...fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);

(async () => {
    const t0 = Date.now();
    console.log(`testing ${LIVE ? 'LIVE https://cstech.ai' : 'local Apache http://127.0.0.1:8080 (as https://cstech.ai)'}`);
    const probe = await request(ORIGIN + '/');
    if (String(probe.status).startsWith('ERR')) { console.log(`cannot reach the server (${probe.status}). Start it first:\n  F:\\xampp\\apache\\bin\\httpd.exe -f "${path.join(TOOLS, 'local-apache', 'httpd.conf')}"`); process.exit(2); }

    // 1. old URLs
    await pool(rows, LIVE ? 4 : 8, async r => {
        const base = ORIGIN + '/' + r.old;
        if (r.samePage) await expectPage(base, 'old URL = new page');
        else await expectRedirect(base, r.want, 'old URL');
        await expectRedirect(base + '/', r.want, 'old URL + /');
        await expectRedirect(ORIGIN + '/' + r.old.toUpperCase(), r.want, 'old URL in capitals');
        await expectRedirect(base + '/?utm_source=test&x=1', r.want + (r.want.includes('?') ? '&' : '?') + 'utm_source=test&x=1', 'old URL + query');
        await expectRedirect('http://www.cstech.ai/' + r.old, r.want, 'old URL via http://www');
    });
    // 2. safety net (old sections = old URLs that other old URLs sit under)
    const keys = rows.map(r => r.old.toLowerCase());
    const sections = rows.filter(r => keys.some(k => k !== r.old.toLowerCase() && k.startsWith(r.old.toLowerCase() + '/')));
    await pool(sections, 4, s => expectRedirect(`${ORIGIN}/${s.old}/zz-unknown-old-page`, s.want, 'safety net'));
    // 3. sitemap pages and their variants
    const pages = new Map();
    await pool(sitemap, LIVE ? 4 : 8, async loc => {
        const r = await expectPage(loc, 'sitemap page');
        if (r.status === 200) pages.set(loc, r.body);
        // a page in the sitemap must be indexable: no noindex header, no hard-coded noindex tag
        // (the demo's noindex comes from includes/header.html and switches itself off on cstech.ai)
        ok(!/noindex/i.test(r.headers['x-robots-tag'] || ''), `sitemap page sends "X-Robots-Tag: ${r.headers['x-robots-tag']}": ${loc}`);
        ok(!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(r.body), `sitemap page has a noindex meta tag: ${loc}`);
        const p = strip(new URL(loc).pathname);
        if (p) {
            await expectRedirect(`${ORIGIN}/${p}.html`, loc, '.html variant');
            await expectRedirect(`${ORIGIN}/${p}/`, loc, 'trailing slash variant');
        }
    });
    // 4. scheme, host, home
    await expectRedirect('http://cstech.ai/about', ORIGIN + '/about', 'http -> https');
    await expectRedirect('https://www.cstech.ai/about', ORIGIN + '/about', 'www -> cstech.ai');
    for (const p of ['index.html', 'home', 'home.html']) await expectRedirect(`${ORIGIN}/${p}`, ORIGIN + '/', 'home page variant');
    await expectRedirect(ORIGIN + '/case-studies.html/Industries/Water-Wastewater', ORIGIN + '/case-studies/Industries/Water-Wastewater', 'old filter URL');
    await expectPage(ORIGIN + '/case-studies/Industries/Water-Wastewater', 'filter view');
    // 5. 404s and hidden folders
    for (const p of ['zz-not-a-page', 'services/zz-not-a-page', 'case-studies/zz-not-a-case-study', 'zz-not-a-page.html', 'services/', 'img/', 'includes/', 'seo-migration/redirects.csv', 'seo-migration/', '.git/config', '404', 'services/data-acquisition/extra']) {
        const r = await request(`${ORIGIN}/${p}`, { body: true });
        ok(r.status === 404 && /Page not found/i.test(r.body), `404 check: /${p} -> ${r.status} ${r.location || ''} (want 404 with the custom page)`);
    }
    const inc = await request(ORIGIN + '/includes/header.html');
    ok(inc.status === 200 && /noindex/i.test(inc.headers['x-robots-tag'] || ''), `includes/header.html -> ${inc.status}, X-Robots-Tag "${inc.headers['x-robots-tag'] || ''}" (want 200 + noindex)`);

    // 6. crawl: every internal link / file of every page -> 200 directly
    const linkTargets = new Map();   // url -> first page that uses it
    const uploads = new Set();
    const includeLinks = ['includes/header.html', 'includes/footer.html', 'includes/form.html']
        .filter(f => fs.existsSync(path.join(SITE, f))).map(f => ({ base: ORIGIN + '/', html: fs.readFileSync(path.join(SITE, f), 'utf8'), from: f }));
    const sources = [...[...pages].map(([loc, html]) => ({ base: loc, html, from: loc })), ...includeLinks];
    for (const s of sources) {
        const base = (s.html.match(/<base\s+href="([^"]+)"/i) || [])[1];
        // case-studies.html writes its <base> with JavaScript: the site root
        const b = /document\.write\('<base href=/.test(s.html) ? ORIGIN + '/' : (base ? new URL(base, s.base).href : s.base);
        const markup = s.html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => m.replace(/>[\s\S]*<\/script>$/i, '></script>'));
        const found = [...markup.matchAll(/\s(?:href|src)\s*=\s*"([^"]*)"/gi), ...markup.matchAll(/(?:property|name)="(?:og|twitter):image"\s+content="([^"]*)"/gi)];
        for (const m of found) {
            const v = m[1].trim();
            if (!v || /^(#|mailto:|tel:|javascript:|data:)/i.test(v)) continue;
            let u; try { u = new URL(v, b); } catch (e) { continue; }
            u.hash = '';
            const host = u.hostname.replace(/^www\./, '');
            if (host !== 'cstech.ai' && host !== 'cst.convomax.online') continue;           // external site
            if (host === 'cst.convomax.online') { fail(`link to the demo domain on ${s.from}: ${v}`); continue; }
            if (OLD_FILES.test(u.pathname)) { uploads.add(u.href); continue; }
            if (!linkTargets.has(u.href)) linkTargets.set(u.href, s.from);
        }
    }
    let redirected = 0;
    await pool([...linkTargets.keys()], LIVE ? 4 : 10, async url => {
        const r = await request(url, { method: 'GET' });
        checks++;
        if (r.status === 200) return;
        if (r.status === 301 || r.status === 302) { redirected++; warnings.push(`internal link goes through a redirect: ${url} -> ${r.location}  (on ${linkTargets.get(url)})`); return; }
        fail(`broken link: ${url} -> ${r.status}  (on ${linkTargets.get(url)})`);
    });
    // investor documents (/uploads/...): the old website's files, copied into the new site before upload
    let upMissing = [];
    if (LIVE) {
        await pool([...uploads], 4, async url => { const r = await request(url, { method: 'HEAD' }); if (r.status !== 200) upMissing.push(`${r.status} ${url}`); });
    } else {
        for (const url of uploads) { const f = path.join(SITE, decodeURIComponent(new URL(url).pathname)); if (!fs.existsSync(f)) upMissing.push(url); }
    }

    // ---------- report ----------
    console.log(`\nold URLs: ${rows.length} (${rows.filter(r => r.samePage).length} keep their address) | safety-net sections: ${sections.length} | sitemap pages: ${sitemap.length} | links/files crawled: ${linkTargets.size}`);
    console.log(`checks: ${checks}, failures: ${failures.length}, warnings: ${warnings.length}, time ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log(`old website files used by the new pages (/uploads/..., /privacy-policy.pdf, /img/social-share.jpg): ${uploads.size}, ${LIVE ? 'not reachable' : 'not in the website folder yet'}: ${upMissing.length}`);
    if (upMissing.length && LIVE) { upMissing.slice(0, 15).forEach(x => console.log('  ' + x)); failures.push(`${upMissing.length} old website file(s) not reachable`); }
    else if (upMissing.length) console.log('  -> expected locally: these files stay on the live server (do not delete them when uploading);\n     they are checked with --live. Run with --old-files to list them');
    if (process.argv.includes('--old-files')) upMissing.forEach(x => console.log('  missing: ' + x));
    warnings.slice(0, 20).forEach(w => console.log('  warning: ' + w));
    failures.slice(0, 40).forEach(f => console.log('  FAIL ' + f));
    if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
    console.log(failures.length ? '\nRESULT: FAILED' : '\nRESULT: ALL PASSED');
    process.exit(failures.length ? 1 : 0);
})();
