// web/app.js — плавный скролл, OU-процесс, фиксированный Y на раунд, шторка по центру

// защита от двойного запуска
if (window.__APP_INITED__) {
  console.warn('App already inited — skip');
} else {
  window.__APP_INITED__ = true;
  window.addEventListener('load', init);
}

async function init() {
  // -------- DOM ----------
  const cvs = document.getElementById('canvas');
  const ctx = cvs.getContext('2d');
  const statusEl = document.getElementById('status');
  const controls = document.getElementById('controls');
  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');

  // -------- размеры ----------
  function sizeCanvas() {
    const rect = cvs.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cvs.width  = Math.floor(rect.width * dpr);
    cvs.height = Math.floor(420 * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  // -------- параметры графика ----------
  const N = 300;             // количество видимых точек (чем больше — тем плавнее)
  const STEP_MS = 220;       // период добавления новой точки (мс)
  const COVER_AT_SEC = 15;   // секунда включения шторки
  const PADDING_X = 8;       // внутренний отступ слева в области графика
  const DRAW_SMOOTH = 5;     // усреднение последних точек перед отрисовкой

  // Процесс Орнштейна–Уленбека — гладкий «рынок»
  const OU = {
    mu: 100,       // средний уровень
    theta: 0.06,   // возврат к среднему (0..1)
    sigma: 0.05,   // волатильность
    maxStep: 0.10, // ограничение скачка за тик (анти-иглы)
  };

  // Масштаб Y (фиксируем на раунд и плавно ведём к целевому)
  const SCALE_PAD = 0.10;     // запас к min/max
  const SCALE_SMOOTH = 0.06;  // сглаживание движения границ
  const SCALE_MAX_STEP = 0.15;// максимум изменения границы за кадр (в ед. цены)

  // -------- состояние ----------
  let lastOutcome = null;
  let showCover = false;
  let paused = false;
  let bias = 0;                    // лёгкий дрейф после settle/close

  const buf = genInitialSeries(N); // кольцевой буфер длиной N
  let head = 0;
  // масштаб (замораживается на старте раунда)
  let viewMin = 99, viewMax = 101;     // текущие видимые границы
  let targetMin = 99, targetMax = 101; // целевые границы

  // ===== генерация =====
  function genInitialSeries(n) {
    const arr = [];
    let x = OU.mu;
    for (let i = 0; i < n; i++) {
      x = ouNext(x);
      arr.push(x);
    }
    return arr;
  }

  function ouNext(x) {
    // dX = theta*(mu - x) + sigma*epsilon + bias
    const eps = (Math.random() * 2 - 1); // U(-1,1) достаточно гладко
    let d = OU.theta * (OU.mu - x) + OU.sigma * eps + bias * 0.05;
    if (d > OU.maxStep) d = OU.maxStep;
    if (d < -OU.maxStep) d = -OU.maxStep;
    return x + d;
  }

  // доступ к кольцевому буферу
  const at = (i) => buf[(head + i) % N];            // i: 0..N-1 (0 — слева)
  const setLast = (v) => { buf[(head + N - 1) % N] = v; };

  // усреднение нескольких последних точек для сглаживания линии
  function smoothAt(i) {
    let sum = 0;
    for (let k = 0; k < DRAW_SMOOTH; k++) {
      sum += at((i - k + N) % N);
    }
    return sum / DRAW_SMOOTH;
  }

  function stepForward() {
    if (paused) return;
    const next = ouNext(at(N - 1));
    head = (head + 1) % N;   // сдвиг окна на 1 точку
    setLast(next);           // записали новую правую точку
  }

  // ===== масштаб =====
  function recomputeTargetScale() {
    let mi = Infinity, ma = -Infinity;
    for (let i = 0; i < N; i++) {
      const v = at(i);
      if (v < mi) mi = v;
      if (v > ma) ma = v;
    }
    if (mi === ma) { mi -= 1; ma += 1; }
    const pad = Math.max(0.5, (ma - mi) * SCALE_PAD);
    return [mi - pad, ma + pad];
  }

  function approach(a, b, maxStep) {
    const d = b - a;
    if (Math.abs(d) <= maxStep) return b;
    return a + Math.sign(d) * maxStep;
  }

  function smoothScale() {
    // ведём текущие границы к целевым с ограничением шага
    viewMin = approach(viewMin + (targetMin - viewMin) * SCALE_SMOOTH, targetMin, SCALE_MAX_STEP);
    viewMax = approach(viewMax + (targetMax - viewMax) * SCALE_SMOOTH, targetMax, SCALE_MAX_STEP);
    if (viewMax - viewMin < 1) viewMax = viewMin + 1; // защита от нулевого диапазона
  }

  // ===== отрисовка =====
  function drawGrid(w, h) {
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (h / 6) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  const lerp = (a,b,t)=>a+(b-a)*t;

  // t — доля времени до следующего дискретного шага (0..1)
  function draw(t = 0) {
    const w = cvs.clientWidth, h = cvs.clientHeight;

    drawGrid(w, h);
    smoothScale();

    // левая половина — область графика, правая — шторка
    const vpX = 0;
    const vpW = Math.floor(w / 2);

    // ширина сегмента и плавный сдвиг влево
    const segW = (vpW - 2 * PADDING_X) / (N - 1);
    const xShift = t * segW;

    ctx.strokeStyle = '#36a3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // рисуем N-1 сегмент (не замыкаем в кольцо — без стыковых скачков)
    for (let i = 0; i < N - 1; i++) {
      const cur = smoothAt(i);
      const nxt = smoothAt(i + 1);
      const yVal = lerp(cur, nxt, t);

      const x = vpX + PADDING_X + i * segW - xShift;
      const y = h - ((yVal - viewMin) / (viewMax - viewMin)) * (h - 10) - 5;

      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // подпись исхода
    if (lastOutcome) {
      ctx.fillStyle = lastOutcome === 'up' ? '#1f9d55' : '#e53e3e';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText(lastOutcome === 'up' ? '📈 UP' : '📉 DOWN', 8, 22);
    }

    // правая половина — чёрная шторка с «?»
    if (showCover) {
      const halfX = Math.floor(w / 2);
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(halfX, 0, w - halfX, h);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 72px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText('?', halfX + (w - halfX) / 2, h / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ===== API (пока заглушки) =====
  async function fetchState() {
    const res = await fetch('/api/rounds/state', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  btnUp.addEventListener('click', async () => {
    const r = await fetch('/api/rounds/bet', { method: 'POST' });
    const j = await r.json();
    controls.style.display = 'none';
    statusEl.textContent = j.ok ? 'Вы выбрали: 📈 Вверх' : 'Приём ставок закрыт';
  });
  btnDown.addEventListener('click', async () => {
    const r = await fetch('/api/rounds/bet', { method: 'POST' });
    const j = await r.json();
    controls.style.display = 'none';
    statusEl.textContent = j.ok ? 'Вы выбрали: 📉 Вниз' : 'Приём ставок закрыт';
  });

  // ===== опрос состояния раунда =====
  let lastRoundId = null;
  async function poll() {
    try {
      const st = await fetchState();
      const elapsed = st.duration - st.timeleft;

      showCover = (st.status !== 'settled') && (elapsed >= COVER_AT_SEC);
      paused = showCover && st.status === 'betting';

      if (lastRoundId !== st.id) {
        // новый раунд: сбрасываем состояние и фиксируем масштаб
        lastRoundId = st.id;
        lastOutcome = null;
        showCover = false;
        paused = false;
        bias = 0;

        controls.style.display = 'flex';

        [targetMin, targetMax] = recomputeTargetScale();
        viewMin = targetMin;
        viewMax = targetMax;

        statusEl.textContent = `Новый раунд #${st.id}`;
      }

      if (st.status === 'betting') {
        statusEl.textContent = `Раунд #${st.id} — осталось ${st.timeleft}s. Делай ставку!`;
      } else if (st.status === 'closed') {
        bias = (st.outcome === 'up') ? +1 : -1; // скрытый дрейф к исходу
        statusEl.textContent = `Раунд #${st.id} — ставки закрыты, ждём результат...`;
      } else if (st.status === 'settled') {
        lastOutcome = st.outcome;
        bias = (st.outcome === 'up') ? +1 : -1; // небольшой тренд после результата
        showCover = false;
        paused = false;
        statusEl.textContent = `Раунд #${st.id} завершён: ${st.outcome === 'up' ? '📈 вверх' : '📉 вниз'}.`;
      } else {
        statusEl.textContent = `Статус: ${st.status}`;
      }
    } catch {
      statusEl.textContent = 'Ошибка связи с сервером';
    } finally {
      setTimeout(poll, 1000);
    }
  }

  // ===== главный анимационный цикл =====
  let acc = 0;                    // накопленное время от последнего шага
  let lastTs = performance.now(); // время предыдущего кадра

  function update(now) {
    const dt = now - lastTs;
    lastTs = now;

    if (!paused) acc += dt;

    // дискретно добавляем точки только каждые STEP_MS
    while (!paused && acc >= STEP_MS) {
      acc -= STEP_MS;
      stepForward();
    }

    // фаза интерполяции (0..1) — насколько «продвинулись» к следующей точке
    const t = paused ? 0 : (acc / STEP_MS);

    draw(t);
    requestAnimationFrame(update);
  }

  // старт
  [targetMin, targetMax] = recomputeTargetScale();
  viewMin = targetMin; viewMax = targetMax;

  poll();
  requestAnimationFrame(update);
}
