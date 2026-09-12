// ==UserScript==
// @name         ROAD AI Floating
// @namespace    ROAD-AI
// @version      1.0
// @description  在指定真人百家樂網站上懸浮顯示 ROAD AI
// @match        https://new-dd-cloudfront.ywjxi.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (document.getElementById('road-ai-floating-root')) return;

  const ROAD_AI_URL = 'https://aston-smr.github.io/ROAD-13.1/';

  const root = document.createElement('div');
  root.id = 'road-ai-floating-root';

  Object.assign(root.style, {
    position: 'fixed',
    left: '8px',
    top: '70px',
    width: 'calc(100vw - 16px)',
    maxWidth: '430px',
    height: '72vh',
    minHeight: '260px',
    zIndex: '2147483647',
    borderRadius: '14px',
    overflow: 'hidden',
    background: '#070b17',
    border: '1px solid rgba(255,255,255,.22)',
    boxShadow: '0 12px 40px rgba(0,0,0,.55)',
    touchAction: 'none'
  });

  const bar = document.createElement('div');

  Object.assign(bar.style, {
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 8px 0 12px',
    background: 'rgba(10,15,28,.98)',
    color: '#f5d27a',
    font: '700 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'move',
    touchAction: 'none'
  });

  const title = document.createElement('div');
  title.textContent = 'ROAD AI';
  Object.assign(title.style, {
    flex: '1',
    overflow: 'hidden',
    whiteSpace: 'nowrap'
  });

  function makeBtn(txt) {
    const b = document.createElement('button');

    b.textContent = txt;

    Object.assign(b.style, {
      width: '34px',
      height: '30px',
      border: '1px solid #465068',
      borderRadius: '8px',
      background: '#161d2b',
      color: '#fff',
      fontSize: '18px',
      fontWeight: '700',
      padding: '0',
      margin: '0',
      lineHeight: '28px'
    });

    return b;
  }

  const minBtn = makeBtn('−');
  const sizeBtn = makeBtn('↗');
  const hideBtn = makeBtn('×');

  bar.append(title, minBtn, sizeBtn, hideBtn);

  const iframe = document.createElement('iframe');

  iframe.src = ROAD_AI_URL;
  iframe.setAttribute('title', 'ROAD AI');
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');

  Object.assign(iframe.style, {
    width: '100%',
    height: 'calc(100% - 40px)',
    border: '0',
    background: '#070b17',
    display: 'block'
  });

  root.append(bar, iframe);
  document.documentElement.appendChild(root);

  let minimized = false;
  let maximized = false;
  let oldGeom = null;

  minBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    minimized = !minimized;

    iframe.style.display = minimized ? 'none' : 'block';

    root.style.height = minimized
      ? '40px'
      : (maximized ? 'calc(100vh - 16px)' : '72vh');

    root.style.minHeight = minimized ? '40px' : '260px';

    minBtn.textContent = minimized ? '+' : '−';
  });

  sizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (minimized) {
      minimized = false;
      iframe.style.display = 'block';
      minBtn.textContent = '−';
    }

    if (!maximized) {
      oldGeom = {
        left: root.style.left,
        top: root.style.top,
        width: root.style.width,
        maxWidth: root.style.maxWidth,
        height: root.style.height
      };

      root.style.left = '8px';
      root.style.top = '8px';
      root.style.width = 'calc(100vw - 16px)';
      root.style.maxWidth = 'none';
      root.style.height = 'calc(100vh - 16px)';

      maximized = true;
      sizeBtn.textContent = '↙';
    } else {
      Object.assign(root.style, oldGeom || {
        left: '8px',
        top: '70px',
        width: 'calc(100vw - 16px)',
        maxWidth: '430px',
        height: '72vh'
      });

      maximized = false;
      sizeBtn.textContent = '↗';
    }
  });

  const launcher = document.createElement('button');

  launcher.textContent = 'AI';

  Object.assign(launcher.style, {
    position: 'fixed',
    right: '10px',
    bottom: '90px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,.35)',
    background: '#0b1220',
    color: '#f5d27a',
    font: '800 15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    zIndex: '2147483647',
    boxShadow: '0 6px 18px rgba(0,0,0,.45)',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center'
  });

  launcher.addEventListener('click', () => {
    root.style.display = 'block';
    launcher.style.display = 'none';
  });

  document.documentElement.appendChild(launcher);

  hideBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    root.style.display = 'none';
    launcher.style.display = 'flex';
  });

  let drag = null;

  bar.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON' || maximized) return;

    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      left: root.getBoundingClientRect().left,
      top: root.getBoundingClientRect().top
    };

    try {
      bar.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
  });

  bar.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || maximized) return;

    const rect = root.getBoundingClientRect();

    let left = drag.left + (e.clientX - drag.startX);
    let top = drag.top + (e.clientY - drag.startY);

    left = Math.max(
      0,
      Math.min(window.innerWidth - Math.min(rect.width, window.innerWidth), left)
    );

    top = Math.max(
      0,
      Math.min(window.innerHeight - 40, top)
    );

    root.style.left = left + 'px';
    root.style.top = top + 'px';

    e.preventDefault();
  });

  function endDrag(e) {
    if (!drag) return;
    if (e && e.pointerId !== drag.id) return;

    drag = null;
  }

  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
})();
