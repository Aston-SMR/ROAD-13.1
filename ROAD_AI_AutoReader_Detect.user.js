// ==UserScript==
// @name         ROAD AI Auto Reader Detect
// @namespace    ROAD-AI
// @version      0.3
// @description  ROAD AI 真人桌資料結構偵測器｜iPhone拖曳・縮小修正版
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

    const POS_KEY = 'ROAD_AI_DETECT_POS_V03';

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
        color: '#fff',
        border: '2px solid #f2c66d',
        borderRadius: '12px',
        fontSize: '11px',
        lineHeight: '1.45',
        fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',
        boxShadow: '0 4px 18px rgba(0,0,0,.45)',
        pointerEvents: 'auto',
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
        background: 'rgba(15,27,48,.98)',
        borderRadius: '10px 10px 0 0'
    });

    // 只有這個區域負責拖曳
    const dragHandle = document.createElement('div');

    dragHandle.innerHTML =
        '<b style="font-size:13px;color:#f2c66d">' +
        'ROAD AI Auto Reader' +
        '</b>';

    Object.assign(dragHandle.style, {
        flex: '1',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'move',
        touchAction: 'none'
    });

    // 縮小按鈕
    const miniButton = document.createElement('button');
    miniButton.type = 'button';
    miniButton.textContent = '−';

    Object.assign(miniButton.style, {
        width: '30px',
        height: '30px',
        padding: '0',
        margin: '0',
        border: '1px solid #66728b',
        borderRadius: '8px',
        background: '#17233a',
        color: '#fff',
        fontSize: '21px',
        fontWeight: '900',
        lineHeight: '25px',
        position: 'relative',
        zIndex: '10',
        pointerEvents: 'auto',
        touchAction: 'manipulation'
    });

    const content = document.createElement('div');

    Object.assign(content.style, {
        padding: '0 8px 8px 8px',
        maxHeight: 'calc(45vh - 36px)',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
    });

    // 縮小後使用的 AI 按鈕
    const bubble = document.createElement('div');
    bubble.textContent = 'AI';

    Object.assign(bubble.style, {
        display: 'none',
        width: '46px',
        height: '46px',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f2c66d',
        fontSize: '14px',
        fontWeight: '900',
        borderRadius: '50%',
        background: 'rgba(5,12,25,.98)',
        cursor: 'move',
        touchAction: 'none'
    });

    header.appendChild(dragHandle);
    header.appendChild(miniButton);

    box.appendChild(header);
    box.appendChild(content);
    box.appendChild(bubble);

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

            '<div>網域：' + location.hostname + '</div>' +

            '<div>Canvas：<b>' + canvases + '</b></div>' +

            '<div>iframe：<b>' + iframes + '</b></div>' +

            '<div>圖片 IMG：<b>' + images + '</b></div>' +

            '<div>Video：<b>' + videos + '</b></div>' +

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

    function savePosition() {
        try {
            const r = box.getBoundingClientRect();

            localStorage.setItem(
                POS_KEY,
                JSON.stringify({
                    left: r.left,
                    top: r.top
                })
            );
        } catch (e) {}
    }

    function restorePosition() {
        try {
            const raw = localStorage.getItem(POS_KEY);
            if (!raw) return;

            const p = JSON.parse(raw);

            if (
                typeof p.left !== 'number' ||
                typeof p.top !== 'number'
            ) return;

            box.style.right = 'auto';

            box.style.left =
                Math.max(
                    0,
                    Math.min(p.left, window.innerWidth - 50)
                ) + 'px';

            box.style.top =
                Math.max(
                    0,
                    Math.min(p.top, window.innerHeight - 50)
                ) + 'px';

        } catch (e) {}
    }

    function setMinimized(value) {
        minimized = value;

        if (minimized) {

            header.style.display = 'none';
            content.style.display = 'none';
            bubble.style.display = 'flex';

            box.style.width = '46px';
            box.style.height = '46px';
            box.style.borderRadius = '50%';
            box.style.overflow = 'visible';

        } else {

            bubble.style.display = 'none';
            header.style.display = 'flex';
            content.style.display = 'block';

            box.style.width = '210px';
            box.style.height = 'auto';
            box.style.borderRadius = '12px';
            box.style.overflow = 'hidden';

            detect();
        }
    }

    // iPhone：直接在 touchend 執行縮小
    miniButton.addEventListener(
        'touchstart',
        function (e) {
            e.stopPropagation();
        },
        { passive: true }
    );

    miniButton.addEventListener(
        'touchend',
        function (e) {
            e.stopPropagation();

            if (e.cancelable) {
                e.preventDefault();
            }

            setMinimized(true);
        },
        { passive: false }
    );

    // 電腦滑鼠
    miniButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        setMinimized(true);
    });

    function dragStart(x, y) {
        dragging = true;
        moved = false;

        const rect = box.getBoundingClientRect();

        box.style.right = 'auto';
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';

        startX = x;
        startY = y;

        startLeft = rect.left;
        startTop = rect.top;
    }

    function dragMove(x, y) {
        if (!dragging) return;

        const dx = x - startX;
        const dy = y - startY;

        if (
            Math.abs(dx) > 5 ||
            Math.abs(dy) > 5
        ) {
            moved = true;
        }

        let left = startLeft + dx;
        let top = startTop + dy;

        const rect = box.getBoundingClientRect();

        const maxLeft =
            Math.max(
                0,
                window.innerWidth - rect.width
            );

        const maxTop =
            Math.max(
                0,
                window.innerHeight - rect.height
            );

        left =
            Math.max(
                0,
                Math.min(left, maxLeft)
            );

        top =
            Math.max(
                0,
                Math.min(top, maxTop)
            );

        box.style.left = left + 'px';
        box.style.top = top + 'px';
    }

    function dragEnd() {
        if (!dragging) return;

        dragging = false;
        savePosition();
    }

    function addTouchDrag(el, bubbleMode) {

        el.addEventListener(
            'touchstart',
            function (e) {

                if (!e.touches || !e.touches.length) return;

                const t = e.touches[0];

                dragStart(t.clientX, t.clientY);

            },
            { passive: true }
        );

        el.addEventListener(
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

        el.addEventListener(
            'touchend',
            function (e) {

                const wasMoved = moved;

                dragEnd();

                if (
                    bubbleMode &&
                    !wasMoved
                ) {
                    if (e.cancelable) {
                        e.preventDefault();
                    }

                    setMinimized(false);
                }

            },
            { passive: false }
        );
    }

    addTouchDrag(dragHandle, false);
    addTouchDrag(bubble, true);

    // 電腦滑鼠拖曳
    dragHandle.addEventListener(
        'mousedown',
        function (e) {

            if (e.button !== 0) return;

            dragStart(e.clientX, e.clientY);
            e.preventDefault();
        }
    );

    bubble.addEventListener(
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

    bubble.addEventListener(
        'click',
        function () {

            if (!moved) {
                setMinimized(false);
            }

            moved = false;
        }
    );

    restorePosition();
    detect();

    setInterval(detect, 1000);

    const observer = new MutationObserver(function () {
        detect();
    });

    try {
        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true,
                attributes: false
            }
        );
    } catch (e) {}

})();
