// ==UserScript==
// @name         ROAD AI Live Packet Detect
// @namespace    ROAD-AI
// @version      0.7
// @description  ROAD AI 即時牌面｜WebSocket二進位封包解析
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_PACKET_DETECT__) return;
    window.__ROAD_AI_PACKET_DETECT__ = true;

    const MAX_LOG = 18;

    let box = null;
    let statusBox = null;
    let logBox = null;

    let wsCount = 0;
    let packetCount = 0;
    let binaryCount = 0;

    const logs = [];

    function timeNow() {
        const d = new Date();

        return (
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0') + '.' +
            String(d.getMilliseconds()).padStart(3, '0')
        );
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function bytesToHex(bytes, max) {
        const len = Math.min(bytes.length, max);
        const out = [];

        for (let i = 0; i < len; i++) {
            out.push(
                bytes[i]
                    .toString(16)
                    .padStart(2, '0')
                    .toUpperCase()
            );
        }

        return out.join(' ');
    }

    function bytesToDecimal(bytes, max) {
        const len = Math.min(bytes.length, max);
        const out = [];

        for (let i = 0; i < len; i++) {
            out.push(String(bytes[i]));
        }

        return out.join(',');
    }

    function tryUTF8(bytes) {
        try {
            const decoder =
                new TextDecoder('utf-8', {
                    fatal: false
                });

            let text = decoder.decode(bytes);

            text = text
                .replace(/\u0000/g, '·')
                .replace(
                    /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g,
                    '·'
                )
                .trim();

            if (!text) return '';

            return text.length > 220
                ? text.slice(0, 220) + '…'
                : text;

        } catch (e) {
            return '';
        }
    }

    function looksReadable(text) {
        if (!text) return false;

        let printable = 0;

        for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i);

            if (
                c === 9 ||
                c === 10 ||
                c === 13 ||
                c >= 32
            ) {
                printable++;
            }
        }

        return (
            printable /
            Math.max(1, text.length)
        ) > 0.65;
    }

    function addLog(direction, bytes) {
        packetCount++;
        binaryCount++;

        const utf8 = tryUTF8(bytes);

        logs.unshift({
            time: timeNow(),
            direction: direction,
            size: bytes.length,
            hex: bytesToHex(bytes, 96),
            dec: bytesToDecimal(bytes, 48),
            utf8:
                looksReadable(utf8)
                    ? utf8
                    : ''
        });

        if (logs.length > MAX_LOG) {
            logs.length = MAX_LOG;
        }

        updateUI();
    }

    async function processData(direction, data) {
        try {
            if (data instanceof ArrayBuffer) {
                addLog(
                    direction,
                    new Uint8Array(data)
                );
                return;
            }

            if (ArrayBuffer.isView(data)) {
                addLog(
                    direction,
                    new Uint8Array(
                        data.buffer,
                        data.byteOffset,
                        data.byteLength
                    )
                );
                return;
            }

            if (
                typeof Blob !== 'undefined' &&
                data instanceof Blob
            ) {
                const buffer =
                    await data.arrayBuffer();

                addLog(
                    direction,
                    new Uint8Array(buffer)
                );

                return;
            }

            if (typeof data === 'string') {
                const encoder =
                    new TextEncoder();

                addLog(
                    direction + ' TEXT',
                    encoder.encode(data)
                );
            }

        } catch (e) {}
    }

    function updateUI() {
        if (!statusBox || !logBox) return;

        statusBox.innerHTML =
            'WebSocket：<b>' +
            wsCount +
            '</b>　封包：<b>' +
            packetCount +
            '</b><br>' +

            'Binary：<b style="color:#f2c66d">' +
            binaryCount +
            '</b>';

        if (!logs.length) {
            logBox.innerHTML =
                '<div style="margin-top:6px;color:#91a0bd">' +
                '等待 WebSocket 封包…' +
                '</div>';

            return;
        }

        logBox.innerHTML =
            logs.map(function (x) {

                let html =
                    '<div style="' +
                    'margin-top:6px;' +
                    'padding-top:5px;' +
                    'border-top:1px solid #33405c">' +

                    '<b style="color:#79b9ff">' +
                    esc(x.direction) +
                    '</b> ' +

                    '<span style="color:#91a0bd">' +
                    esc(x.time) +
                    '</span> ' +

                    '<b style="color:#f2c66d">' +
                    x.size +
                    'B</b>';

                if (x.utf8) {
                    html +=
                        '<div style="' +
                        'margin-top:3px;' +
                        'color:#38d98a;' +
                        'word-break:break-all">' +
                        'TXT：' +
                        esc(x.utf8) +
                        '</div>';
                }

                html +=
                    '<div style="' +
                    'margin-top:3px;' +
                    'color:#fff;' +
                    'word-break:break-all">' +
                    'HEX：' +
                    esc(x.hex) +
                    '</div>' +

                    '<div style="' +
                    'margin-top:3px;' +
                    'color:#aab5ca;' +
                    'word-break:break-all">' +
                    'DEC：' +
                    esc(x.dec) +
                    '</div>' +

                    '</div>';

                return html;
            }).join('');
    }

    /*
     * WebSocket 攔截
     */
    try {
        const NativeWebSocket =
            window.WebSocket;

        if (NativeWebSocket) {

            function RoadAIWebSocket() {
                const ws =
                    Reflect.construct(
                        NativeWebSocket,
                        arguments,
                        new.target || RoadAIWebSocket
                    );

                wsCount++;

                try {
                    ws.binaryType =
                        'arraybuffer';
                } catch (e) {}

                try {
                    ws.addEventListener(
                        'message',
                        function (event) {
                            processData(
                                'IN',
                                event.data
                            );
                        }
                    );
                } catch (e) {}

                try {
                    const nativeSend =
                        ws.send;

                    ws.send =
                        function (data) {

                            processData(
                                'OUT',
                                data
                            );

                            return nativeSend.apply(
                                this,
                                arguments
                            );
                        };
                } catch (e) {}

                updateUI();

                return ws;
            }

            RoadAIWebSocket.prototype =
                NativeWebSocket.prototype;

            try {
                Object.setPrototypeOf(
                    RoadAIWebSocket,
                    NativeWebSocket
                );
            } catch (e) {}

            ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
                .forEach(function (name) {
                    try {
                        Object.defineProperty(
                            RoadAIWebSocket,
                            name,
                            {
                                value:
                                    NativeWebSocket[name]
                            }
                        );
                    } catch (e) {}
                });

            window.WebSocket =
                RoadAIWebSocket;
        }

    } catch (e) {}

    function createUI() {
        if (box) return;

        box =
            document.createElement('div');

        Object.assign(box.style, {
            position: 'fixed',
            left: '4px',
            bottom: '4px',
            width: '270px',
            maxHeight: '40vh',
            overflow: 'auto',
            zIndex: '2147483647',
            background:
                'rgba(5,12,25,.97)',
            color: '#fff',
            border:
                '2px solid #f2c66d',
            borderRadius: '9px',
            padding: '7px',
            fontSize: '9px',
            lineHeight: '1.3',
            fontFamily:
                '-apple-system,BlinkMacSystemFont,sans-serif',
            pointerEvents: 'none'
        });

        box.innerHTML =
            '<div style="' +
            'font-size:12px;' +
            'font-weight:900;' +
            'color:#f2c66d">' +
            'ROAD AI 封包解析 V0.7' +
            '</div>' +

            '<div style="' +
            'color:#38d98a;' +
            'font-weight:800">' +
            '● 即時解析 WebSocket' +
            '</div>' +

            '<div id="road-ai-packet-status"' +
            ' style="margin-top:4px"></div>' +

            '<div id="road-ai-packet-log"></div>';

        (
            document.documentElement ||
            document.body
        ).appendChild(box);

        statusBox =
            box.querySelector(
                '#road-ai-packet-status'
            );

        logBox =
            box.querySelector(
                '#road-ai-packet-log'
            );

        updateUI();
    }

    function waitDOM() {
        if (document.documentElement) {
            createUI();
            return;
        }

        setTimeout(waitDOM, 20);
    }

    waitDOM();

})();
