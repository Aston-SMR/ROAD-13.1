// ==UserScript==
// @name         ROAD AI Auto Reader Data Detect
// @namespace    ROAD-AI
// @version      0.5
// @description  ROAD AI 歷史P/B/T資料探測器
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.top !== window) return;
    if (window.__ROAD_AI_DATA_DETECT__) return;
    window.__ROAD_AI_DATA_DETECT__ = true;

    const box = document.createElement('div');

    Object.assign(box.style, {
        position: 'fixed',
        left: '4px',
        bottom: '4px',
        width: '250px',
        maxHeight: '42vh',
        overflow: 'auto',
        zIndex: '2147483647',
        background: 'rgba(5,12,25,.96)',
        color: '#fff',
        border: '2px solid #f2c66d',
        borderRadius: '9px',
        padding: '7px',
        fontSize: '10px',
        lineHeight: '1.35',
        fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
        pointerEvents: 'none'
    });

    document.documentElement.appendChild(box);

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function short(v, n) {
        let s = '';

        try {
            s = typeof v === 'string'
                ? v
                : JSON.stringify(v);
        } catch (e) {
            s = String(v);
        }

        s = s.replace(/\s+/g, ' ');

        return s.length > n
            ? s.slice(0, n) + '…'
            : s;
    }

    function interestingName(name) {
        return /road|result|history|record|game|baccarat|banker|player|tie|shoe|bead|bigroad|bigeye|smallroad|cockroach|dragon|winner|round/i
            .test(name);
    }

    function interestingValue(value) {
        let s = '';

        try {
            s = typeof value === 'string'
                ? value
                : JSON.stringify(value);
        } catch (e) {
            return false;
        }

        if (!s) return false;

        return (
            /banker|player|tie|baccarat|bigroad|bigeye|smallroad|winner/i.test(s) ||
            /["']?[PBT]["']?/i.test(s)
        );
    }

    function scanStorage(storage, label) {
        const hits = [];

        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                const value = storage.getItem(key);

                if (
                    interestingName(key || '') ||
                    interestingValue(value)
                ) {
                    hits.push({
                        source: label,
                        name: key || '',
                        value: short(value, 350)
                    });
                }

                if (hits.length >= 20) break;
            }
        } catch (e) {}

        return hits;
    }

    function scanWindow() {
        const hits = [];
        let names = [];

        try {
            names = Object.getOwnPropertyNames(window);
        } catch (e) {
            return hits;
        }

        for (let i = 0; i < names.length; i++) {
            const name = names[i];

            if (!interestingName(name)) continue;

            let value;

            try {
                value = window[name];
            } catch (e) {
                continue;
            }

            const type = typeof value;

            if (
                type === 'function' ||
                type === 'undefined'
            ) {
                continue;
            }

            let preview = '';

            try {
                preview = short(value, 350);
            } catch (e) {
                continue;
            }

            hits.push({
                source: 'WINDOW',
                name: name,
                value: preview
            });

            if (hits.length >= 30) break;
        }

        return hits;
    }

    function scanScripts() {
        const hits = [];

        try {
            const scripts =
                document.querySelectorAll('script');

            scripts.forEach(function (s, i) {
                const text = s.textContent || '';

                if (!text) return;

                if (
                    /banker|player|tie|bigroad|bigeye|smallroad|baccarat|gameResult|roadData|history/i
                        .test(text)
                ) {
                    hits.push({
                        source: 'SCRIPT',
                        name: '#' + (i + 1),
                        value: short(text, 350)
                    });
                }
            });
        } catch (e) {}

        return hits.slice(0, 10);
    }

    function findArrays() {
        const hits = [];
        let names = [];

        try {
            names = Object.getOwnPropertyNames(window);
        } catch (e) {
            return hits;
        }

        for (let i = 0; i < names.length; i++) {
            const name = names[i];

            let value;

            try {
                value = window[name];
            } catch (e) {
                continue;
            }

            if (!Array.isArray(value)) continue;

            if (value.length < 3) continue;

            const preview = short(value, 500);

            if (
                interestingName(name) ||
                interestingValue(preview)
            ) {
                hits.push({
                    source: 'ARRAY',
                    name:
                        name +
                        ' [' +
                        value.length +
                        ']',
                    value: preview
                });
            }

            if (hits.length >= 20) break;
        }

        return hits;
    }

    function renderHit(h) {
        return (
            '<div style="margin-top:5px;' +
            'padding-top:4px;' +
            'border-top:1px solid #33405c">' +

            '<b style="color:#79b9ff">' +
            esc(h.source) +
            '</b> ' +

            '<b style="color:#f2c66d">' +
            esc(h.name) +
            '</b>' +

            '<div style="color:#c5ccda;' +
            'word-break:break-all">' +
            esc(h.value) +
            '</div>' +

            '</div>'
        );
    }

    function detect() {
        const storageHits = [
            ...scanStorage(
                window.localStorage,
                'LOCAL'
            ),
            ...scanStorage(
                window.sessionStorage,
                'SESSION'
            )
        ];

        const windowHits = scanWindow();
        const arrayHits = findArrays();
        const scriptHits = scanScripts();

        const all = [
            ...storageHits,
            ...arrayHits,
            ...windowHits,
            ...scriptHits
        ];

        let html =
            '<div style="font-size:12px;' +
            'font-weight:900;' +
            'color:#f2c66d">' +
            'ROAD AI 資料探測 V0.5' +
            '</div>' +

            '<div style="color:#38d98a;' +
            'font-weight:800">' +
            '● 搜尋歷史 P/B/T' +
            '</div>' +

            '<div style="margin-top:4px">' +
            '網域：' +
            esc(location.hostname) +
            '</div>' +

            '<div>' +
            'Storage：<b>' +
            storageHits.length +
            '</b>　' +

            'Array：<b>' +
            arrayHits.length +
            '</b>　' +

            'Window：<b>' +
            windowHits.length +
            '</b>　' +

            'Script：<b>' +
            scriptHits.length +
            '</b>' +
            '</div>';

        if (!all.length) {
            html +=
                '<div style="margin-top:8px;' +
                'color:#ffcc73">' +
                '目前沒有找到明顯資料' +
                '</div>';
        } else {
            all
                .slice(0, 40)
                .forEach(function (h) {
                    html += renderHit(h);
                });
        }

        box.innerHTML = html;
    }

    detect();
    setInterval(detect, 2500);

})();
