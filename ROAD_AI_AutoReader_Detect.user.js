// ==UserScript==
// @name         ROAD AI Packet Recorder
// @namespace    ROAD-AI
// @version      1.0
// @description  ROAD AI 本局WebSocket封包錄製器
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__ROAD_AI_PACKET_RECORDER__) return;
    window.__ROAD_AI_PACKET_RECORDER__ = true;

    const MAX_PACKETS = 3000;

    let packets = [];
    let wsCount = 0;

    let box = null;
    let infoEl = null;
    let lastEl = null;

    function now() {
        const d = new Date();

        return (
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0') + '.' +
            String(d.getMilliseconds()).padStart(3, '0')
        );
    }

    function hex(v) {
        return Number(v)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
    }

    function bytesToHex(bytes) {
        const out = new Array(bytes.length);

        for (let i = 0; i < bytes.length; i++) {
            out[i] = hex(bytes[i]);
        }

        return out.join(' ');
    }

    function tryText(bytes) {
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

            /*
             * 避免完全無意義的亂碼佔太多空間。
             */
            const useful = text.match(
                /20\d{8,}[A-Za-z0-9]*|banker|player|tie|winner|result|card|round|game/ig
            );

            if (useful && useful.length) {
                return useful.join(' | ');
            }

            return '';

        } catch (e) {
            return '';
        }
    }

    function cloneBytes(bytes) {
        return new Uint8Array(bytes);
    }

    function updateUI(lastPacket) {
        if (!infoEl) return;

        infoEl.innerHTML =
            'WS：<b>' + wsCount + '</b>　' +
            '已錄：<b style="color:#f2c66d">' +
            packets.length +
            '</b>';

        if (lastEl && lastPacket) {
            lastEl.textContent =
                '最後：' +
                lastPacket.direction +
                ' / ' +
                lastPacket.size +
                'B / ' +
                lastPacket.time;
        }
    }

    function record(direction, bytes) {
        const copy = cloneBytes(bytes);

        const packet = {
            no: packets.length + 1,
            time: now(),
            direction: direction,
            size: copy.length,
            hex: bytesToHex(copy),
            text: tryText(copy)
        };

        packets.push(packet);

        if (packets.length > MAX_PACKETS) {
            packets.shift();

            /*
             * 重排編號。
             */
            packets.forEach(function (p, i) {
                p.no = i + 1;
            });
        }

        updateUI(packet);
    }

    async function processData(direction, data) {
        try {
            if (data instanceof ArrayBuffer) {
                record(
                    direction,
                    new Uint8Array(data)
                );
                return;
            }

            if (ArrayBuffer.isView(data)) {
                record(
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

                record(
                    direction,
                    new Uint8Array(buffer)
                );

                return;
            }

            if (typeof data === 'string') {
                record(
                    direction + '-TEXT',
                    new TextEncoder().encode(data)
                );
            }

        } catch (e) {}
    }

    /*
     * WebSocket 攔截
     */
    try {
        const NativeWebSocket = window.WebSocket;

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

            window.WebSocket = RoadAIWebSocket;
        }

    } catch (e) {}

    function buildExport() {
        const lines = [];

        lines.push('ROAD AI PACKET RECORD V1.0');
        lines.push('HOST=' + location.hostname);
        lines.push('TIME=' + new Date().toISOString());
        lines.push('PACKETS=' + packets.length);
        lines.push('');

        packets.forEach(function (p) {
            lines.push(
                '#' + p.no +
                ' | ' +
                p.time +
                ' | ' +
                p.direction +
                ' | ' +
                p.size +
                'B'
            );

            if (p.text) {
                lines.push(
                    'TEXT=' + p.text
                );
            }

            lines.push(
                'HEX=' + p.hex
            );

            lines.push('');
        });

        return lines.join('\n');
    }

    async function copyRecord() {
        const text = buildExport();

        try {
            await navigator.clipboard.writeText(text);

            setMessage('✓ 已複製 ' + packets.length + ' 個封包');
            return;

        } catch (e) {}

        /*
         * iOS clipboard fallback
         */
        try {
            const ta =
                document.createElement('textarea');

            ta.value = text;

            Object.assign(ta.style, {
                position: 'fixed',
                left: '-9999px',
                top: '0'
            });

            document.body.appendChild(ta);

            ta.focus();
            ta.select();

            const ok =
                document.execCommand('copy');

            ta.remove();

            if (ok) {
                setMessage(
                    '✓ 已複製 ' +
                    packets.length +
                    ' 個封包'
                );
            } else {
                setMessage('複製失敗');
            }

        } catch (e) {
            setMessage('複製失敗');
        }
    }

    function clearRecord() {
        packets = [];

        updateUI();

        if (lastEl) {
            lastEl.textContent =
                '已清空，等待本局…';
        }

        setMessage('● 開始錄製本局');
    }

    function setMessage(text) {
        const el =
            document.getElementById(
                'road-ai-rec-message'
            );

        if (!el) return;

        el.textContent = text;

        clearTimeout(
            setMessage.__timer
        );

        setMessage.__timer =
            setTimeout(function () {
                if (el) {
                    el.textContent =
                        '● 錄製中';
                }
            }, 1800);
    }

    function createUI() {
        if (box) return;

        box =
            document.createElement('div');

        Object.assign(box.style, {
            position: 'fixed',
            left: '5px',
            bottom: '5px',
            width: '245px',
            zIndex: '2147483647',
            background: 'rgba(5,12,25,.96)',
            color: '#fff',
            border: '2px solid #f2c66d',
            borderRadius: '10px',
            padding: '8px',
            fontSize: '10px',
            lineHeight: '1.35',
            fontFamily:
                '-apple-system,BlinkMacSystemFont,sans-serif',
            boxShadow:
                '0 4px 18px rgba(0,0,0,.45)',
            pointerEvents: 'auto'
        });

        box.innerHTML =
            '<div style="' +
            'font-size:13px;' +
            'font-weight:900;' +
            'color:#f2c66d;' +
            'margin-bottom:2px">' +
            'ROAD AI 封包錄製 V1.0' +
            '</div>' +

            '<div id="road-ai-rec-message"' +
            ' style="' +
            'color:#38d98a;' +
            'font-weight:800">' +
            '● 錄製中' +
            '</div>' +

            '<div id="road-ai-rec-info"' +
            ' style="margin-top:3px"></div>' +

            '<div id="road-ai-rec-last"' +
            ' style="' +
            'margin-top:2px;' +
            'color:#91a0bd">' +
            '等待封包…' +
            '</div>' +

            '<div style="' +
            'display:flex;' +
            'gap:6px;' +
            'margin-top:7px">' +

            '<button id="road-ai-rec-clear"' +
            ' style="' +
            'flex:1;' +
            'border:1px solid #65738e;' +
            'border-radius:7px;' +
            'padding:7px 3px;' +
            'background:#182237;' +
            'color:#fff;' +
            'font-weight:800">' +
            '🗑 清空' +
            '</button>' +

            '<button id="road-ai-rec-copy"' +
            ' style="' +
            'flex:1.3;' +
            'border:1px solid #f2c66d;' +
            'border-radius:7px;' +
            'padding:7px 3px;' +
            'background:#493817;' +
            'color:#ffd978;' +
            'font-weight:900">' +
            '📋 複製本局' +
            '</button>' +

            '</div>';

        (
            document.documentElement ||
            document.body
        ).appendChild(box);

        infoEl =
            box.querySelector(
                '#road-ai-rec-info'
            );

        lastEl =
            box.querySelector(
                '#road-ai-rec-last'
            );

        box.querySelector(
            '#road-ai-rec-clear'
        ).addEventListener(
            'click',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                clearRecord();
            }
        );

        box.querySelector(
            '#road-ai-rec-copy'
        ).addEventListener(
            'click',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                copyRecord();
            }
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
