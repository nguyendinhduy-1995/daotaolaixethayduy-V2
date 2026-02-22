/**
 * analytics-tracker-landing.js — Landing Page Tracker
 * Tracks: page views, clicks, scroll, session + landing-specific:
 * - section_view, cta_click, phone_click, form_focus, form_submit,
 *   pricing_view, tools_click, zalo_click
 */
(function () {
    'use strict';

    var API_URL = '/api/public/analytics';
    var SITE = 'landing';
    var BATCH_INTERVAL = 10000;
    var queue = [];
    var sessionId = '';
    var pageEnteredAt = Date.now();
    var currentPage = '/';
    var lastTrackedPath = '';

    function getSessionId() {
        var sid = sessionStorage.getItem('_td_sid');
        if (!sid) {
            sid = 'sid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem('_td_sid', sid);
        }
        return sid;
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

    function trackPageView(pageName) {
        var now = Date.now();
        var durationSec = Math.round((now - pageEnteredAt) / 1000);
        if (durationSec > 0 && currentPage) {
            pushEvent('page_duration', { page: currentPage, duration: durationSec });
        }
        currentPage = pageName || '/';
        pageEnteredAt = now;
        pushEvent('page_view');
    }

    function pollNavigation() {
        var path = window.location.pathname;
        if (path !== lastTrackedPath) {
            lastTrackedPath = path;
            trackPageView(path);
        }
    }

    // ── Section visibility tracking ───────────────────────────
    function hookSections() {
        var sections = ['hero', 'pricing', 'roadmap', 'tools', 'dang-ky'];
        var viewedSections = {};

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !viewedSections[entry.target.id]) {
                    viewedSections[entry.target.id] = true;
                    pushEvent('section_view', { section: entry.target.id });

                    if (entry.target.id === 'pricing') pushEvent('pricing_view', {});
                    if (entry.target.id === 'dang-ky') pushEvent('form_view', {});
                }
            });
        }, { threshold: 0.3 });

        // Wait for DOM to settle then observe
        setTimeout(function () {
            sections.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) observer.observe(el);
            });
        }, 1000);
    }

    // ── Click tracking with intent detection ──────────────────
    function hookClicks() {
        document.addEventListener('click', function (e) {
            var target = e.target;
            for (var i = 0; i < 5 && target && target !== document.body; i++) {
                var tagName = target.tagName ? target.tagName.toLowerCase() : '';

                // Phone number clicks
                if (tagName === 'a' && target.href && target.href.indexOf('tel:') === 0) {
                    pushEvent('phone_click', { phone: target.href.replace('tel:', '') });
                    break;
                }

                // Zalo clicks
                if (tagName === 'a' && target.href && target.href.indexOf('zalo') >= 0) {
                    pushEvent('zalo_click', { href: target.href.slice(0, 200) });
                    break;
                }

                // CTA buttons (đăng ký, liên hệ, etc.)
                if (tagName === 'button' || tagName === 'a') {
                    var label = target.textContent ? target.textContent.trim().slice(0, 50) : '';
                    var id = target.id || '';
                    var lowerLabel = label.toLowerCase();

                    if (lowerLabel.indexOf('đăng ký') >= 0 || lowerLabel.indexOf('dang ky') >= 0 || lowerLabel.indexOf('liên hệ') >= 0) {
                        pushEvent('cta_click', { label: label, id: id });
                    }

                    pushEvent('click', { tag: tagName, id: id, label: label });
                    break;
                }
                target = target.parentElement;
            }
        }, true);
    }

    // ── Form interaction tracking ─────────────────────────────
    function hookForms() {
        // Focus on form fields
        document.addEventListener('focusin', function (e) {
            var target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
                var form = target.closest('form');
                if (form) {
                    pushEvent('form_focus', { field: target.name || target.id || target.type, formId: form.id || '' });
                }
            }
        }, true);

        // Form submit
        document.addEventListener('submit', function (e) {
            var form = e.target;
            if (form && form.tagName === 'FORM') {
                pushEvent('form_submit', { formId: form.id || '', action: (form.action || '').slice(0, 200) });
            }
        }, true);
    }

    // ── Scroll depth ──────────────────────────────────────────
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

    function trackSessionEnd() {
        var totalDuration = Math.round((Date.now() - parseInt(sessionStorage.getItem('_td_start') || Date.now())) / 1000);
        pushEvent('session_end', { totalDuration: totalDuration });
        flush();
    }

    function init() {
        sessionId = getSessionId();
        if (!sessionStorage.getItem('_td_start')) sessionStorage.setItem('_td_start', String(Date.now()));
        lastTrackedPath = window.location.pathname;
        trackPageView(lastTrackedPath);
        hookClicks();
        hookForms();
        hookSections();
        hookScroll();
        setInterval(pollNavigation, 500);
        setInterval(flush, BATCH_INTERVAL);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') trackSessionEnd(); });
        window.addEventListener('beforeunload', function () { trackSessionEnd(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
