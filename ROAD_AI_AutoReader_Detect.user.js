// ==UserScript==
// @name         ROAD AI Card Packet Locator
// @namespace    ROAD-AI
// @version      0.8
// @description  ROAD AI 即時牌面｜牌值封包定位器
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_CARD_LOCATOR__) return;
    window.__ROAD_AI_CARD_LOCATOR__ = true;

    const MAX_LOG = 24;

    let box = null;
    let statusBox = null;
    let logBox = null;

    let wsCount = 0;
    let totalPackets = 0;
    let shownPackets = 0;

    const logs = [];
    const lastBySize = new Map();

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

    function hexByte(v) {
        return Number(v)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
    }

    function bytesToHex(bytes, max) {
        const len = Math.min(bytes.length, max);
        const out = [];

        for (let i = 0; i < len; i++) {
            out.push(hexByte(bytes[i]));
        }

        return out.join(' ');
    }

    function tryText(bytes) {
        try {
            let text =
                new TextDecoder('utf-8', {
                    fatal: false
                }).decode(bytes);

            text = text
                .replace(/\u0000/g, '·')
                .replace(
                    /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g,
                    '·'
                )
                .trim();

            return text.length > 160
                ? text.slice(0, 160) + '…'
                : text;

        } catch (e) {
            return '';
        }
    }

    function textScore(text) {
        if (!text) return 0;

        let score = 0;

        if (/20\d{12,}/.test(text)) score += 5;

        if (
            /player|banker|tie|card|result|winner|round|game/i
                .test(text)
        ) {
            score += 5;
        }

        if (/[PBT]/.test(text)) {
            score += 2;
        }

        return score;
    }

    function diffBytes(previous, current) {
        if (!previous) {
            return {
                count: 0,
                positions: []
            };
        }

        const max =
            Math.max(
                previous.length,
                current.length
            );

        const positions = [];

        for (let i = 0; i < max; i++) {
            const a = previous[i];
            const b = current[i];

            if (a !== b) {
                positions.push(
                    i + ':' +
                    (
                        a === undefined
                            ? '--'
                            : hexByte(a)
                    ) +
                    '→' +
                    (
                        b === undefined
                            ? '--'
                            : hexByte(b)
                    )
                );
            }

            if (positions.length >= 20) {
                break;
            }
        }

        return {
            count: positions.length,
            positions: positions
        };
    }

    function shouldShow(bytes, text) {
        const size = bytes.length;

        /*
         * 優先保留短封包。
         */
        if (size <= 140) return true;

        /*
         * 或封包內有明顯可讀遊戲資訊。
         */
        if (textScore(text) >= 2) return true;

        return false;
    }

    function addPacket(direction, bytes) {
        totalPackets++;

        const text = tryText(bytes);

        if (!shouldShow(bytes, text)) {
            updateUI();
            return;
        }

        shownPackets++;

        const previous =
            lastBySize.get(bytes.length);

        const diff =
            diffBytes(
                previous,
                bytes
            );

        /*
         * 複製一份，避免原始 buffer 後續被修改。
         */
        lastBySize.set(
            bytes.length,
            new Uint8Array(bytes)
        );

        logs.unshift({
            direction: direction,
            time: timeNow(),
            size: bytes.length,
            text: text,
            score: textScore(text),
            hex: bytesToHex(bytes, 140),
            diffCount: diff.count,
            diff: diff.positions.join('  ')
        });

        if (logs.length > MAX_LOG) {
            logs.length = MAX_LOG;
        }

        updateUI();
    }

    async function processData(direction, data) {
        try {
            if (data instanceof ArrayBuffer) {
                addPacket(
                    direction,
                    new Uint8Array(data)
                );
                return;
            }

            if (ArrayBuffer.isView(data)) {
                addPacket(
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

                addPacket(
                    direction,
                    new Uint8Array(buffer)
                );
                return;
            }

            if (typeof data === 'string') {
                addPacket(
                    direction + ' TXT',
                    new TextEncoder().encode(data)
                );
            }

        } catch (e) {}
    }

    function updateUI() {
        if (!statusBox || !logBox) return;

        statusBox.innerHTML =
            'WS：<b>' + wsCount + '</b>　' +
            '全部：<b>' + totalPackets + '</b>　' +
            '保留：<b style="color:#f2c66d">' +
            shownPackets +
            '</b>';

        if (!logs.length) {
            logBox.innerHTML =
                '<div style="margin-top:6px;color:#91a0bd">' +
                '等待發牌封包…' +
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

                if (x.text) {
                    html +=
                        '<div style="' +
                        'margin-top:2px;' +
                        'color:#38d98a;' +
                        'word-break:break-all">' +
                        'TXT：' +
                        esc(x.text) +
                        '</div>';
                }

                if (x.diff) {
                    html +=
                        '<div style="' +
                        'margin-top:2px;' +
                        'color:#ffcf70;' +
                        'word-break:break-all">' +
                        'Δ：' +
                        esc(x.diff) +
                        '</div>';
                }

                html +=
                    '<div style="' +
                    'margin-top:2px;' +
                    'color:#d5dbea;' +
                    'word-break:break-all">' +
                    'HEX：' +
                    esc(x.hex) +
                    '</div>' +

                    '</div>';

                return html;
            }).join('');
    }

    /*
     * 攔截 WebSocket
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
                    ws.binaryType = 'arraybuffer';
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
                    const nativeSend = ws.send;

                    ws.send = function (data) {
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

            [
                'CONNECTING',
                'OPEN',
                'CLOSING',
                'CLOSED'
            ].forEach(function (name) {

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
            width: '285px',
            maxHeight: '42vh',
            overflow: 'auto',
            zIndex: '2147483647',
            background:
                'rgba(5,12,25,.97)',
            color: '#fff',
            border:
                '2px solid #f2c66d',
            borderRadius: '9px',
            padding: '7px',
            fontSize: '8px',
            lineHeight: '1.28',
            fontFamily:
                '-apple-system,BlinkMacSystemFont,sans-serif',
            pointerEvents: 'none'
        });

        box.innerHTML =
            '<div style="' +
            'font-size:12px;' +
            'font-weight:900;' +
            'color:#f2c66d">' +
            'ROAD AI 牌值定位 V0.8' +
            '</div>' +

            '<div style="' +
            'color:#38d98a;' +
            'font-weight:800">' +
            '● 比對發牌封包變化' +
            '</div>' +

            '<div id="road-ai-locator-status"' +
            ' style="margin-top:4px"></div>' +

            '<div id="road-ai-locator-log"></div>';

        (
            document.documentElement ||
            document.body
        ).appendChild(box);

        statusBox =
            box.querySelector(
                '#road-ai-locator-status'
            );

        logBox =
            box.querySelector(
                '#road-ai-locator-log'
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
