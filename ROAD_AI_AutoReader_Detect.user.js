// ==UserScript==
// @name         ROAD AI Live Card Detect
// @namespace    ROAD-AI
// @version      0.6
// @description  ROAD AI 即時牌面資料偵測器｜WebSocket Fetch XHR
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_LIVE_DETECT__) return;
    window.__ROAD_AI_LIVE_DETECT__ = true;

    const MAX_LOG = 25;
    const logs = [];

    let wsCount = 0;
    let fetchCount = 0;
    let xhrCount = 0;
    let candidateCount = 0;

    let box = null;
    let logBox = null;
    let statusBox = null;

    function nowTime() {
        const d = new Date();

        return (
            String(d.getHours()).padStart(2, '0') +
            ':' +
            String(d.getMinutes()).padStart(2, '0') +
            ':' +
            String(d.getSeconds()).padStart(2, '0')
        );
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function clean(v) {
        return String(v == null ? '' : v)
            .replace(/\s+/g, ' ')
            .trim();
    }

    function short(v, n) {
        const s = clean(v);

        return s.length > n
            ? s.slice(0, n) + '…'
            : s;
    }

    /*
     * 只挑看起來可能與百家樂、
     * 牌值、勝負、局號有關的資料。
     */
    function looksInteresting(text) {
        if (!text) return false;

        const s = String(text);

        return (
            /banker|player|tie|winner|result|card|cards|poker|baccarat|round|shoe|gameNo|tableNo|閒|闲|莊|庄|和/i.test(s) ||

            /"(?:A|[2-9]|10|J|Q|K)"/i.test(s) ||

            /(?:^|[^A-Z0-9])(?:A|10|J|Q|K)(?:[^A-Z0-9]|$)/i.test(s)
        );
    }

    function updateStatus() {
        if (!statusBox) return;

        statusBox.innerHTML =
            'WS：<b>' + wsCount + '</b>　' +
            'Fetch：<b>' + fetchCount + '</b>　' +
            'XHR：<b>' + xhrCount + '</b><br>' +
            '疑似牌局資料：<b style="color:#f2c66d">' +
            candidateCount +
            '</b>';
    }

    function renderLogs() {
        if (!logBox) return;

        if (!logs.length) {
            logBox.innerHTML =
                '<div style="color:#91a0bd;margin-top:6px">' +
                '等待新一局資料…' +
                '</div>';

            return;
        }

        logBox.innerHTML = logs
            .map(function (x) {

                return (
                    '<div style="' +
                    'margin-top:5px;' +
                    'padding-top:4px;' +
                    'border-top:1px solid #33405c">' +

                    '<b style="color:#79b9ff">' +
                    esc(x.type) +
                    '</b> ' +

                    '<span style="color:#91a0bd">' +
                    esc(x.time) +
                    '</span>' +

                    '<div style="' +
                    'color:#fff;' +
                    'word-break:break-all">' +
                    esc(x.text) +
                    '</div>' +

                    '</div>'
                );
            })
            .join('');
    }

    function addCandidate(type, data) {
        let text = '';

        try {
            if (typeof data === 'string') {
                text = data;
            } else if (data instanceof ArrayBuffer) {
                text = '[ArrayBuffer ' + data.byteLength + ' bytes]';
            } else if (ArrayBuffer.isView(data)) {
                text =
                    '[Binary ' +
                    data.byteLength +
                    ' bytes]';
            } else {
                text = JSON.stringify(data);
            }
        } catch (e) {
            text = String(data);
        }

        if (!text) return;

        /*
         * Binary 先記錄存在，
         * 但不假裝已經能解讀。
         */
        const binary =
            /^\[(?:ArrayBuffer|Binary)/.test(text);

        if (
            !binary &&
            !looksInteresting(text)
        ) {
            return;
        }

        candidateCount++;

        logs.unshift({
            type: type,
            time: nowTime(),
            text: short(text, 600)
        });

        if (logs.length > MAX_LOG) {
            logs.length = MAX_LOG;
        }

        updateStatus();
        renderLogs();
    }

    /*
     * WebSocket
     */
    try {
        const NativeWebSocket = window.WebSocket;

        if (NativeWebSocket) {

            const WrappedWebSocket = function () {
                const ws =
                    Reflect.construct(
                        NativeWebSocket,
                        arguments,
                        new.target || WrappedWebSocket
                    );

                wsCount++;
                updateStatus();

                try {
                    ws.addEventListener(
                        'message',
                        function (event) {
                            addCandidate(
                                'WS IN',
                                event.data
                            );
                        }
                    );
                } catch (e) {}

                try {
                    const nativeSend =
                        ws.send;

                    ws.send = function (data) {
                        addCandidate(
                            'WS OUT',
                            data
                        );

                        return nativeSend.apply(
                            this,
                            arguments
                        );
                    };
                } catch (e) {}

                return ws;
            };

            WrappedWebSocket.prototype =
                NativeWebSocket.prototype;

            try {
                Object.defineProperties(
                    WrappedWebSocket,
                    {
                        CONNECTING: {
                            value: NativeWebSocket.CONNECTING
                        },
                        OPEN: {
                            value: NativeWebSocket.OPEN
                        },
                        CLOSING: {
                            value: NativeWebSocket.CLOSING
                        },
                        CLOSED: {
                            value: NativeWebSocket.CLOSED
                        }
                    }
                );
            } catch (e) {}

            window.WebSocket =
                WrappedWebSocket;
        }
    } catch (e) {}

    /*
     * fetch
     */
    try {
        const nativeFetch = window.fetch;

        if (nativeFetch) {

            window.fetch = function () {
                fetchCount++;
                updateStatus();

                const p =
                    nativeFetch.apply(
                        this,
                        arguments
                    );

                try {
                    p.then(function (response) {

                        try {
                            const clone =
                                response.clone();

                            clone.text()
                                .then(function (text) {
                                    addCandidate(
                                        'FETCH',
                                        text
                                    );
                                })
                                .catch(function () {});
                        } catch (e) {}

                    }).catch(function () {});
                } catch (e) {}

                return p;
            };
        }
    } catch (e) {}

    /*
     * XMLHttpRequest
     */
    try {
        const nativeOpen =
            XMLHttpRequest.prototype.open;

        const nativeSend =
            XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open =
            function (method, url) {

                try {
                    this.__roadAiUrl =
                        String(url || '');
                } catch (e) {}

                return nativeOpen.apply(
                    this,
                    arguments
                );
            };

        XMLHttpRequest.prototype.send =
            function () {

                xhrCount++;
                updateStatus();

                try {
                    this.addEventListener(
                        'load',
                        function () {

                            let data = '';

                            try {
                                if (
                                    typeof this.responseText ===
                                    'string'
                                ) {
                                    data =
                                        this.responseText;
                                }
                            } catch (e) {}

                            if (data) {
                                addCandidate(
                                    'XHR',
                                    data
                                );
                            }
                        }
                    );
                } catch (e) {}

                return nativeSend.apply(
                    this,
                    arguments
                );
            };
    } catch (e) {}

    function createUI() {
        if (box) return;

        box =
            document.createElement('div');

        Object.assign(
            box.style,
            {
                position: 'fixed',
                left: '4px',
                bottom: '4px',
                width: '255px',
                maxHeight: '38vh',
                overflow: 'auto',
                zIndex: '2147483647',
                background:
                    'rgba(5,12,25,.96)',
                color: '#fff',
                border:
                    '2px solid #f2c66d',
                borderRadius: '9px',
                padding: '7px',
                fontSize: '10px',
                lineHeight: '1.35',
                fontFamily:
                    '-apple-system,BlinkMacSystemFont,sans-serif',
                pointerEvents: 'none'
            }
        );

        box.innerHTML =
            '<div style="' +
            'font-size:12px;' +
            'font-weight:900;' +
            'color:#f2c66d">' +
            'ROAD AI 即時牌面 V0.6' +
            '</div>' +

            '<div style="' +
            'color:#38d98a;' +
            'font-weight:800">' +
            '● 等待新局資料' +
            '</div>' +

            '<div id="road-ai-live-status"' +
            ' style="margin-top:4px"></div>' +

            '<div id="road-ai-live-log"></div>';

        (
            document.documentElement ||
            document.body
        ).appendChild(box);

        statusBox =
            box.querySelector(
                '#road-ai-live-status'
            );

        logBox =
            box.querySelector(
                '#road-ai-live-log'
            );

        updateStatus();
        renderLogs();
    }

    function waitForDOM() {
        if (
            document.documentElement
        ) {
            createUI();
            return;
        }

        setTimeout(
            waitForDOM,
            20
        );
    }

    waitForDOM();

})();
