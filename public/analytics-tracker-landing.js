/**
 * analytics-tracker-landing.js — Landing Page Tracker v3
 * Full rewrite for accuracy + UTM + error tracking + perf metrics
 */
(function () {
    'use strict';

    var API_URL = '/api/public/analytics';
    var SITE = 'landing';
    var BATCH_INTERVAL = 8000;
    var queue = [];
    var sessionId = '';
    var pageEnteredAt = Date.now();
    var currentPage = '/';
    var utmParams = {};

    function getSessionId() {
        var sid = sessionStorage.getItem('_td_sid');
        if (!sid) {
            sid = 'sid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem('_td_sid', sid);
        }
        return sid;
    }

    // ── UTM ─────────────────────────────────────────────────────
    function parseUtm() {
        try {
            var params = new URLSearchParams(window.location.search);
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
                var v = params.get(k);
                if (v) utmParams[k] = v;
            });
            if (Object.keys(utmParams).length > 0) {
                sessionStorage.setItem('_td_utm', JSON.stringify(utmParams));
            } else {
                var saved = sessionStorage.getItem('_td_utm');
                if (saved) try { utmParams = JSON.parse(saved); } catch (e) { }
            }
            // Also check fbclid, gclid
            var fbclid = params.get('fbclid');
            var gclid = params.get('gclid');
            if (fbclid) utmParams.fbclid = fbclid;
            if (gclid) utmParams.gclid = gclid;
        } catch (e) { }
    }

    function buildEvent(eventType, extra) {
        var evt = {
            site: SITE,
            sessionId: sessionId,
            eventType: eventType,
            page: currentPage,
            referrer: document.referrer || null,
            userAgent: navigator.userAgent,
            screenWidth: window.screen ? window.screen.width : null,
            ts: new Date().toISOString()
        };
        if (extra) evt.payload = extra;
        if (Object.keys(utmParams).length > 0) {
            evt.payload = Object.assign({}, evt.payload || {}, { utm: utmParams });
        }
        return evt;
    }

    function pushEvent(eventType, extra) {
        queue.push(buildEvent(eventType, extra));
    }

    function doFetch(body) {
        try {
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: body,
                keepalive: true,
                credentials: 'omit',
                mode: 'cors'
            }).catch(function () { });
        } catch (e) { }
    }

    function flush() {
        if (queue.length === 0) return;
        var batch = queue.splice(0, queue.length);
        var body = JSON.stringify({ events: batch });
        if (navigator.sendBeacon) {
            var sent = navigator.sendBeacon(API_URL, new Blob([body], { type: 'text/plain' }));
            if (!sent) doFetch(body);
        } else {
            doFetch(body);
        }
    }

    function trackPageView() {
        currentPage = window.location.pathname || '/';
        pushEvent('page_view');
    }

    // ── Section Visibility (IntersectionObserver) ────────────────
    function hookSections() {
        var sections = document.querySelectorAll('section[id], [data-section]');
        if (sections.length === 0) return;
        var seen = {};
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var id = entry.target.id || entry.target.dataset.section || 'unnamed';
                    if (!seen[id]) {
                        seen[id] = true;
                        pushEvent('section_view', { section: id });
                    }
                }
            });
        }, { threshold: 0.3 });
        sections.forEach(function (s) { observer.observe(s); });
    }

    // ── CTA clicks ──────────────────────────────────────────────
    function hookCTA() {
        document.addEventListener('click', function (e) {
            var target = e.target;
            for (var i = 0; i < 5 && target && target !== document.body; i++) {
                var tagName = target.tagName ? target.tagName.toLowerCase() : '';
                var href = target.getAttribute('href') || '';
                var text = target.textContent ? target.textContent.trim().slice(0, 50) : '';
                var id = target.id || '';
                var cls = target.className ? String(target.className).slice(0, 60) : '';

                // Phone click
                if (href.indexOf('tel:') === 0) {
                    pushEvent('phone_click', { href: href, label: text });
                    flush();
                    break;
                }
                // Zalo click
                if (href.indexOf('zalo.me') > -1 || href.indexOf('zalo') > -1 || cls.indexOf('zalo') > -1) {
                    pushEvent('zalo_click', { href: href, label: text });
                    flush();
                    break;
                }
                // CTA button (primary buttons, register, contact etc.)
                if (tagName === 'button' || tagName === 'a') {
                    var isCTA = cls.indexOf('cta') > -1 || cls.indexOf('primary') > -1 ||
                        cls.indexOf('register') > -1 || cls.indexOf('dang-ky') > -1 ||
                        text.match(/đăng ký|liên hệ|gọi ngay|tư vấn|register|contact/i);
                    if (isCTA) {
                        pushEvent('cta_click', { id: id, label: text, class: cls });
                        break;
                    }
                    // Regular click
                    pushEvent('click', { tag: tagName, id: id, label: text, class: cls });
                    break;
                }
                target = target.parentElement;
            }
        }, true);
    }

    // ── Form tracking ───────────────────────────────────────────
    function hookForms() {
        // Track form views via IntersectionObserver
        var forms = document.querySelectorAll('form');
        if (forms.length > 0) {
            var formSeen = {};
            var formObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var fid = entry.target.id || 'form-' + Array.from(document.querySelectorAll('form')).indexOf(entry.target);
                        if (!formSeen[fid]) {
                            formSeen[fid] = true;
                            pushEvent('form_view', { formId: fid });
                        }
                    }
                });
            }, { threshold: 0.5 });
            forms.forEach(function (f) { formObserver.observe(f); });
        }

        // Track form focus
        var focused = {};
        document.addEventListener('focus', function (e) {
            var target = e.target;
            if (target && target.tagName && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                var form = target.closest('form');
                var fid = form ? (form.id || 'form-0') : 'no-form';
                if (!focused[fid]) {
                    focused[fid] = true;
                    pushEvent('form_focus', { formId: fid, field: target.name || target.type });
                }
            }
        }, true);

        // Track form submit
        document.addEventListener('submit', function (e) {
            var form = e.target;
            var fid = form.id || 'form-0';
            pushEvent('form_submit', { formId: fid });
            flush();
        }, true);
    }

    // ── Pricing section view ────────────────────────────────────
    function hookPricing() {
        var el = document.getElementById('pricing') || document.getElementById('bang-gia') || document.querySelector('[data-section="pricing"]');
        if (!el) return;
        var seen = false;
        var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !seen) {
                    seen = true;
                    pushEvent('pricing_view', { section: el.id || 'pricing' });
                }
            });
        }, { threshold: 0.3 });
        obs.observe(el);
    }

    // ── Scroll depth ────────────────────────────────────────────
    function hookScroll() {
        var reported = {};
        window.addEventListener('scroll', function () {
            var scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            var pct = Math.round((scrollTop + window.innerHeight) / scrollHeight * 100);
            [25, 50, 75, 100].forEach(function (m) {
                if (pct >= m && !reported[m]) { reported[m] = true; pushEvent('scroll', { depth: m }); }
            });
        }, { passive: true });
    }

    // ── Error Tracking ──────────────────────────────────────────
    function hookErrors() {
        window.addEventListener('error', function (e) {
            pushEvent('js_error', {
                message: (e.message || '').slice(0, 200),
                file: (e.filename || '').split('/').pop(),
                line: e.lineno,
                col: e.colno
            });
        });
        window.addEventListener('unhandledrejection', function (e) {
            pushEvent('js_error', {
                message: ('Promise: ' + String(e.reason || '')).slice(0, 200),
                type: 'unhandledrejection'
            });
        });
    }

    // ── Performance ─────────────────────────────────────────────
    function trackPerformance() {
        try {
            if (!window.performance || !window.performance.getEntriesByType) return;
            var nav = performance.getEntriesByType('navigation')[0];
            if (nav) {
                pushEvent('perf', {
                    dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
                    tcp: Math.round(nav.connectEnd - nav.connectStart),
                    ttfb: Math.round(nav.responseStart - nav.requestStart),
                    domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
                    load: Math.round(nav.loadEventEnd - nav.startTime),
                    type: nav.type
                });
            }
            if (window.PerformanceObserver) {
                try {
                    new PerformanceObserver(function (list) {
                        var entries = list.getEntries();
                        if (entries.length > 0) {
                            var lcp = entries[entries.length - 1];
                            pushEvent('perf_lcp', { value: Math.round(lcp.startTime), element: (lcp.element ? lcp.element.tagName : '') });
                        }
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                } catch (e) { }
            }
        } catch (e) { }
    }

    function trackSessionEnd() {
        var totalDuration = Math.round((Date.now() - parseInt(sessionStorage.getItem('_td_start') || Date.now())) / 1000);
        pushEvent('session_end', { totalDuration: totalDuration });
        flush();
    }

    function init() {
        sessionId = getSessionId();
        parseUtm();
        if (!sessionStorage.getItem('_td_start')) sessionStorage.setItem('_td_start', String(Date.now()));
        trackPageView();
        hookCTA();
        hookForms();
        hookSections();
        hookPricing();
        hookScroll();
        hookErrors();
        setTimeout(trackPerformance, 3000);
        setInterval(flush, BATCH_INTERVAL);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') trackSessionEnd(); });
        window.addEventListener('beforeunload', function () { trackSessionEnd(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
