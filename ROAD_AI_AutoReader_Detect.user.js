// ==UserScript==
// @name         ROAD AI Auto Reader Deep Detect
// @namespace    ROAD-AI
// @version      0.4
// @description  ROAD AI 深層偵測｜iframe / Canvas / 歷史牌路資料
// @match        https://new-dd-cn.20299999.com/*
// @match        https://ew-dd-cn.20299999.com/*
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @match        https://new-dd-cn.ahsy114.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 只在最外層頁面顯示一個偵測器
    if (window.top !== window) return;

    if (window.__ROAD_AI_DEEP_DETECT__) return;
    window.__ROAD_AI_DEEP_DETECT__ = true;

    const box = document.createElement('div');

    Object.assign(box.style, {
        position: 'fixed',
        left: '4px',
        bottom: '4px',
        width: '235px',
        maxHeight: '38vh',
        overflow: 'auto',
        zIndex: '2147483647',
        background: 'rgba(5,12,25,.95)',
        color: '#fff',
        border: '2px solid #f2c66d',
        borderRadius: '9px',
        padding: '7px',
        fontSize: '10px',
        lineHeight: '1.35',
        fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif',

        // 這版純顯示，不吃手指操作
        pointerEvents: 'none'
    });

    document.documentElement.appendChild(box);

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function short(s, n) {
        s = String(s || '').replace(/\s+/g, ' ').trim();

        if (s.length > n) {
            return s.slice(0, n) + '…';
        }

        return s;
    }

    function inspectDocument(doc, label, depth) {

        const result = {
            label: label,
            depth: depth,
            accessible: true,
            url: '',
            textLength: 0,
            textSample: '',
            canvas: [],
            iframeCount: 0,
            imgCount: 0,
            videoCount: 0,
            svgCount: 0,
            buttonCount: 0,
            candidateAttrs: [],
            children: []
        };

        try {
            result.url =
                (doc.location && doc.location.href) || '';
        } catch (e) {
            result.url = '(URL blocked)';
        }

        try {
            const text =
                (doc.body && doc.body.innerText) || '';

            result.textLength = text.length;
            result.textSample = short(text, 180);
        } catch (e) {}

        try {
            doc.querySelectorAll('canvas').forEach((c, i) => {

                const rect = c.getBoundingClientRect();

                result.canvas.push({
                    no: i + 1,
                    width: c.width || 0,
                    height: c.height || 0,
                    cssWidth: Math.round(rect.width || 0),
                    cssHeight: Math.round(rect.height || 0),
                    id: c.id || '',
                    cls:
                        typeof c.className === 'string'
                            ? c.className
                            : ''
                });
            });
        } catch (e) {}

        try {
            result.iframeCount =
                doc.querySelectorAll('iframe').length;

            result.imgCount =
                doc.querySelectorAll('img').length;

            result.videoCount =
                doc.querySelectorAll('video').length;

            result.svgCount =
                doc.querySelectorAll('svg').length;

            result.buttonCount =
                doc.querySelectorAll(
                    'button,[role="button"]'
                ).length;
        } catch (e) {}

        /*
         * 找可能藏資料的 DOM 屬性。
         * 只列少量結果，避免偵測框爆掉。
         */
        try {
            const nodes =
                doc.querySelectorAll(
                    '[aria-label],[title],[data-result],' +
                    '[data-value],[data-card],[data-road],' +
                    '[data-type],[data-name],[class],[id]'
                );

            for (
                let i = 0;
                i < nodes.length &&
                result.candidateAttrs.length < 20;
                i++
            ) {
                const el = nodes[i];

                const bits = [];

                [
                    'aria-label',
                    'title',
                    'data-result',
                    'data-value',
                    'data-card',
                    'data-road',
                    'data-type',
                    'data-name'
                ].forEach(function (name) {

                    const v = el.getAttribute(name);

                    if (v) {
                        bits.push(
                            name + '=' + short(v, 40)
                        );
                    }
                });

                const id = el.id || '';

                const cls =
                    typeof el.className === 'string'
                        ? el.className
                        : '';

                const combined =
                    (
                        bits.join(' ') +
                        ' ' +
                        id +
                        ' ' +
                        cls
                    ).toLowerCase();

                /*
                 * 優先保留看起來跟百家樂資料有關的名稱
                 */
                if (
                    /player|banker|tie|road|bead|result|history|card|poker|baccarat|game|閒|莊|和/i
                        .test(combined)
                ) {
                    result.candidateAttrs.push(
                        short(
                            el.tagName +
                            (id ? '#' + id : '') +
                            (cls
                                ? '.' +
                                  cls
                                      .trim()
                                      .replace(/\s+/g, '.')
                                : '') +
                            (bits.length
                                ? ' [' +
                                  bits.join(' ') +
                                  ']'
                                : ''),
                            150
                        )
                    );
                }
            }
        } catch (e) {}

        /*
         * 深入 iframe。
         * 最多兩層，避免無限遞迴。
         */
        if (depth < 2) {

            try {
                const frames =
                    doc.querySelectorAll('iframe');

                frames.forEach(function (f, index) {

                    const childLabel =
                        label +
                        ' > iframe#' +
                        (index + 1);

                    let childDoc = null;
                    let childURL = '';

                    try {
                        childURL =
                            f.src ||
                            f.getAttribute('src') ||
                            '(no src)';
                    } catch (e) {
                        childURL = '(src blocked)';
                    }

                    try {
                        childDoc =
                            f.contentDocument ||
                            (
                                f.contentWindow &&
                                f.contentWindow.document
                            );

                        /*
                         * 強制碰一下 body，
                         * 如果跨網域會在這裡丟錯。
                         */
                        if (childDoc) {
                            void childDoc.body;
                        }

                    } catch (e) {
                        childDoc = null;
                    }

                    if (childDoc) {

                        result.children.push(
                            inspectDocument(
                                childDoc,
                                childLabel,
                                depth + 1
                            )
                        );

                    } else {

                        result.children.push({
                            label: childLabel,
                            depth: depth + 1,
                            accessible: false,
                            url: childURL,
                            textLength: 0,
                            textSample: '',
                            canvas: [],
                            iframeCount: 0,
                            imgCount: 0,
                            videoCount: 0,
                            svgCount: 0,
                            buttonCount: 0,
                            candidateAttrs: [],
                            children: []
                        });
                    }
                });

            } catch (e) {}
        }

        return result;
    }

    function renderNode(node) {

        let html = '';

        const indent =
            node.depth * 8;

        html +=
            '<div style="' +
            'margin-left:' + indent + 'px;' +
            'margin-top:6px;' +
            'padding-top:5px;' +
            'border-top:1px solid #33405c">' +

            '<div style="font-weight:900;color:' +
            (node.accessible ? '#38d98a' : '#ff7676') +
            '">' +
            esc(node.label) +
            '：' +
            (node.accessible ? '可讀' : '被阻擋') +
            '</div>';

        html +=
            '<div style="color:#91a0bd">' +
            esc(short(node.url, 100)) +
            '</div>';

        if (node.accessible) {

            html +=
                '<div>' +
                '文字：<b>' +
                node.textLength +
                '</b>　' +
                'Canvas：<b>' +
                node.canvas.length +
                '</b>　' +
                'iframe：<b>' +
                node.iframeCount +
                '</b>' +
                '</div>';

            html +=
                '<div>' +
                'IMG：' +
                node.imgCount +
                '　Video：' +
                node.videoCount +
                '　SVG：' +
                node.svgCount +
                '　Button：' +
                node.buttonCount +
                '</div>';

            if (node.textSample) {

                html +=
                    '<div style="margin-top:3px;color:#c2cad8">' +
                    '文字樣本：' +
                    esc(node.textSample) +
                    '</div>';
            }

            if (node.canvas.length) {

                html +=
                    '<div style="margin-top:3px;color:#f2c66d">' +
                    'Canvas 尺寸：<br>';

                node.canvas
                    .slice(0, 8)
                    .forEach(function (c) {

                        html +=
                            '#' +
                            c.no +
                            ' ' +
                            c.width +
                            '×' +
                            c.height +
                            ' / CSS ' +
                            c.cssWidth +
                            '×' +
                            c.cssHeight;

                        if (c.id) {
                            html +=
                                ' id=' +
                                esc(short(c.id, 25));
                        }

                        if (c.cls) {
                            html +=
                                ' class=' +
                                esc(short(c.cls, 35));
                        }

                        html += '<br>';
                    });

                html += '</div>';
            }

            if (node.candidateAttrs.length) {

                html +=
                    '<div style="margin-top:4px;color:#79b9ff">' +
                    '疑似資料節點：<br>' +
                    node.candidateAttrs
                        .map(esc)
                        .join('<br>') +
                    '</div>';
            }
        }

        html += '</div>';

        (node.children || []).forEach(function (child) {
            html += renderNode(child);
        });

        return html;
    }

    function detect() {

        let tree;

        try {
            tree =
                inspectDocument(
                    document,
                    'TOP',
                    0
                );
        } catch (e) {

            box.innerHTML =
                '<b style="color:#ff7676">' +
                '偵測錯誤：' +
                esc(e.message || e) +
                '</b>';

            return;
        }

        box.innerHTML =
            '<div style="font-size:12px;font-weight:900;color:#f2c66d">' +
            'ROAD AI 深層偵測 V0.4' +
            '</div>' +

            '<div style="color:#38d98a;font-weight:800">' +
            '● 正在找歷史 P/B/T 資料' +
            '</div>' +

            renderNode(tree);
    }

    detect();

    /*
     * 2 秒更新一次就夠。
     * 不用 MutationObserver，
     * 避免真人桌大量動畫造成偵測器狂跑。
     */
    setInterval(detect, 2000);

})();
