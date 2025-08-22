// web/app.js — smooth scrolling graph with centered controls

// avoid double init if script accidentally included twice
if (window.__APP_INITED__) {
  console.warn('App already initialized');
} else {
  window.__APP_INITED__ = true;
  window.addEventListener('load', init);
}

function init() {
  const cvs = document.getElementById('canvas');
  const ctx = cvs.getContext('2d');
  const upBtn = document.getElementById('btn-up');
  const downBtn = document.getElementById('btn-down');
  const controls = document.getElementById('controls');
  const statusEl = document.getElementById('status');

  // handle user choice
  function choose(dir) {
    controls.style.display = 'none';
    statusEl.textContent = dir === 'up' ? 'Вы выбрали: Вверх' : 'Вы выбрали: Вниз';
  }
  upBtn.addEventListener('click', () => choose('up'));
  downBtn.addEventListener('click', () => choose('down'));

  const cssH = 420;
  let cssW = 0;
  let dpr = window.devicePixelRatio || 1;
  const span = 0.6; // width fraction for graph
  let maxX = 0;

  const pts = [];
  let running = false;
  const speed = 120; // px per second
  const volatility = 30; // target drift
  const totalTime = 30;
  const stopTime = 15;
  let startTime = 0;
  let prevTime = 0;
  let targetY = cssH / 2;

  function sizeCanvas() {
    running = false;
    const rect = cvs.parentElement.getBoundingClientRect();
    cssW = rect.width;
    dpr = window.devicePixelRatio || 1;
    maxX = cssW * span;

    cvs.width = Math.round(cssW * dpr);
    cvs.height = Math.round(cssH * dpr);
    cvs.style.width = cssW + 'px';
    cvs.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initGraph();
    startTime = prevTime = performance.now();
    running = true;
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', sizeCanvas);
  sizeCanvas();

  function initGraph() {
    pts.length = 0;
    let y = cssH / 2;
    targetY = y;
    for (let x = 0; x <= maxX; x += 5) {
      targetY += (Math.random() - 0.5) * volatility;
      targetY = Math.max(10, Math.min(cssH - 10, targetY));
      y += (targetY - y) * 0.2;
      pts.push({ x, y });
    }
  }

  function draw(elapsed) {
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.strokeStyle = '#36a3ff';
    ctx.lineWidth = 2 / dpr;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    const remaining = Math.max(0, totalTime - elapsed);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.ceil(remaining).toString(), 10, 10);

    if (elapsed >= stopTime) {
      ctx.fillStyle = '#000';
      ctx.fillRect(cssW / 2, 0, cssW / 2, cssH);
      ctx.fillStyle = '#fff';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cssW * 0.75, cssH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }
  }

  function step(now) {
    if (!running) return;
    const elapsed = (now - startTime) / 1000;
    const dt = (now - prevTime) / 1000;
    prevTime = now;

    if (elapsed < stopTime) {
      const shift = speed * dt;
      for (const p of pts) p.x -= shift;
      while (pts.length && pts[0].x < 0) pts.shift();

      targetY += (Math.random() - 0.5) * volatility;
      targetY = Math.max(10, Math.min(cssH - 10, targetY));
      const last = pts[pts.length - 1];
      const nextY = last.y + (targetY - last.y) * 0.1;
      pts.push({ x: maxX, y: nextY });
    }

    draw(elapsed);
    if (elapsed < totalTime) {
      requestAnimationFrame(step);
    } else {
      running = false;
    }
  }
}

