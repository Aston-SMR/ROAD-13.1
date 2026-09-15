// ==UserScript==
// @name         ROAD AI Deal Event Locator
// @namespace    ROAD-AI
// @version      0.9
// @description  ROAD AI 發牌事件定位｜WebSocket封包變化分組
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_EVENT_LOCATOR__) return;
    window.__ROAD_AI_EVENT_LOCATOR__ = true;

    const WATCH_SIZES = [
        30, 34, 57, 83, 89, 109, 112
    ];

    const MAX_EVENTS = 22;
    const MAX_DIFF = 28;

    let box = null;
    let statusEl = null;
    let logEl = null;

    let wsCount = 0;
    let totalPackets = 0;
    let watchedPackets = 0;

    const events = [];
    const lastPacketBySize = new Map();

    function now() {
        const d = new Date();

        return (
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0') + '.' +
            String(d.getMilliseconds()).padStart(3, '0')
        );
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function hex(v) {
        if (v === undefined) return '--';

        return Number(v)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
    }

    function cloneBytes(bytes) {
        return new Uint8Array(bytes);
    }

    function readableText(bytes) {
        try {
            let text = new TextDecoder(
                'utf-8',
                { fatal: false }
            ).decode(bytes);

            text = text
                .replace(/\u0000/g, '·')
                .replace(
                    /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g,
                    '·'
                )
                .trim();

            if (!text) return '';

            // 只保留比較有用的可讀字串
            const useful =
                text.match(
                    /20\d{10,}[A-Za-z0-9]*|BANKER|PLAYER|TIE|RESULT|WINNER|CARD|ROUND|GAME/ig
                );

            if (useful && useful.length) {
                return useful.join(' | ').slice(0, 180);
            }

            return '';

        } catch (e) {
            return '';
        }
    }

    function diffPacket(previous, current) {
        if (!previous) {
            return {
                changed: [],
                count: 0,
                first: true
            };
        }

        const changed = [];

        const length = Math.max(
            previous.length,
            current.length
        );

        for (let i = 0; i < length; i++) {
            const oldValue = previous[i];
            const newValue = current[i];

            if (oldValue !== newValue) {
                changed.push({
                    index: i,
                    oldValue: oldValue,
                    newValue: newValue
                });
            }
        }

        return {
            changed: changed,
            count: changed.length,
            first: false
        };
    }

    function formatDiff(diff) {
        if (diff.first) {
            return '首次收到此尺寸';
        }

        if (!diff.count) {
            return '沒有變化';
        }

        return diff.changed
            .slice(0, MAX_DIFF)
            .map(function (x) {
                return (
                    x.index +
                    ':' +
                    hex(x.oldValue) +
                    '→' +
                    hex(x.newValue)
                );
            })
            .join('  ');
    }

    function classify(size, diff) {
        if (size === 30) {
            return '短狀態';
        }

        if (size === 34) {
            return '局號/狀態候選';
        }

        if (size === 57) {
            return '發牌候選 A';
        }

        if (size === 83) {
            return '發牌候選 B';
        }

        if (size === 89) {
            return '發牌候選 C';
        }

        if (size === 109) {
            return '牌局資料候選';
        }

        if (size === 112) {
            return '牌局資料候選 ★';
        }

        if (diff.count <= 6) {
            return '少量欄位變化';
        }

        return '狀態資料';
    }

    function isWatched(size, text) {
        if (WATCH_SIZES.includes(size)) {
            return true;
        }

        if (text) {
            return true;
        }

        return false;
    }

    function addEvent(direction, bytes) {
        totalPackets++;

        const size = bytes.length;
        const text = readableText(bytes);

        if (!isWatched(size, text)) {
            render();
            return;
        }

        watchedPackets++;

        const previous =
            lastPacketBySize.get(size);

        const diff =
            diffPacket(previous, bytes);

        lastPacketBySize.set(
            size,
            cloneBytes(bytes)
        );

        events.unshift({
            time: now(),
            direction: direction,
            size: size,
            label: classify(size, diff),
            diffCount: diff.count,
            diffText: formatDiff(diff),
            text: text
        });

        if (events.length > MAX_EVENTS) {
            events.length = MAX_EVENTS;
        }

        render();
    }

    async function handleData(direction, data) {
        try {
            if (data instanceof ArrayBuffer) {
                addEvent(
                    direction,
                    new Uint8Array(data)
                );
                return;
            }

            if (ArrayBuffer.isView(data)) {
                addEvent(
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

                addEvent(
                    direction,
                    new Uint8Array(buffer)
                );

                return;
            }

            if (typeof data === 'string') {
                addEvent(
                    direction + ' TXT',
                    new TextEncoder().encode(data)
                );
            }

        } catch (e) {}
    }

    function render() {
        if (!statusEl || !logEl) return;

        statusEl.innerHTML =
            'WS：<b>' + wsCount + '</b>　' +
            '全部：<b>' + totalPackets + '</b>　' +
            '定位：<b style="color:#f2c66d">' +
            watchedPackets +
            '</b>';

        if (!events.length) {
            logEl.innerHTML =
                '<div style="margin-top:6px;color:#91a0bd">' +
                '等待下一局發牌…' +
                '</div>';

            return;
        }

        logEl.innerHTML = events
            .map(function (e) {

                let html =
                    '<div style="' +
                    'margin-top:6px;' +
                    'padding-top:5px;' +
                    'border-top:1px solid #34415a">' +

                    '<div>' +

                    '<b style="color:#79b9ff">' +
                    esc(e.direction) +
                    '</b> ' +

                    '<span style="color:#91a0bd">' +
                    esc(e.time) +
                    '</span> ' +

                    '<b style="color:#f2c66d">' +
                    e.size +
                    'B</b>' +

                    '</div>' +

                    '<div style="' +
                    'color:#38d98a;' +
                    'font-weight:800">' +
                    esc(e.label) +
                    '</div>' +

                    '<div style="color:#ffcf70">' +
                    '變化：' +
                    e.diffCount +
                    ' bytes' +
                    '</div>' +

                    '<div style="' +
                    'color:#d5dbea;' +
                    'word-break:break-all">' +
                    esc(e.diffText) +
                    '</div>';

                if (e.text) {
                    html +=
                        '<div style="' +
                        'margin-top:2px;' +
                        'color:#74e3b0;' +
                        'word-break:break-all">' +
                        '文字：' +
                        esc(e.text) +
                        '</div>';
                }

                html += '</div>';

                return html;
            })
            .join('');
    }

    /*
     * WebSocket
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
                            handleData(
                                'IN',
                                event.data
                            );
                        }
                    );
                } catch (e) {}

                try {
                    const nativeSend = ws.send;

                    ws.send = function (data) {
                        handleData(
                            'OUT',
                            data
                        );

                        return nativeSend.apply(
                            this,
                            arguments
                        );
                    };
                } catch (e) {}

                render();

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
            width: '270px',
            maxHeight: '39vh',
            overflow: 'auto',
            zIndex: '2147483647',
            background: 'rgba(5,12,25,.97)',
            color: '#fff',
            border: '2px solid #f2c66d',
            borderRadius: '9px',
            padding: '7px',
            fontSize: '9px',
            lineHeight: '1.3',
            fontFamily:
                '-apple-system,BlinkMacSystemFont,sans-serif',

            /*
             * 偵測期間不擋牌桌操作
             */
            pointerEvents: 'none'
        });

        box.innerHTML =
            '<div style="' +
            'font-size:12px;' +
            'font-weight:900;' +
            'color:#f2c66d">' +
            'ROAD AI 發牌定位 V0.9' +
            '</div>' +

            '<div style="' +
            'color:#38d98a;' +
            'font-weight:800">' +
            '● 等待／比對發牌事件' +
            '</div>' +

            '<div id="road-ai-event-status"' +
            ' style="margin-top:4px"></div>' +

            '<div style="' +
            'margin-top:3px;' +
            'color:#91a0bd">' +
            '重點：57B / 83B / 89B / 109B / 112B' +
            '</div>' +

            '<div id="road-ai-event-log"></div>';

        (
            document.documentElement ||
            document.body
        ).appendChild(box);

        statusEl =
            box.querySelector(
                '#road-ai-event-status'
            );

        logEl =
            box.querySelector(
                '#road-ai-event-log'
            );

        render();
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
