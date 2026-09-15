// ==UserScript==
// @name         ROAD AI Auto Reader Detect
// @namespace    ROAD-AI
// @version      0.1
// @description  ROAD AI 真人桌資料結構偵測器
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_DETECT__) return;
    window.__ROAD_AI_DETECT__ = true;

    const box = document.createElement('div');

    box.id = 'road-ai-detect-box';

    Object.assign(box.style, {
        position: 'fixed',
        top: '70px',
        right: '8px',
        width: '210px',
        maxHeight: '45vh',
        overflow: 'auto',
        zIndex: '2147483647',
        background: 'rgba(5,12,25,.94)',
        color: '#ffffff',
        border: '2px solid #f2c66d',
        borderRadius: '10px',
        padding: '8px',
        fontSize: '11px',
        lineHeight: '1.45',
        fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
        boxShadow: '0 4px 18px rgba(0,0,0,.45)',
        pointerEvents: 'none'
    });

    document.documentElement.appendChild(box);

    function safeText() {
        try {
            return (document.body && document.body.innerText) || '';
        } catch (e) {
            return '';
        }
    }

    function count(selector) {
        try {
            return document.querySelectorAll(selector).length;
        } catch (e) {
            return 0;
        }
    }

    function detect() {
        const text = safeText();

        const canvases = count('canvas');
        const iframes = count('iframe');
        const images = count('img');
        const videos = count('video');

        const hasPlayer =
            /PLAYER|閒|闲/i.test(text);

        const hasBanker =
            /BANKER|莊|庄/i.test(text);

        const hasTie =
            /TIE|和/i.test(text);

        const cardWords =
            text.match(
                /(?:^|\s)(?:A|[2-9]|10|J|Q|K)(?:\s|$)/gi
            ) || [];

        const iframeInfo = [];

        document.querySelectorAll('iframe').forEach((f, i) => {
            let src = '';

            try {
                src = f.src || '(no src)';
            } catch (e) {
                src = '(blocked)';
            }

            iframeInfo.push(
                '#' + (i + 1) + ' ' + src.slice(0, 80)
            );
        });

        box.innerHTML =
            '<div style="font-size:13px;font-weight:900;color:#f2c66d">' +
            'ROAD AI Auto Reader' +
            '</div>' +

            '<div style="color:#38d98a;font-weight:800">' +
            '● 偵測中' +
            '</div>' +

            '<hr style="border:0;border-top:1px solid #33405c">' +

            '<div>網域：' +
            location.hostname +
            '</div>' +

            '<div>Canvas：<b>' +
            canvases +
            '</b></div>' +

            '<div>iframe：<b>' +
            iframes +
            '</b></div>' +

            '<div>圖片 IMG：<b>' +
            images +
            '</b></div>' +

            '<div>Video：<b>' +
            videos +
            '</b></div>' +

            '<div>PLAYER/閒文字：<b>' +
            (hasPlayer ? '找到' : '沒有') +
            '</b></div>' +

            '<div>BANKER/莊文字：<b>' +
            (hasBanker ? '找到' : '沒有') +
            '</b></div>' +

            '<div>和/TIE文字：<b>' +
            (hasTie ? '找到' : '沒有') +
            '</b></div>' +

            '<div>疑似牌值文字：<b>' +
            cardWords.length +
            '</b></div>' +

            '<div style="margin-top:5px;color:#91a0bd">' +
            'DOM文字長度：' +
            text.length +
            '</div>' +

            (
                iframeInfo.length
                    ? '<div style="margin-top:5px;color:#91a0bd">' +
                      'iframe：<br>' +
                      iframeInfo.join('<br>') +
                      '</div>'
                    : ''
            );
    }

    detect();

    setInterval(detect, 1000);

    const observer = new MutationObserver(() => {
        detect();
    });

    try {
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: false
        });
    } catch (e) {}

})();
