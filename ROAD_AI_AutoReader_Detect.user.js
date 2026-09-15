// ==UserScript==
// @name         ROAD AI Auto Reader Detect
// @namespace    ROAD-AI
// @version      0.2
// @description  ROAD AI 真人桌資料結構偵測器｜可拖曳・可縮小
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_DETECT__) return;
    window.__ROAD_AI_DETECT__ = true;

    let minimized = false;
    let dragging = false;
    let moved = false;

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const box = document.createElement('div');
    box.id = 'road-ai-detect-box';

    Object.assign(box.style, {
        position: 'fixed',
        top: '70px',
        right: '8px',
        width: '210px',
        maxHeight: '45vh',
        overflow: 'hidden',
        zIndex: '2147483647',
        background: 'rgba(5,12,25,.96)',
        color: '#ffffff',
        border: '2px solid #f2c66d',
        borderRadius: '12px',
        fontSize: '11px',
        lineHeight: '1.45',
        fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
        boxShadow: '0 4px 18px rgba(0,0,0,.45)',
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none'
    });

    const header = document.createElement('div');

    Object.assign(header.style, {
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        cursor: 'move',
        touchAction: 'none',
        background: 'rgba(15,27,48,.98)',
        borderRadius: '10px 10px 0 0'
    });

    const title = document.createElement('div');

    title.innerHTML =
        '<b style="font-size:13px;color:#f2c66d">' +
        'ROAD AI Auto Reader' +
        '</b>';

    const miniButton = document.createElement('button');

    miniButton.textContent = '−';

    Object.assign(miniButton.style, {
        width: '28px',
        height: '28px',
        padding: '0',
        border: '1px solid #66728b',
        borderRadius: '7px',
        background: '#17233a',
        color: '#ffffff',
        fontSize: '20px',
        fontWeight: '900',
        lineHeight: '24px',
        cursor: 'pointer'
    });

    const content = document.createElement('div');

    Object.assign(content.style, {
        padding: '0 8px 8px 8px',
        maxHeight: 'calc(45vh - 36px)',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
    });

    header.appendChild(title);
    header.appendChild(miniButton);

    box.appendChild(header);
    box.appendChild(content);

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
        if (minimized) return;

        const text = safeText();

        const canvases = count('canvas');
        const iframes = count('iframe');
        const images = count('img');
        const videos = count('video');

        const hasPlayer = /PLAYER|閒|闲/i.test(text);
        const hasBanker = /BANKER|莊|庄/i.test(text);
        const hasTie = /TIE|和/i.test(text);

        const cardWords =
            text.match(
                /(?:^|\s)(?:A|[2-9]|10|J|Q|K)(?:\s|$)/gi
            ) || [];

        const iframeInfo = [];

        try {
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
        } catch (e) {}

        content.innerHTML =
            '<div style="color:#38d98a;font-weight:800;padding-top:4px">' +
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

    function toggleMinimize() {

        minimized = !minimized;

        if (minimized) {

            content.style.display = 'none';

            title.style.display = 'none';

            box.style.width = '46px';
            box.style.height = '46px';
            box.style.borderRadius = '23px';
            box.style.overflow = 'hidden';

            header.style.width = '46px';
            header.style.height = '46px';
            header.style.padding = '0';
            header.style.justifyContent = 'center';
            header.style.borderRadius = '23px';

            miniButton.textContent = 'AI';

            Object.assign(miniButton.style, {
                width: '42px',
                height: '42px',
                border: '0',
                borderRadius: '21px',
                background: 'transparent',
                color: '#f2c66d',
                fontSize: '13px',
                fontWeight: '900'
            });

        } else {

            box.style.width = '210px';
            box.style.height = 'auto';
            box.style.borderRadius = '12px';
            box.style.overflow = 'hidden';

            header.style.width = 'auto';
            header.style.height = '36px';
            header.style.padding = '0 8px';
            header.style.justifyContent = 'space-between';
            header.style.borderRadius = '10px 10px 0 0';

            title.style.display = 'block';

            miniButton.textContent = '−';

            Object.assign(miniButton.style, {
                width: '28px',
                height: '28px',
                border: '1px solid #66728b',
                borderRadius: '7px',
                background: '#17233a',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: '900'
            });

            content.style.display = 'block';

            detect();
        }
    }

    miniButton.addEventListener('click', function (e) {

        e.preventDefault();
        e.stopPropagation();

        if (moved) {
            moved = false;
            return;
        }

        toggleMinimize();
    });

    function dragStart(clientX, clientY) {

        dragging = true;
        moved = false;

        const rect = box.getBoundingClientRect();

        box.style.right = 'auto';
        box.style.bottom = 'auto';

        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';

        startX = clientX;
        startY = clientY;

        startLeft = rect.left;
        startTop = rect.top;
    }

    function dragMove(clientX, clientY) {

        if (!dragging) return;

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            moved = true;
        }

        let newLeft = startLeft + dx;
        let newTop = startTop + dy;

        const rect = box.getBoundingClientRect();

        const maxLeft =
            Math.max(0, window.innerWidth - rect.width);

        const maxTop =
            Math.max(0, window.innerHeight - rect.height);

        newLeft =
            Math.max(0, Math.min(newLeft, maxLeft));

        newTop =
            Math.max(0, Math.min(newTop, maxTop));

        box.style.left = newLeft + 'px';
        box.style.top = newTop + 'px';
    }

    function dragEnd() {
        dragging = false;
    }

    header.addEventListener(
        'touchstart',
        function (e) {

            if (!e.touches || !e.touches.length) return;

            const t = e.touches[0];

            dragStart(t.clientX, t.clientY);

        },
        { passive: true }
    );

    document.addEventListener(
        'touchmove',
        function (e) {

            if (!dragging) return;
            if (!e.touches || !e.touches.length) return;

            const t = e.touches[0];

            dragMove(t.clientX, t.clientY);

            if (e.cancelable) {
                e.preventDefault();
            }

        },
        { passive: false }
    );

    document.addEventListener(
        'touchend',
        function () {
            dragEnd();
        },
        { passive: true }
    );

    header.addEventListener(
        'mousedown',
        function (e) {

            if (e.button !== 0) return;

            dragStart(e.clientX, e.clientY);

            e.preventDefault();
        }
    );

    document.addEventListener(
        'mousemove',
        function (e) {

            if (!dragging) return;

            dragMove(e.clientX, e.clientY);
        }
    );

    document.addEventListener(
        'mouseup',
        function () {
            dragEnd();
        }
    );

    detect();

    setInterval(detect, 1000);

    const observer = new MutationObserver(function () {
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
