/*!
 * Tiny Arms — a micro-game party for a T-rex with big dreams.
 * Plain HTML5 Canvas + Web Audio. No dependencies, no build step.
 * (c) Mahyad Mirzabagheri — MIT License
 */
'use strict';

(() => {
  // ---------------------------------------------------------------------------
  // Basics
  // ---------------------------------------------------------------------------
  const W = 960;
  const H = 540;
  const GROUND = 452;
  const TAU = Math.PI * 2;
  const FONT = '"Fredoka", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';
  const INK = '#26302A';

  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------------------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------------------
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const wrap = $('stage-wrap');
  let viewScale = 1;

  function resize() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    viewScale = canvas.width / W;
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap);
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // Sound (synthesised with Web Audio — no audio files)
  // ---------------------------------------------------------------------------
  const Sound = {
    ac: null,
    master: null,
    noiseBuf: null,
    muted: store.get('tinyarms.muted', false),

    unlock() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
          this.ac = new AC();
          this.master = this.ac.createGain();
          this.master.gain.value = this.muted ? 0 : 0.55;
          this.master.connect(this.ac.destination);
          const len = this.ac.sampleRate;
          this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ac = null; return; }
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    },

    setMuted(m) {
      this.muted = m;
      store.set('tinyarms.muted', m);
      if (this.master) this.master.gain.value = m ? 0 : 0.55;
    },

    tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, attack = 0.006 } = {}) {
      if (!this.ac || this.muted) return;
      const t0 = this.ac.currentTime + delay;
      const o = this.ac.createOscillator();
      const g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    },

    noise(dur, { vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, slide = 0 } = {}) {
      if (!this.ac || this.muted) return;
      const t0 = this.ac.currentTime + delay;
      const src = this.ac.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ac.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(freq, t0);
      if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      const g = this.ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0, Math.random() * 0.4);
      src.stop(t0 + dur + 0.03);
    },

    play(name) {
      if (!this.ac || this.muted) return;
      switch (name) {
        case 'ui': this.tone(660, 0.08, { type: 'triangle', vol: 0.14 }); break;
        case 'tap': this.tone(rand(480, 640), 0.07, { type: 'triangle', vol: 0.16, slide: 140 }); break;
        case 'clap':
          this.noise(0.12, { vol: 0.6, freq: 1800, q: 0.7 });
          this.noise(0.2, { vol: 0.25, freq: 2600, q: 1, delay: 0.03 });
          break;
        case 'slap':
          this.noise(0.1, { vol: 0.7, freq: 1500 });
          this.tone(200, 0.14, { type: 'square', vol: 0.1, slide: -90 });
          break;
        case 'whoosh': this.noise(0.28, { vol: 0.22, freq: 500, slide: 2000, q: 1.4 }); break;
        case 'win':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.07 }));
          break;
        case 'lose':
          this.tone(392, 0.22, { type: 'sawtooth', vol: 0.07, slide: -60 });
          this.tone(311, 0.45, { type: 'sawtooth', vol: 0.07, slide: -120, delay: 0.2 });
          break;
        case 'speed':
          [440, 554, 659, 880, 1109].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.06, delay: i * 0.06 }));
          break;
        case 'boom':
          this.noise(0.6, { vol: 0.75, freq: 320, type: 'lowpass', slide: -220 });
          this.tone(95, 0.4, { vol: 0.35, slide: -50 });
          break;
        case 'warn': this.tone(880, 0.06, { type: 'square', vol: 0.05 }); this.tone(880, 0.06, { type: 'square', vol: 0.05, delay: 0.1 }); break;
        case 'shutter':
          this.noise(0.05, { vol: 0.5, freq: 4200, type: 'highpass' });
          this.noise(0.06, { vol: 0.35, freq: 3000, type: 'highpass', delay: 0.08 });
          break;
        case 'inhale': this.noise(0.14, { vol: 0.08, freq: 900, q: 2 }); break;
        case 'puff': this.noise(0.55, { vol: 0.38, freq: 900, slide: -500, q: 0.6 }); break;
        case 'cough': [0, 0.17, 0.32].forEach((d) => this.noise(0.1, { vol: 0.42, freq: 480, q: 1.2, delay: d })); break;
        case 'catch':
          this.tone(880, 0.08, { type: 'triangle', vol: 0.18 });
          this.tone(1320, 0.14, { type: 'triangle', vol: 0.16, delay: 0.06 });
          break;
        case 'splat': this.noise(0.22, { vol: 0.5, freq: 420, slide: -220 }); break;
        case 'roar':
          this.tone(150, 0.75, { type: 'sawtooth', vol: 0.12, slide: -80 });
          this.noise(0.75, { vol: 0.22, freq: 520, slide: -320, q: 0.8 });
          break;
        case 'boop': this.tone(300, 0.1, { type: 'sine', vol: 0.15, slide: -100 }); break;
        case 'boing': this.tone(220, 0.22, { type: 'square', vol: 0.06, slide: 420 }); break;
        case 'bonk':
          this.tone(170, 0.2, { type: 'square', vol: 0.1, slide: -90 });
          this.noise(0.15, { vol: 0.5, freq: 260, type: 'lowpass' });
          break;
        case 'pop':
          this.noise(0.07, { vol: 0.7, freq: 2400, type: 'highpass' });
          this.tone(900, 0.06, { type: 'triangle', vol: 0.12, slide: -400 });
          break;
        case 'scrub': this.noise(0.07, { vol: 0.12, freq: 3200, q: 1.5 }); break;
        case 'roar2':
          this.tone(170, 0.5, { type: 'sawtooth', vol: 0.12, slide: -80 });
          this.noise(0.5, { vol: 0.3, freq: 600, slide: -350, q: 0.7 });
          break;
        case 'level':
          [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.16, delay: i * 0.08 }));
          this.tone(1568, 0.35, { type: 'sine', vol: 0.1, delay: 0.42 });
          break;
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Input — one action button (tap / click / Space) + horizontal movement
  // ---------------------------------------------------------------------------
  const input = {
    down: false, pressed: false, released: false,
    left: false, right: false,
    px: null, pointer: false,
    touch: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches),
  };
  const NO_INPUT = Object.freeze({ down: false, pressed: false, released: false, left: false, right: false, px: null, pointer: false });

  function clearInput() {
    input.down = input.pressed = input.released = input.left = input.right = false;
  }
  function logicalX(e) {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  }

  canvas.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    input.touch = e.pointerType !== 'mouse';
    input.pointer = true;
    input.px = logicalX(e);
    if (!input.down) { input.down = true; input.pressed = true; }
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || input.down) {
      input.px = logicalX(e);
      input.pointer = true;
    }
  });
  const pointerUp = () => { if (input.down) { input.down = false; input.released = true; } };
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const ACTION_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyX']);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (S.phase === 'help' && e.code === 'Escape') { goMenu(); return; }
      togglePause(); e.preventDefault(); return;
    }
    if (e.code === 'KeyM') { toggleMute(); return; }

    const inPlay = PLAY_PHASES.has(S.phase) && !S.paused;

    if (ACTION_KEYS.has(e.code)) {
      if (!inPlay) {
        // Let focused buttons handle Space/Enter themselves
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
        if (S.phase === 'title' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); startRun(); }
        return;
      }
      e.preventDefault();
      Sound.unlock();
      input.touch = false;
      if (!e.repeat && !input.down) { input.down = true; input.pressed = true; }
      return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = true; input.pointer = false; input.touch = false; if (inPlay) e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = true; input.pointer = false; input.touch = false; if (inPlay) e.preventDefault(); }
  });

  window.addEventListener('keyup', (e) => {
    if (ACTION_KEYS.has(e.code) && input.down) { input.down = false; input.released = true; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  });
  window.addEventListener('blur', () => { input.left = input.right = false; if (input.down) { input.down = false; input.released = true; } });

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else {
      r = Math.min(r, w / 2, h / 2);
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function ellipse(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
  function star(c, x, y, r, points = 5, inner = 0.48, rot = -Math.PI / 2) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? r : r * inner;
      const a = rot + (i * Math.PI) / points;
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath();
  }
  function text(c, str, x, y, { size = 40, weight = 700, color = INK, stroke = '#FFFCF6', strokeW = 0, align = 'center', baseline = 'middle', alpha = 1 } = {}) {
    c.save();
    c.globalAlpha *= alpha;
    c.font = `${weight} ${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = baseline;
    if (strokeW) {
      c.lineJoin = 'round';
      c.lineWidth = strokeW;
      c.strokeStyle = stroke;
      c.strokeText(str, x, y);
    }
    c.fillStyle = color;
    c.fillText(str, x, y);
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // The world
  // ---------------------------------------------------------------------------
  const PEBBLES = Array.from({ length: 26 }, (_, i) => ({ x: (i * 97.3 + 31) % W, y: GROUND + 18 + ((i * 53) % 70), r: 2 + ((i * 7) % 4) }));
  const TUFTS = Array.from({ length: 12 }, (_, i) => ({ x: (i * 173 + 60) % W, h: 8 + ((i * 5) % 8) }));

  function drawCloud(c, x, y, s, col = 'rgba(255, 253, 248, 0.92)') {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, 0, 26, 0, TAU);
    c.arc(30, -12, 32, 0, TAU);
    c.arc(64, 0, 24, 0, TAU);
    c.fill();
    rr(c, -2, -4, 70, 28, 14);
    c.fill();
    c.restore();
  }

  function drawPalm(c, x, base, h, lean, th) {
    c.save();
    c.strokeStyle = th.trunk;
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, base);
    c.quadraticCurveTo(x + lean * 0.4, base - h * 0.6, x + lean, base - h);
    c.stroke();
    const tx = x + lean, ty = base - h;
    c.fillStyle = th.leaf;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      c.save();
      c.translate(tx, ty);
      c.rotate(a);
      ellipse(c, 34, 0, 36, 9, 0.25 * Math.sign(i - 2.5 || 1));
      c.fill();
      c.restore();
    }
    c.restore();
  }

  // Five worlds — a new one every level
  const THEMES = [
    { name: 'Jurassic Morning', sky: ['#F7EFDF', '#EDF1E3'], sun: '#F3C98A', glow: 'rgba(242, 196, 126, 0.25)', cloud: 'rgba(255, 253, 248, 0.92)',
      volcano: '#DCCBAF', smoke: '214, 205, 192', hill1: '#D3DFC0', hill2: '#BFD3A6', ground: '#E8D7B2', edge: '#D9C397',
      pebble: 'rgba(160, 130, 90, 0.25)', tuft: '#A9C28F', trunk: '#A88C66', leaf: '#93B884' },
    { name: 'Golden Sunset', sky: ['#F2B48C', '#F8E3C6'], sun: '#EE7F55', glow: 'rgba(238, 127, 85, 0.28)', cloud: 'rgba(255, 234, 216, 0.9)',
      volcano: '#C9937E', smoke: '222, 186, 170', hill1: '#D9A88A', hill2: '#C38D73', ground: '#EBC9A2', edge: '#D7AA7F',
      pebble: 'rgba(150, 100, 70, 0.25)', tuft: '#BB8D69', trunk: '#8E6A52', leaf: '#B0906F' },
    { name: 'Starry Night', sky: ['#1E2A47', '#44567E'], sun: '#F4EBD0', glow: 'rgba(244, 235, 208, 0.16)', cloud: 'rgba(120, 136, 172, 0.5)', moon: true, stars: true,
      volcano: '#2C3856', smoke: '96, 108, 140', hill1: '#2F3F5E', hill2: '#283652', ground: '#5B6175', edge: '#4B5066',
      pebble: 'rgba(25, 28, 45, 0.3)', tuft: '#4F6B66', trunk: '#4A4258', leaf: '#3F5B5A' },
    { name: 'Ice Age', sky: ['#D8E8F3', '#F3F8FB'], sun: '#FFF3CF', glow: 'rgba(255, 243, 207, 0.45)', cloud: 'rgba(255, 255, 255, 0.95)', snow: true, cap: true,
      volcano: '#C6D6E0', smoke: '232, 238, 242', hill1: '#D2E2EC', hill2: '#BCD2E0', ground: '#F4F8FA', edge: '#D9E5EC',
      pebble: 'rgba(110, 145, 170, 0.18)', tuft: '#B3C8D5', trunk: '#8E8A86', leaf: '#9DB9AE' },
    { name: 'Volcano Panic', sky: ['#E89C86', '#F6D6C3'], sun: '#E25C3F', glow: 'rgba(226, 92, 63, 0.25)', cloud: 'rgba(242, 214, 204, 0.75)', embers: true, lava: true,
      volcano: '#7E5446', smoke: '112, 92, 88', hill1: '#C9876F', hill2: '#B0705C', ground: '#D9A585', edge: '#C38866',
      pebble: 'rgba(110, 60, 40, 0.3)', tuft: '#A0715A', trunk: '#6E4E40', leaf: '#93805F' },
  ];
  const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 211.7 + 40) % W, y: 20 + ((i * 97.1) % 250), r: 0.8 + (i % 3) * 0.6, p: i * 1.7 }));
  const FLAKES = Array.from({ length: 60 }, (_, i) => ({ x: (i * 157.3) % W, s: 18 + (i % 5) * 9, r: 1.5 + (i % 3), p: i * 0.9 }));
  const EMBERS = Array.from({ length: 26 }, (_, i) => ({ x: 560 + ((i * 61.3) % 260), s: 30 + (i % 4) * 14, p: i * 0.41 }));

  function theme() { return THEMES[(S.themeIdx || 0) % THEMES.length]; }
  function worldName(idx = S.themeIdx || 0) {
    const lap = Math.floor(idx / THEMES.length) + 1;
    const roman = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX'];
    return THEMES[idx % THEMES.length].name + (lap > 1 ? (roman[lap] || ` ${lap}`) : '');
  }

  function drawWorld(c, t, th = theme()) {
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    c.fillStyle = sky;
    c.fillRect(-40, -40, W + 80, GROUND + 40);

    if (th.stars) {
      for (const st of STARS) {
        c.fillStyle = `rgba(255, 248, 225, ${0.45 + 0.45 * Math.sin(t * 2 + st.p)})`;
        circle(c, st.x, st.y, st.r); c.fill();
      }
    }

    // Sun / moon
    c.fillStyle = th.glow;
    circle(c, 800, 112, 74); c.fill();
    c.fillStyle = th.sun;
    circle(c, 800, 112, 46); c.fill();
    if (th.moon) {
      c.fillStyle = 'rgba(200, 190, 160, 0.45)';
      circle(c, 786, 100, 9); c.fill();
      circle(c, 814, 126, 6); c.fill();
      circle(c, 812, 96, 4); c.fill();
    }

    // Clouds
    for (let i = 0; i < 3; i++) {
      const sp = 8 + i * 5;
      const x = ((i * 380 + t * sp) % (W + 260)) - 160;
      drawCloud(c, x, 70 + i * 46, 0.75 + (i % 2) * 0.3, th.cloud);
    }

    // Volcano + smoke
    c.fillStyle = th.volcano;
    c.beginPath();
    c.moveTo(540, GROUND - 60);
    c.lineTo(650, GROUND - 228);
    c.quadraticCurveTo(672, GROUND - 238, 694, GROUND - 228);
    c.lineTo(830, GROUND - 60);
    c.closePath();
    c.fill();
    if (th.cap) {
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      c.moveTo(626, GROUND - 190); c.lineTo(650, GROUND - 228);
      c.quadraticCurveTo(672, GROUND - 238, 694, GROUND - 228);
      c.lineTo(722, GROUND - 186); c.lineTo(704, GROUND - 196); c.lineTo(686, GROUND - 182);
      c.lineTo(664, GROUND - 198); c.lineTo(646, GROUND - 184);
      c.closePath(); c.fill();
    }
    if (th.lava) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 3);
      c.fillStyle = `rgba(255, 140, 60, ${0.35 * pulse})`;
      circle(c, 672, GROUND - 232, 34); c.fill();
      c.strokeStyle = '#F2762E';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(662, GROUND - 228); c.quadraticCurveTo(640, GROUND - 180, 628, GROUND - 130);
      c.moveTo(684, GROUND - 228); c.quadraticCurveTo(700, GROUND - 170, 726, GROUND - 120);
      c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const k = ((t * 16 + i * 34) % 170) / 170;
      c.fillStyle = `rgba(${th.smoke}, ${0.75 * (1 - k)})`;
      circle(c, 672 + Math.sin(k * 5 + i) * 12 + k * 30, GROUND - 240 - k * 150, 12 + k * 26);
      c.fill();
    }

    // Hills
    c.fillStyle = th.hill1;
    c.beginPath();
    c.moveTo(-40, GROUND);
    for (let x = -40; x <= W + 40; x += 20) c.lineTo(x, GROUND - 78 + Math.sin(x * 0.0058 + 1) * 24 + Math.sin(x * 0.014) * 9);
    c.lineTo(W + 40, GROUND);
    c.closePath();
    c.fill();

    drawPalm(c, 86, GROUND - 30, 150, 26, th);
    drawPalm(c, 892, GROUND - 26, 120, -20, th);

    c.fillStyle = th.hill2;
    c.beginPath();
    c.moveTo(-40, GROUND + 2);
    for (let x = -40; x <= W + 40; x += 20) c.lineTo(x, GROUND - 32 + Math.sin(x * 0.009 + 2.4) * 15);
    c.lineTo(W + 40, GROUND + 2);
    c.closePath();
    c.fill();

    // Ground
    c.fillStyle = th.ground;
    c.fillRect(-40, GROUND, W + 80, H - GROUND + 40);
    c.fillStyle = th.edge;
    c.fillRect(-40, GROUND, W + 80, 5);
    c.fillStyle = th.pebble;
    for (const p of PEBBLES) { ellipse(c, p.x, p.y, p.r * 1.4, p.r); c.fill(); }
    c.strokeStyle = th.tuft;
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (const tf of TUFTS) {
      c.beginPath();
      c.moveTo(tf.x - 5, GROUND + 2); c.lineTo(tf.x - 8, GROUND - tf.h + 3);
      c.moveTo(tf.x, GROUND + 2); c.lineTo(tf.x, GROUND - tf.h);
      c.moveTo(tf.x + 5, GROUND + 2); c.lineTo(tf.x + 9, GROUND - tf.h + 4);
      c.stroke();
    }

    if (th.snow) {
      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (const f of FLAKES) {
        const y = ((t * f.s + f.p * 60) % (H + 20)) - 10;
        circle(c, f.x + Math.sin(t + f.p) * 14, y, f.r); c.fill();
      }
    }
    if (th.embers) {
      for (const e of EMBERS) {
        const k = ((t * 0.35 + e.p) % 1);
        c.fillStyle = `rgba(255, ${140 + ((e.s * 3) % 80)}, 70, ${0.85 * (1 - k)})`;
        circle(c, e.x + Math.sin(t * 2 + e.p * 9) * 18 - k * 60, GROUND - 240 - k * 260 + 230, 2.4); c.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // The T-rex
  // ---------------------------------------------------------------------------
  const GREEN = { body: '#79AB62', dark: '#5D8C4B', belly: '#EFDFB4', spike: '#E27D5F', mouth: '#8A3B35', blush: 'rgba(233, 122, 108, 0.42)' };
  const BLUE = { body: '#76A3D4', dark: '#5682B5', belly: '#F3E5C3', spike: '#F2B347', mouth: '#7A3340', blush: 'rgba(233, 122, 108, 0.42)' };

  function drawArm(c, color, sx, sy, a, bend) {
    c.save();
    c.translate(sx, sy);
    c.rotate(a);
    c.fillStyle = color;
    rr(c, -4, -5.5, 24, 11, 5.5); c.fill();
    c.translate(19, 0);
    c.rotate(bend);
    rr(c, -3, -4.5, 17, 9, 4.5); c.fill();
    c.translate(14, 0);
    c.strokeStyle = '#F6EBD0';
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, -3); c.lineTo(5, -5);
    c.moveTo(0, 2); c.lineTo(5, 3);
    c.stroke();
    c.restore();
  }

  // Local position of the hand for a given shoulder/arm pose
  function armTip(sx, sy, a, bend) {
    const ex = sx + Math.cos(a) * 19, ey = sy + Math.sin(a) * 19;
    return { x: ex + Math.cos(a + bend) * 17, y: ey + Math.sin(a + bend) * 17 };
  }

  /**
   * Draws a T-rex standing at (o.x, o.y) — feet on the ground.
   * Returns world positions of the near hand and the face, which games use for hit tests.
   */
  function drawRex(c, o) {
    const p = o.pal || GREEN;
    const s = o.s || 1;
    const f = o.face || 1;
    const sq = o.squash || 1;
    const walk = o.walk || 0;
    const legA = Math.sin(walk) * 9;
    const legB = -Math.sin(walk) * 9;
    const bob = (o.walk ? -Math.abs(Math.sin(walk)) * 5 : 0) + (o.bob || 0);
    const t = o.t || 0;
    let eye = o.eye || 'open';
    if (eye === 'open' && (t + (o.blinkSeed || 0)) % 3.4 < 0.12) eye = 'closed';

    const xs = s * f * (1 + (1 - sq) * 0.55);
    const ys = s * sq;
    const arm = o.arm == null ? 0.9 : o.arm;
    const bend = o.bend == null ? 0.7 : o.bend;
    const armFar = o.armFar == null ? arm + 0.15 : o.armFar;
    const mouth = clamp(o.mouth || 0, 0, 1);
    const tilt = o.headTilt || 0;

    c.save();
    c.translate(o.x, o.y);

    // Shadow (unscaled vertically so it stays on the ground)
    if (o.shadow !== false) {
      const gy = o.groundY != null ? o.groundY - o.y : 0;
      const k = clamp(1 - gy / 260, 0.45, 1);
      c.fillStyle = 'rgba(40, 35, 25, 0.15)';
      ellipse(c, 0, gy + 2, 74 * s * k * (1 + (1 - sq) * 0.6), 9 * s * k);
      c.fill();
    }

    c.translate(0, bob * s);
    c.scale(xs, ys);

    // Tail
    const wag = Math.sin(t * 3) * 4 + (o.tailWag || 0);
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(-26, -96);
    c.quadraticCurveTo(-100, -84, -156, -26 + wag);
    c.quadraticCurveTo(-92, -46, -28, -42);
    c.closePath();
    c.fill();
    // Tail spikes
    c.fillStyle = p.spike;
    for (const [x, y, r] of [[-70, -86, 0.15], [-104, -68, 0.5], [-132, -48 + wag * 0.6, 0.7]]) {
      c.save(); c.translate(x, y); c.rotate(-r);
      c.beginPath(); c.moveTo(-7, 4); c.lineTo(0, -9); c.lineTo(7, 4); c.closePath(); c.fill();
      c.restore();
    }

    // Far leg + far arm (darker, behind)
    c.fillStyle = p.dark;
    rr(c, -4 + legB, -50, 26, 48, 12); c.fill();
    rr(c, -6 + legB, -13, 40, 13, 6.5); c.fill();
    drawArm(c, p.dark, 30, -104, armFar, bend);

    // Back spikes
    c.fillStyle = p.spike;
    for (const [x, y, r] of [[-40, -112, -0.6], [-24, -128, -0.35], [-6, -138, -0.1]]) {
      c.save(); c.translate(x, y); c.rotate(r);
      c.beginPath(); c.moveTo(-8, 6); c.lineTo(0, -11); c.lineTo(8, 6); c.closePath(); c.fill();
      c.restore();
    }

    // Body + belly
    c.fillStyle = p.body;
    ellipse(c, 0, -80, 52, 58, -0.35); c.fill();
    c.fillStyle = p.belly;
    ellipse(c, 19, -70, 25, 40, -0.35); c.fill();
    c.strokeStyle = 'rgba(160, 130, 80, 0.25)';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(4 + i * 3, -96 + i * 20);
      c.quadraticCurveTo(20 + i * 3, -90 + i * 20, 36 + i * 2, -100 + i * 20);
      c.stroke();
    }

    // Near leg
    c.fillStyle = p.body;
    ellipse(c, -10 + legA * 0.6, -42, 28, 30, -0.2); c.fill();
    rr(c, -10 + legA, -16, 46, 16, 8); c.fill();
    c.fillStyle = '#F6EBD0';
    for (let i = 0; i < 3; i++) { circle(c, 30 + legA - i * 2, -4 - i * 4 + 4, 2.2); c.fill(); }

    // Head
    c.save();
    c.translate(18, -128);
    c.rotate(tilt);
    c.fillStyle = p.body;
    ellipse(c, 0, 4, 27, 32); c.fill();

    const ja = mouth * 0.55;
    const tipX = 86 * Math.cos(ja) - 2 * Math.sin(ja);
    const tipY = -14 + 86 * Math.sin(ja) + 2 * Math.cos(ja);
    if (mouth > 0.03) {
      c.fillStyle = p.mouth;
      c.beginPath();
      c.moveTo(2, -16);
      c.lineTo(92, -14);
      c.lineTo(tipX + 4, tipY);
      c.lineTo(4, -6);
      c.closePath();
      c.fill();
      // tongue
      c.fillStyle = '#E58C8A';
      ellipse(c, 40 + 20 * Math.cos(ja), -10 + 24 * Math.sin(ja), 20, 6, ja); c.fill();
    }
    // Lower jaw
    c.save();
    c.translate(0, -14);
    c.rotate(ja);
    c.fillStyle = p.body;
    rr(c, -6, -8, 92, 20, 10); c.fill();
    if (mouth > 0.03) {
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 4; i++) {
        const x = 46 + i * 10;
        c.beginPath(); c.moveTo(x, -7); c.lineTo(x + 4, -13); c.lineTo(x + 8, -7); c.closePath(); c.fill();
      }
    }
    c.restore();

    // Skull
    c.fillStyle = p.body;
    rr(c, -10, -62, 106, 52, 26); c.fill();
    // Head spikes
    c.fillStyle = p.spike;
    for (const [x, y] of [[8, -60], [24, -64]]) {
      c.beginPath(); c.moveTo(x - 7, y + 4); c.lineTo(x, y - 9); c.lineTo(x + 7, y + 4); c.closePath(); c.fill();
    }
    c.fillStyle = p.body;
    rr(c, -10, -62, 40, 20, 10); c.fill();

    if (mouth > 0.03) {
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 4; i++) {
        const x = 50 + i * 10;
        c.beginPath(); c.moveTo(x, -11); c.lineTo(x + 4, -4); c.lineTo(x + 8, -11); c.closePath(); c.fill();
      }
    } else if (o.smile) {
      c.strokeStyle = 'rgba(38, 48, 42, 0.55)';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(58, -16);
      c.quadraticCurveTo(74, -8, 90, -17);
      c.stroke();
    } else {
      c.strokeStyle = 'rgba(38, 48, 42, 0.35)';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(60, -14); c.lineTo(90, -15); c.stroke();
    }

    // Cheek puff (for blowing candles)
    if (o.puff > 0.02) {
      c.fillStyle = p.body;
      circle(c, 70, -22, 6 + o.puff * 20); c.fill();
      c.strokeStyle = p.dark; c.lineWidth = 2;
      c.stroke();
      c.fillStyle = p.blush;
      ellipse(c, 72, -22, 8 + o.puff * 6, 5 + o.puff * 3); c.fill();
    }

    // Nostril
    c.fillStyle = 'rgba(38, 48, 42, 0.55)';
    ellipse(c, 86, -48, 3.5, 2.2, -0.3); c.fill();

    // Blush
    if (o.blush !== false && !(o.puff > 0.02)) {
      c.fillStyle = p.blush;
      ellipse(c, 60, -24, 9, 5); c.fill();
    }

    // Eye
    const ex = 52, ey = -40;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (eye === 'happy') {
      c.strokeStyle = INK; c.lineWidth = 4;
      c.beginPath(); c.arc(ex, ey + 4, 9, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (eye === 'closed') {
      c.strokeStyle = INK; c.lineWidth = 4;
      c.beginPath(); c.arc(ex, ey - 3, 9, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    } else if (eye === 'x') {
      c.strokeStyle = INK; c.lineWidth = 4;
      c.beginPath();
      c.moveTo(ex - 7, ey - 7); c.lineTo(ex + 7, ey + 7);
      c.moveTo(ex + 7, ey - 7); c.lineTo(ex - 7, ey + 7);
      c.stroke();
    } else {
      const r = eye === 'wide' ? 14 : 12;
      c.fillStyle = '#FFFFFF';
      circle(c, ex, ey, r); c.fill();
      const lx = (o.lookX || 0) * 4 + 3, ly = (o.lookY || 0) * 4;
      c.fillStyle = INK;
      circle(c, ex + lx, ey + ly, eye === 'wide' ? 4.5 : 6.5); c.fill();
      c.fillStyle = '#FFFFFF';
      circle(c, ex + lx + 2, ey + ly - 2.5, 2); c.fill();
      if (eye === 'squint') {
        c.fillStyle = p.body;
        rr(c, ex - 16, ey - 18, 32, 14, 6); c.fill();
      }
    }
    // Brow
    c.strokeStyle = 'rgba(38, 48, 42, 0.7)';
    c.lineWidth = 4;
    c.beginPath();
    if (o.brow === 'worried') { c.moveTo(ex - 12, ey - 17); c.lineTo(ex + 10, ey - 23); }
    else if (o.brow === 'focus') { c.moveTo(ex - 12, ey - 21); c.lineTo(ex + 11, ey - 14); }
    else { c.moveTo(ex - 11, ey - 20); c.quadraticCurveTo(ex, ey - 25, ex + 11, ey - 20); }
    c.stroke();

    // Sweat drop
    if (o.sweat) {
      const k = (t * 1.6) % 1;
      c.fillStyle = `rgba(120, 180, 230, ${1 - k * 0.6})`;
      const sx = 22, sy = -58 + k * 18;
      c.beginPath();
      c.moveTo(sx, sy - 10);
      c.quadraticCurveTo(sx + 8, sy + 2, sx, sy + 5);
      c.quadraticCurveTo(sx - 8, sy + 2, sx, sy - 10);
      c.fill();
    }
    c.restore(); // head

    // Near arm (on top)
    const shoulderX = 36, shoulderY = -98;
    drawArm(c, p.body, shoulderX, shoulderY, arm, bend);

    c.restore();

    const tip = armTip(shoulderX, shoulderY, arm, bend);
    const faceLX = 18 + 46, faceLY = -128 - 34;
    return {
      hand: { x: o.x + tip.x * xs, y: o.y + (tip.y + bob) * ys },
      face: { x: o.x + faceLX * xs, y: o.y + (faceLY + bob) * ys },
      mouth: { x: o.x + (18 + 92) * xs, y: o.y + (-128 - 16 + bob) * ys },
    };
  }

  // Pterodactyl friend (faces left). Returns the world position of its little hand.
  function drawPtero(c, o) {
    const s = o.s || 1, fl = o.flap || 0, fx = o.flip ? -1 : 1;
    c.save();
    c.translate(o.x, o.y);
    c.scale(s * fx, s);
    // Shadow on the ground
    c.save();
    c.scale(1 / s, 1 / s);
    c.fillStyle = 'rgba(70, 55, 30, 0.1)';
    ellipse(c, 0, GROUND - o.y + 4, 40, 6); c.fill();
    c.restore();

    const wing = (col, a, ox) => {
      c.save();
      c.translate(ox, -6);
      c.rotate(a);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-16, 0);
      c.lineTo(18, -78);
      c.quadraticCurveTo(26, -30, 34, 4);
      c.quadraticCurveTo(10, -6, -16, 0);
      c.fill();
      c.restore();
    };
    wing('#C27A5E', Math.sin(fl) * 0.55 - 0.15, 10);

    // Tail
    c.strokeStyle = '#DE9474'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(24, 2); c.lineTo(50, 8); c.stroke();
    c.fillStyle = '#E27D5F';
    c.beginPath(); c.moveTo(50, 2); c.lineTo(58, 8); c.lineTo(50, 14); c.lineTo(44, 8); c.closePath(); c.fill();

    // Legs
    c.strokeStyle = '#B86E52'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(8, 10); c.lineTo(14, 26); c.moveTo(16, 8); c.lineTo(22, 24); c.stroke();

    // Body
    c.fillStyle = '#DE9474';
    ellipse(c, 0, 0, 30, 15); c.fill();
    c.fillStyle = '#F6E3C2';
    ellipse(c, -4, 6, 20, 7); c.fill();

    // Arm + little hand
    c.strokeStyle = '#DE9474'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(-12, 4); c.lineTo(-32, 16); c.stroke();
    c.fillStyle = '#DE9474';
    circle(c, -36, 18, 7); c.fill();
    c.strokeStyle = '#F6EBD0'; c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(-40, 13); c.lineTo(-44, 8);
    c.moveTo(-42, 18); c.lineTo(-48, 17);
    c.moveTo(-40, 23); c.lineTo(-44, 27);
    c.stroke();

    // Head
    c.fillStyle = '#E27D5F';
    c.beginPath(); c.moveTo(-26, -20); c.lineTo(-2, -36); c.lineTo(-20, -8); c.closePath(); c.fill();
    c.fillStyle = '#DE9474';
    circle(c, -30, -12, 14); c.fill();
    c.fillStyle = '#F2B347';
    c.beginPath(); c.moveTo(-40, -16); c.lineTo(-74, -9); c.lineTo(-40, -6); c.closePath(); c.fill();
    if (o.happy) {
      c.fillStyle = '#E8A23A';
      c.beginPath(); c.moveTo(-40, -6); c.lineTo(-64, 2); c.lineTo(-38, 0); c.closePath(); c.fill();
    }
    if (o.happy) {
      c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.arc(-32, -12, 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else {
      c.fillStyle = '#FFFFFF'; circle(c, -32, -14, 6); c.fill();
      c.fillStyle = INK; circle(c, -34, -13, 3.5); c.fill();
      c.fillStyle = '#FFFFFF'; circle(c, -33, -15, 1.2); c.fill();
    }
    c.fillStyle = 'rgba(233, 122, 108, 0.45)';
    ellipse(c, -24, -5, 5, 3); c.fill();

    wing('#E9A587', Math.sin(fl + 0.5) * 0.6 - 0.1, -2);
    c.restore();
    return { hand: { x: o.x - 40 * s * fx, y: o.y + 18 * s } };
  }

  // Extra props for the newer micro-games
  function drawBoulder(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = '#9C8B78';
    circle(c, 0, 0, r); c.fill();
    c.fillStyle = '#8A7A68';
    circle(c, -r * 0.3, -r * 0.25, r * 0.24); c.fill();
    circle(c, r * 0.38, r * 0.28, r * 0.17); c.fill();
    circle(c, -r * 0.2, r * 0.45, r * 0.12); c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, r * 0.75, -2.4, -1.4); c.stroke();
    c.restore();
  }

  function drawBeachBall(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    const cols = ['#E07A5F', '#FFFFFF', '#76A3D4', '#FFFFFF', '#F3C98A', '#FFFFFF'];
    for (let i = 0; i < 6; i++) {
      c.fillStyle = cols[i];
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, (i * TAU) / 6, ((i + 1) * TAU) / 6); c.closePath(); c.fill();
    }
    c.fillStyle = '#FFFFFF';
    circle(c, 0, 0, r * 0.18); c.fill();
    c.restore();
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ellipse(c, x - r * 0.38, y - r * 0.42, r * 0.3, r * 0.15, -0.6); c.fill();
    c.strokeStyle = 'rgba(38, 48, 42, 0.12)';
    c.lineWidth = 2;
    circle(c, x, y, r); c.stroke();
  }

  function drawBalloon(c, x, y, col) {
    c.strokeStyle = 'rgba(38, 48, 42, 0.35)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, y + 34);
    c.quadraticCurveTo(x + 14, y + 44, x + 26, GROUND - 1);
    c.stroke();
    c.fillStyle = col;
    ellipse(c, x, y, 26, 31); c.fill();
    c.beginPath(); c.moveTo(x - 5, y + 35); c.lineTo(x + 5, y + 35); c.lineTo(x, y + 29); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ellipse(c, x - 9, y - 12, 6, 10, 0.4); c.fill();
  }

  function drawNest(c, x, y) {
    c.fillStyle = '#8C6A4A';
    ellipse(c, x, y, 60, 18); c.fill();
    c.fillStyle = '#6E5238';
    ellipse(c, x, y - 7, 44, 9); c.fill();
    c.strokeStyle = '#A7845F';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -0.5 + (i % 3) * 0.45, ox = -48 + i * 12;
      c.beginPath();
      c.moveTo(x + ox - Math.cos(a) * 12, y + 4 + Math.sin(a) * 6);
      c.lineTo(x + ox + Math.cos(a) * 12, y + 4 - Math.sin(a) * 6);
      c.stroke();
    }
  }

  // An early mammal with a burglar mask
  function drawThief(c, x, y, o = {}) {
    c.save();
    c.translate(x, y);
    c.scale(o.flip ? -1 : 1, 1);
    c.fillStyle = '#9A8F86';
    ellipse(c, 0, 18, 26, 22); c.fill();
    circle(c, -16, -26, 10); c.fill();
    circle(c, 16, -26, 10); c.fill();
    c.fillStyle = '#E8B4B0';
    circle(c, -16, -26, 5); c.fill();
    circle(c, 16, -26, 5); c.fill();
    c.fillStyle = '#9A8F86';
    circle(c, 0, -8, 22); c.fill();
    c.fillStyle = '#2F3437';
    rr(c, -23, -18, 46, 13, 6.5); c.fill();
    c.fillStyle = '#FFFFFF';
    if (o.scared) {
      circle(c, -8, -12, 5); c.fill(); circle(c, 8, -12, 5); c.fill();
      c.fillStyle = INK; circle(c, -8, -12, 2); c.fill(); circle(c, 8, -12, 2); c.fill();
    } else {
      circle(c, -8, -12, 3.2); c.fill(); circle(c, 8, -12, 3.2); c.fill();
    }
    c.fillStyle = '#E58C8A';
    circle(c, 0, -1, 3.8); c.fill();
    c.strokeStyle = 'rgba(38, 48, 42, 0.5)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-6, 2); c.lineTo(-22, 0); c.moveTo(-6, 4); c.lineTo(-21, 7);
    c.moveTo(6, 2); c.lineTo(22, 0); c.moveTo(6, 4); c.lineTo(21, 7);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    if (o.scared) { circle(c, 0, 8, 4); c.stroke(); }
    else { c.moveTo(-6, 6); c.quadraticCurveTo(0, 11, 7, 5); c.stroke(); }
    if (o.egg) drawFood(c, 'egg', 20, 20, 0.25, 0.75);
    c.restore();
  }

  // Your adorable baby niece/nephew — do NOT roar at them
  function drawBaby(c, x, y, o = {}) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#A9D18F';
    ellipse(c, 0, 20, 24, 22); c.fill();
    circle(c, 0, -8, 24); c.fill();
    ellipse(c, 16, 0, 16, 11); c.fill();
    c.fillStyle = '#FFFFFF';
    circle(c, -4, -14, 8); c.fill();
    c.fillStyle = INK;
    circle(c, -2, -13, 4.5); c.fill();
    c.fillStyle = '#FFFFFF';
    circle(c, -0.5, -15, 1.6); c.fill();
    c.fillStyle = 'rgba(233, 122, 108, 0.5)';
    ellipse(c, 8, 0, 6, 3.5); c.fill();
    c.strokeStyle = 'rgba(38, 48, 42, 0.6)';
    c.lineWidth = 2.2;
    c.beginPath();
    if (o.cry) { c.arc(16, 9, 5, Math.PI * 1.15, Math.PI * 1.85); }
    else { c.arc(16, 2, 6, Math.PI * 0.2, Math.PI * 0.8); }
    c.stroke();
    // bow
    c.fillStyle = '#F29BB5';
    c.beginPath(); c.moveTo(-6, -32); c.lineTo(-22, -42); c.lineTo(-22, -24); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-6, -32); c.lineTo(10, -42); c.lineTo(10, -24); c.closePath(); c.fill();
    circle(c, -6, -32, 5); c.fill();
    if (o.cry) {
      c.fillStyle = 'rgba(120, 180, 230, 0.9)';
      const k = (performance.now() / 500) % 1;
      circle(c, -10, -4 + k * 22, 3.5); c.fill();
    }
    c.restore();
  }

  // Close-up claw (used in the clap zoom bubble)
  function drawClaw(c, x, y, dir, s, pal = GREEN) {
    c.save();
    c.translate(x, y);
    c.scale(dir * s, s);
    c.fillStyle = pal.body;
    rr(c, -70, -10, 66, 20, 10); c.fill();
    circle(c, 0, 0, 13); c.fill();
    rr(c, 4, -12, 16, 8, 4); c.fill();
    rr(c, 4, 4, 16, 8, 4); c.fill();
    c.fillStyle = '#F6EBD0';
    for (const yy of [-8, 8]) {
      c.beginPath(); c.moveTo(18, yy - 4); c.lineTo(26, yy); c.lineTo(18, yy + 4); c.closePath(); c.fill();
    }
    c.fillStyle = pal.dark;
    ellipse(c, -40, 0, 6, 3); c.fill();
    c.restore();
  }

  // Snacks
  function drawFood(c, kind, x, y, rot = 0, s = 1) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    if (kind === 'donut') {
      c.lineWidth = 14; c.strokeStyle = '#E3AE6C';
      c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.stroke();
      c.lineWidth = 10; c.strokeStyle = '#F29BB5';
      c.beginPath(); c.arc(0, -1, 14, 0, TAU); c.stroke();
      const cols = ['#FFFFFF', '#79AB62', '#F3C98A', '#76A3D4'];
      c.lineWidth = 2.4; c.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8;
        c.strokeStyle = cols[i % 4];
        c.beginPath();
        c.moveTo(Math.cos(a) * 14 - 2, Math.sin(a) * 14 - 2);
        c.lineTo(Math.cos(a) * 14 + 2, Math.sin(a) * 14);
        c.stroke();
      }
    } else if (kind === 'egg') {
      c.fillStyle = '#FBF4E2';
      ellipse(c, 0, 0, 16, 20); c.fill();
      c.strokeStyle = 'rgba(94, 156, 91, 0.5)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#9CC48F';
      for (const [px, py, pr] of [[-5, -6, 4], [6, 2, 3.5], [-2, 9, 2.6], [5, -12, 2]]) { circle(c, px, py, pr); c.fill(); }
    } else {
      // cupcake
      c.fillStyle = '#7FB3D5';
      c.beginPath(); c.moveTo(-15, 0); c.lineTo(15, 0); c.lineTo(11, 20); c.lineTo(-11, 20); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5.5, 1); c.lineTo(i * 4.2, 19); c.stroke(); }
      c.fillStyle = '#FFF8F0';
      circle(c, -8, -2, 9); c.fill(); circle(c, 8, -2, 9); c.fill(); circle(c, 0, -9, 11); c.fill();
      c.fillStyle = '#D9534F';
      circle(c, 0, -20, 5); c.fill();
    }
    c.restore();
  }

  // ---------------------------------------------------------------------------
  // Particles & effects
  // ---------------------------------------------------------------------------
  const CONFETTI = ['#E07A5F', '#79AB62', '#F3C98A', '#76A3D4', '#F29BB5'];

  function burst(x, y, n, opts = {}) {
    const {
      colors = CONFETTI, speed = 280, gravity = 620, size = [4, 9], life = [0.6, 1.1],
      shape = 'rect', spread = TAU, dir = -Math.PI / 2, up = 120,
    } = opts;
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const sp = rand(speed * 0.35, speed);
      const l = rand(life[0], life[1]);
      S.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up * Math.random(),
        g: gravity, life: l, max: l, size: rand(size[0], size[1]), color: pick(colors),
        rot: rand(0, TAU), vr: rand(-10, 10), shape,
      });
    }
  }
  function dust(x, y, n = 10, color = 'rgba(200, 180, 140, 0.8)') {
    burst(x, y, n, { colors: [color], speed: 180, gravity: -40, size: [10, 20], life: [0.4, 0.8], shape: 'puff', spread: Math.PI, dir: -Math.PI / 2, up: 0 });
  }

  function updateParts(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.vx *= p.shape === 'puff' ? 0.92 : 0.99;
      p.vy = p.shape === 'puff' ? p.vy * 0.92 + p.g * dt : p.vy + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt;
      if (p.life <= 0) S.parts.splice(i, 1);
    }
  }
  function drawParts(c) {
    for (const p of S.parts) {
      const k = p.life / p.max;
      c.save();
      c.globalAlpha = clamp(k * 2, 0, 1) * (p.shape === 'puff' ? 0.7 : 1);
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      if (p.shape === 'rect') { c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      else if (p.shape === 'star') { star(c, 0, 0, p.size); c.fill(); }
      else if (p.shape === 'puff') { circle(c, 0, 0, p.size * (1.6 - k * 0.6)); c.fill(); }
      else { circle(c, 0, 0, p.size / 2); c.fill(); }
      c.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Shared micro-game helpers
  // ---------------------------------------------------------------------------
  function moveRex(g, dt, inp, offset = 0, speed = 540) {
    const before = g.rx;
    const kx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (kx) g.rx += kx * speed * dt;
    else if (inp.pointer && inp.px != null) {
      const d = inp.px - offset - g.rx;
      g.rx += clamp(d * 12 * dt, -speed * 1.5 * dt, speed * 1.5 * dt);
    }
    g.rx = clamp(g.rx, 90, 870);
    const moved = g.rx - before;
    g.moving = Math.abs(moved) > 0.4;
    if (g.moving) { g.walk = (g.walk || 0) + dt * 14; g.dir = Math.sign(moved); }
    else g.walk = 0;
  }

  // ---------------------------------------------------------------------------
  // Micro-games
  // ---------------------------------------------------------------------------
  const GAMES = [
    // 1 — CLAP: mash the button until the tiny hands finally meet
    {
      id: 'clap', cmd: 'CLAP!', hint: { touch: 'Tap fast!', key: 'Mash SPACE!' }, dur: 4.6,
      failText: 'Arms too short…',
      init(g) { g.need = 9 + g.lvl * 2; g.taps = 0; g.pulse = 0; g.hand = null; },
      update(g, dt, inp) {
        g.pulse = Math.max(0, g.pulse - dt * 7);
        if (g.ended) return;
        if (inp.pressed) {
          g.taps++;
          g.pulse = 1;
          Sound.play('tap');
          if (g.hand) burst(g.hand.x, g.hand.y, 3, { speed: 140, size: [3, 6], life: [0.2, 0.4], shape: 'dot', colors: ['#F3C98A', '#FFFFFF'] });
          if (g.taps >= g.need) {
            g.won = true;
            Sound.play('clap');
            burst(690, 230, 26, { shape: 'star', speed: 340, size: [6, 12] });
          }
        }
      },
      draw(g, c, t) {
        const p = clamp(g.taps / g.need, 0, 1);
        const res = g.ended ? g.result : null;
        const r = drawRex(c, {
          x: 300, y: GROUND, s: 1.75, t,
          arm: -0.15 - p * 0.45 - g.pulse * 0.3 + (res === false ? 1 : 0), bend: 0.35,
          armFar: -0.05 - p * 0.45 + g.pulse * 0.2 + (res === false ? 1 : 0),
          eye: res === true ? 'happy' : res === false ? 'closed' : 'squint',
          brow: res == null ? 'focus' : null,
          mouth: res === true ? 0.65 : 0.05 + g.pulse * 0.25,
          sweat: res === false || (res == null && g.time > 1.6 && p < 0.6),
          bob: Math.sin(t * 40) * g.pulse * 2,
        });
        g.hand = r.hand;

        // Zoom bubble
        const bx = 690, by = 236, br = 118;
        c.save();
        c.fillStyle = 'rgba(255, 252, 246, 0.9)';
        for (const [x, y, rad] of [[r.hand.x + 40, r.hand.y - 18, 7], [r.hand.x + 76, r.hand.y - 40, 11]]) { circle(c, x, y, rad); c.fill(); }
        c.shadowColor = 'rgba(70, 55, 30, 0.25)';
        c.shadowBlur = 24;
        c.shadowOffsetY = 8;
        circle(c, bx, by, br); c.fill();
        c.restore();

        c.save();
        circle(c, bx, by, br - 6); c.clip();
        c.fillStyle = '#F0F4E6';
        c.fillRect(bx - br, by - br, br * 2, br * 2);
        const gap = res === true ? 0 : lerp(62, 12, p) - g.pulse * 8 + (res === false ? 20 : 0);
        const shake = res == null ? Math.sin(t * 60) * g.pulse * 3 : 0;
        drawClaw(c, bx - gap - 26, by + 10 + shake, 1, 1.7);
        drawClaw(c, bx + gap + 26, by + 10 - shake, -1, 1.7);
        if (res === true) {
          c.strokeStyle = '#E07A5F';
          c.lineWidth = 5;
          c.lineCap = 'round';
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.2;
            c.beginPath();
            c.moveTo(bx + Math.cos(a) * 34, by + 10 + Math.sin(a) * 34);
            c.lineTo(bx + Math.cos(a) * 58, by + 10 + Math.sin(a) * 58);
            c.stroke();
          }
        }
        c.restore();
        text(c, 'ZOOM ×40', bx, by - br + 26, { size: 15, weight: 600, color: 'rgba(38, 48, 42, 0.45)' });

        // Progress
        c.fillStyle = 'rgba(38, 48, 42, 0.1)';
        rr(c, bx - 100, by + br + 22, 200, 14, 7); c.fill();
        c.fillStyle = res === false ? '#E07A5F' : '#79AB62';
        rr(c, bx - 100, by + br + 22, Math.max(14, 200 * p), 14, 7); c.fill();
      },
    },

    // 2 — HIGH FIVE: a pterodactyl friend swoops past at exactly tiny-arm height
    {
      id: 'highfive', cmd: 'HIGH FIVE!', hint: { touch: 'Tap when in reach', key: 'SPACE when in reach' }, dur: 4.8,
      failText: 'Left hanging…',
      init(g) {
        g.fx = 1090; g.v = 210 + g.lvl * 50; g.state = 'fly'; g.swing = 0;
        g.flap = 0; g.rexHand = null; g.friendHand = null; g.inZone = false; g.fy = 270;
      },
      update(g, dt, inp) {
        g.swing = Math.max(0, g.swing - dt * 2.5);
        g.flap += dt * (g.state === 'slap' ? 9 : 13);
        if (g.state === 'fly') g.fx -= g.v * dt;
        if (g.rexHand) g.fy = lerp(g.fy, g.rexHand.y - 24 + Math.sin(g.time * 5) * 5, clamp(dt * 8, 0, 1));
        if (g.ended) return;
        const d = g.friendHand && g.rexHand ? g.friendHand.x - g.rexHand.x : 999;
        g.inZone = d > -30 && d < 42;
        if (inp.pressed) {
          g.swing = 1;
          if (g.inZone) {
            g.state = 'slap';
            g.won = true;
            Sound.play('slap');
            S.shake = reduceMotion ? 0 : 7;
            burst((g.friendHand.x + g.rexHand.x) / 2, (g.friendHand.y + g.rexHand.y) / 2, 18, { shape: 'star', speed: 300, size: [6, 11] });
          } else {
            Sound.play('whoosh');
            g.lost = true;
            g.failText = d > 0 ? 'Too early!' : 'Too late!';
          }
        } else if (d < -60) {
          g.lost = true;
          g.failText = 'Left hanging…';
        }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        const rex = drawRex(c, {
          x: 250, y: GROUND, s: 1.75, t,
          arm: g.state === 'slap' ? -0.25 : lerp(0.25, -0.4, g.swing), bend: -0.15,
          eye: res === true ? 'happy' : res === false ? 'closed' : 'open',
          lookX: 1, lookY: 0.6, mouth: res === true ? 0.5 : 0, smile: res !== false,
          sweat: res === false,
        });
        g.rexHand = rex.hand;

        if (!g.ended) {
          c.save();
          c.setLineDash([6, 7]);
          c.lineWidth = 3;
          c.strokeStyle = g.inZone ? '#E07A5F' : 'rgba(38, 48, 42, 0.28)';
          circle(c, rex.hand.x, rex.hand.y, g.inZone ? 32 + Math.sin(t * 20) * 2 : 30);
          c.stroke();
          c.restore();
        }

        const fr = drawPtero(c, { x: g.fx, y: g.fy, s: 1.2, flap: g.flap, happy: g.state === 'slap', t });
        g.friendHand = fr.hand;

        if (!g.ended && g.fx < 1010) {
          const bx = g.fx + 10, by = g.fy - 92;
          c.save();
          c.fillStyle = '#FFFCF6';
          c.shadowColor = 'rgba(70, 55, 30, 0.2)';
          c.shadowBlur = 12;
          rr(c, bx - 56, by - 22, 112, 40, 20); c.fill();
          c.beginPath(); c.moveTo(bx - 10, by + 16); c.lineTo(bx - 18, by + 32); c.lineTo(bx + 6, by + 16); c.fill();
          c.restore();
          text(c, 'Up top!', bx, by - 2, { size: 20, weight: 600 });
        }
      },
    },

    // 3 — CATCH: get your tiny hands under the falling snack
    {
      id: 'catch', cmd: 'CATCH!', hint: { touch: 'Drag to move', key: '← → to move' }, dur: 4.8,
      failText: 'Five-second rule?',
      init(g) {
        g.rx = 480; g.walk = 0;
        g.item = { x: rand(200, 760), y: -40, vx: rand(-55, 55), rot: 0, kind: pick(['donut', 'egg', 'cupcake']) };
        g.delay = 0.45; g.state = 'fall'; g.hand = null;
        g.fall = 150 + g.lvl * 38;
        if (Math.abs(g.item.x - g.rx) < 140) g.item.x = g.rx + (g.item.x < g.rx ? -200 : 200);
      },
      update(g, dt, inp) {
        moveRex(g, dt, inp, 60 * 1.45);
        const it = g.item;
        if (g.state === 'fall') {
          if (g.delay > 0) { g.delay -= dt; return; }
          it.y += g.fall * dt;
          it.x += it.vx * dt;
          if (it.x < 60 || it.x > 900) it.vx *= -1;
          it.rot += dt * 2.4;
          if (!g.ended && g.hand) {
            const dx = it.x - g.hand.x, dy = it.y - (g.hand.y - 8);
            if (dx * dx + dy * dy < 44 * 44) {
              g.state = 'caught';
              g.won = true;
              Sound.play('catch');
              burst(it.x, it.y, 16, { shape: 'star', speed: 240, size: [5, 10] });
            }
          }
          if (g.state === 'fall' && it.y > GROUND - 14) {
            it.y = GROUND - 12;
            g.state = 'splat';
            Sound.play('splat');
            burst(it.x, it.y, 14, { colors: it.kind === 'egg' ? ['#F6C945', '#FBF4E2'] : ['#E3AE6C', '#F29BB5', '#FFF8F0'], speed: 220, size: [4, 8], shape: 'dot' });
            if (!g.ended) { g.lost = true; g.failText = it.kind === 'egg' ? 'Scrambled.' : 'Five-second rule?'; }
          }
        } else if (g.state === 'caught' && g.hand) {
          it.x = g.hand.x + 8;
          it.y = g.hand.y - 18;
          it.rot *= 0.8;
        }
      },
      draw(g, c, t) {
        const it = g.item;
        const res = g.ended ? g.result : null;
        // Landing shadow
        if (g.state === 'fall') {
          const k = clamp((it.y + 40) / (GROUND + 40), 0, 1);
          c.fillStyle = `rgba(70, 55, 30, ${0.08 + k * 0.18})`;
          ellipse(c, it.x, GROUND + 4, 10 + k * 18, 4 + k * 3); c.fill();
        }
        const near = g.state === 'fall' && it.y > 150;
        const r = drawRex(c, {
          x: g.rx, y: GROUND, s: 1.45, t,
          walk: g.walk, arm: -0.2, bend: 0.15,
          eye: res === true ? 'happy' : res === false ? 'closed' : 'wide',
          lookX: clamp((it.x - g.rx) / 200, -1, 1), lookY: -1,
          mouth: res === true ? 0.55 : near ? 0.3 : 0.1,
          sweat: res === false, smile: res === true,
        });
        g.hand = r.hand;

        if (g.state === 'splat') {
          if (it.kind === 'egg') {
            c.fillStyle = '#FBF4E2';
            ellipse(c, it.x, GROUND + 6, 30, 7); c.fill();
            c.fillStyle = '#F6C945';
            ellipse(c, it.x + 3, GROUND + 4, 10, 5); c.fill();
          } else {
            drawFood(c, it.kind, it.x, GROUND - 6, 1.4, 0.95);
          }
        } else {
          drawFood(c, it.kind, it.x, it.y, it.rot, 1.15);
        }
      },
    },

    // 4 — SELFIE: snap when the wobbling selfie stick frames your face
    {
      id: 'selfie', cmd: 'SELFIE!', hint: { touch: 'Tap when your face is framed', key: 'SPACE when your face is framed' }, dur: 4.6,
      failText: 'No photo?',
      init(g) {
        g.ph = rand(0, TAU); g.w = 2.1 + g.lvl * 0.6; g.amp = 230;
        g.shot = false; g.good = false; g.fx = 480; g.fy = 196; g.face = { x: 530, y: 190 }; g.snapT = 0; g.hand = null;
      },
      update(g, dt, inp) {
        if (!g.shot) {
          g.fx = 500 + g.amp * Math.sin(g.ph + g.w * g.time);
          g.fy = 194 + Math.sin(g.time * g.w * 1.7) * 12;
        } else g.snapT += dt;
        if (g.ended) return;
        if (inp.pressed && !g.shot) {
          g.shot = true;
          S.flash = 0.9;
          Sound.play('shutter');
          const dx = g.fx - g.face.x;
          g.snapDx = dx;
          g.good = Math.abs(dx) < 48;
          if (g.good) { g.won = true; burst(g.face.x, g.face.y - 60, 14, { shape: 'star', speed: 220, size: [6, 10] }); }
          else { g.lost = true; g.failText = Math.abs(dx) > 150 ? 'Lovely photo of… the sky.' : 'Half a face.'; }
        }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        const pose = (cc) => drawRex(cc, {
          x: 420, y: GROUND, s: 1.7, t,
          arm: -0.95, bend: -0.3,
          eye: g.shot ? (g.good ? 'happy' : 'wide') : 'open',
          lookX: 0.6, smile: true, mouth: g.shot && g.good ? 0.35 : 0,
          headTilt: g.shot && g.good ? -0.06 : 0,
        });
        const r = pose(c);
        g.face = r.face;
        g.hand = r.hand;

        if (!g.shot) {
          // Selfie stick
          c.strokeStyle = '#8B949A';
          c.lineWidth = 5;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(r.hand.x, r.hand.y);
          c.lineTo(g.fx, g.fy + 75);
          c.stroke();
          c.fillStyle = '#2F3A40';
          rr(c, g.fx - 16, g.fy + 66, 32, 18, 5); c.fill();

          // Viewfinder
          const fw = 210, fh = 150, x0 = g.fx - fw / 2, y0 = g.fy - fh / 2;
          const inZone = Math.abs(g.fx - g.face.x) < 48;
          c.fillStyle = inZone ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.22)';
          rr(c, x0, y0, fw, fh, 14); c.fill();
          c.strokeStyle = inZone ? '#E07A5F' : 'rgba(38, 48, 42, 0.7)';
          c.lineWidth = 5;
          const L = 26;
          c.beginPath();
          c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0);
          c.moveTo(x0 + fw - L, y0); c.lineTo(x0 + fw, y0); c.lineTo(x0 + fw, y0 + L);
          c.moveTo(x0 + fw, y0 + fh - L); c.lineTo(x0 + fw, y0 + fh); c.lineTo(x0 + fw - L, y0 + fh);
          c.moveTo(x0 + L, y0 + fh); c.lineTo(x0, y0 + fh); c.lineTo(x0, y0 + fh - L);
          c.stroke();
          c.strokeStyle = 'rgba(38, 48, 42, 0.12)';
          c.lineWidth = 2;
          c.strokeRect(x0, y0, fw, fh);
          c.fillStyle = '#E25C4A';
          circle(c, x0 + 20, y0 + 20, 5 + Math.sin(t * 8) * 1); c.fill();
          // Centre cross
          c.strokeStyle = inZone ? '#E07A5F' : 'rgba(38, 48, 42, 0.55)';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(g.fx - 10, g.fy); c.lineTo(g.fx + 10, g.fy);
          c.moveTo(g.fx, g.fy - 10); c.lineTo(g.fx, g.fy + 10);
          c.stroke();
        } else {
          // Polaroid
          const k = easeOutBack(clamp(g.snapT / 0.45, 0, 1));
          const px = 790, py = lerp(-200, 200, k);
          c.save();
          c.translate(px, py);
          c.rotate(0.07);
          c.shadowColor = 'rgba(70, 55, 30, 0.3)';
          c.shadowBlur = 20;
          c.shadowOffsetY = 8;
          c.fillStyle = '#FFFFFF';
          rr(c, -110, -100, 220, 220, 6); c.fill();
          c.shadowColor = 'transparent';
          c.save();
          c.beginPath(); c.rect(-96, -86, 192, 150); c.clip();
          c.translate(-g.fx, -g.fy - 11);
          drawWorld(c, t);
          pose(c);
          c.restore();
          text(c, g.good ? '#nofilter' : '#oops', 0, 92, { size: 22, weight: 600, color: g.good ? '#467F45' : '#B9573C' });
          c.restore();
        }
        if (res === false && !g.shot) text(c, '?', g.face.x + 40, g.face.y - 60, { size: 48, color: '#E07A5F' });
      },
    },

    // 5 — DODGE: meteors! survive until the timer runs out
    {
      id: 'dodge', cmd: 'DODGE!', hint: { touch: 'Drag to move', key: '← → to move' }, dur: 4.2, survive: true,
      failText: 'Flattened!',
      init(g) {
        g.rx = 480; g.walk = 0; g.dir = 1; g.ms = []; g.hit = false; g.squash = 1;
        const n = 3 + Math.min(2, g.lvl);
        g.queue = [];
        for (let i = 0; i < n; i++) g.queue.push(0.2 + i * (2.7 / n));
      },
      update(g, dt, inp) {
        if (!g.hit) moveRex(g, dt, inp, 0, 560);
        while (g.queue.length && g.time >= g.queue[0]) {
          g.queue.shift();
          const tx = clamp(g.rx + rand(-40, 40), 100, 860);
          g.ms.push({ tx, t: 0, warn: 0.78 - g.lvl * 0.08, fall: 0.3, landed: false, spin: rand(0, TAU) });
          Sound.play('warn');
        }
        for (const m of g.ms) {
          m.t += dt;
          if (!m.landed && m.t >= m.warn + m.fall) {
            m.landed = true;
            Sound.play('boom');
            S.shake = reduceMotion ? 0 : 11;
            dust(m.tx, GROUND - 6, 12);
            burst(m.tx, GROUND - 10, 10, { colors: ['#8B6A4E', '#B68B62'], speed: 260, size: [4, 8], shape: 'dot' });
            if (!g.ended && !g.hit && Math.abs(m.tx - g.rx) < 62) {
              g.hit = true;
              g.lost = true;
            }
          }
        }
        if (g.hit) g.squash = lerp(g.squash, 0.42, clamp(dt * 16, 0, 1));
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        // Craters & warnings (behind the rex)
        for (const m of g.ms) {
          if (m.landed) {
            c.fillStyle = 'rgba(120, 90, 60, 0.35)';
            ellipse(c, m.tx, GROUND + 5, 54, 9); c.fill();
          } else {
            const k = clamp(m.t / m.warn, 0, 1);
            c.fillStyle = `rgba(185, 87, 60, ${0.12 + k * 0.25})`;
            ellipse(c, m.tx, GROUND + 4, 20 + k * 40, 5 + k * 6); c.fill();
            c.strokeStyle = `rgba(185, 87, 60, ${0.4 + 0.4 * Math.sin(t * 30)})`;
            c.lineWidth = 3;
            ellipse(c, m.tx, GROUND + 4, 64, 13); c.stroke();
          }
        }
        drawRex(c, {
          x: g.rx, y: GROUND, s: 1.4, t, face: g.dir || 1,
          walk: g.hit ? 0 : g.walk, squash: g.squash,
          arm: g.hit ? 1.4 : -0.6 + Math.sin(t * 22) * 0.25, armFar: g.hit ? 1.5 : -0.8 - Math.sin(t * 22) * 0.25, bend: 0.2,
          eye: g.hit ? 'x' : res === true ? 'happy' : 'wide',
          lookY: -1, mouth: g.hit ? 0.2 : res === true ? 0.5 : 0.45, brow: res == null ? 'worried' : null,
          sweat: res == null,
        });
        // Falling meteors (in front)
        for (const m of g.ms) {
          if (m.landed) {
            c.save();
            c.fillStyle = '#7A5C44';
            circle(c, m.tx + 30, GROUND - 10, 12); c.fill();
            c.restore();
            continue;
          }
          if (m.t < m.warn) continue;
          const k = (m.t - m.warn) / m.fall;
          const y = lerp(-90, GROUND - 26, k);
          const x = m.tx + (1 - k) * 60;
          const tail = c.createLinearGradient(x, y, x + 90, y - 180);
          tail.addColorStop(0, 'rgba(243, 160, 90, 0.95)');
          tail.addColorStop(1, 'rgba(243, 201, 138, 0)');
          c.fillStyle = tail;
          c.beginPath();
          c.moveTo(x - 24, y);
          c.lineTo(x + 100, y - 190);
          c.lineTo(x + 24, y);
          c.closePath();
          c.fill();
          c.save();
          c.translate(x, y);
          c.rotate(m.spin + m.t * 6);
          c.fillStyle = '#8B6A4E';
          circle(c, 0, 0, 28); c.fill();
          c.fillStyle = '#6F543E';
          circle(c, -8, -6, 7); c.fill();
          circle(c, 9, 7, 5); c.fill();
          c.restore();
        }
      },
    },

    // 6 — BLOW: hold to breathe in, release in the green zone
    {
      id: 'candles', cmd: 'BLOW!', hint: { touch: 'Hold… release in the green', key: 'Hold SPACE… release in the green' }, dur: 5,
      failText: 'Candles 1, T-rex 0.',
      init(g) {
        g.air = 0; g.state = 'idle'; g.n = 3 + Math.min(3, g.lvl);
        g.blowT = 0; g.zone = [0.64, 0.86]; g.rate = 0.78 + g.lvl * 0.16; g.weak = 0; g.inT = 0; g.mouth = null;
      },
      update(g, dt, inp) {
        g.weak = Math.max(0, g.weak - dt * 2.2);
        if (g.state === 'blow') { g.blowT += dt; g.air = Math.max(0, g.air - dt * 2.4); }
        if (g.state === 'cough') g.air = Math.max(0, g.air - dt * 2);
        if (g.ended) return;
        if (g.state === 'idle' && inp.down) g.state = 'inhale';
        if (g.state === 'inhale') {
          if (inp.down) {
            g.air += g.rate * dt;
            g.inT += dt;
            if (g.inT > 0.16) { g.inT = 0; Sound.play('inhale'); }
            if (g.air > 1) {
              g.state = 'cough';
              g.lost = true;
              g.failText = 'Too much air!';
              Sound.play('cough');
              S.shake = reduceMotion ? 0 : 6;
            }
          } else if (g.air >= g.zone[0] && g.air <= g.zone[1]) {
            g.state = 'blow';
            g.won = true;
            Sound.play('puff');
          } else {
            g.state = 'idle';
            g.weak = 1;
            g.air = 0;
            Sound.play('boop');
          }
        }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        // Table + cake
        const tx = 690, top = GROUND - 120;
        c.fillStyle = '#C9A37A';
        rr(c, tx - 150, top, 300, 16, 6); c.fill();
        c.fillStyle = '#B38D64';
        c.fillRect(tx - 130, top + 16, 14, GROUND - top - 16);
        c.fillRect(tx + 116, top + 16, 14, GROUND - top - 16);
        c.fillStyle = '#FFFFFF';
        ellipse(c, tx, top, 120, 10); c.fill();
        c.fillStyle = '#F29BB5';
        rr(c, tx - 100, top - 70, 200, 70, 14); c.fill();
        c.fillStyle = '#FFF8F0';
        rr(c, tx - 100, top - 76, 200, 22, 11); c.fill();
        for (let i = 0; i < 6; i++) { circle(c, tx - 85 + i * 34, top - 52, 7); c.fill(); }
        c.fillStyle = '#D9534F';
        for (let i = 0; i < 5; i++) { circle(c, tx - 70 + i * 35, top - 80, 6); c.fill(); }

        // Candles
        const gap = 160 / (g.n - 1 || 1);
        for (let i = 0; i < g.n; i++) {
          const cx = tx - 80 + i * gap, cy = top - 78;
          c.fillStyle = i % 2 ? '#76A3D4' : '#F3C98A';
          rr(c, cx - 5, cy - 44, 10, 44, 3); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2;
          for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(cx - 5, cy - 38 + k * 13); c.lineTo(cx + 5, cy - 44 + k * 13); c.stroke(); }
          const out = g.state === 'blow' && g.blowT > 0.08 + i * 0.07;
          if (!out) {
            const lean = (g.state === 'blow' ? 1 : g.weak) * 0.9;
            const fl = Math.sin(t * 18 + i * 2) * 0.12;
            c.save();
            c.translate(cx, cy - 48);
            c.rotate(lean + fl);
            c.fillStyle = 'rgba(243, 201, 138, 0.35)';
            circle(c, 0, -10, 16); c.fill();
            c.fillStyle = '#F3A65A';
            c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(10, -6, 0, 2); c.quadraticCurveTo(-10, -6, 0, -26); c.fill();
            c.fillStyle = '#FFE7A8';
            c.beginPath(); c.moveTo(0, -16); c.quadraticCurveTo(5, -4, 0, 0); c.quadraticCurveTo(-5, -4, 0, -16); c.fill();
            c.restore();
          } else {
            const k = clamp((g.blowT - 0.08 - i * 0.07) / 1.2, 0, 1);
            c.fillStyle = `rgba(190, 185, 175, ${0.6 * (1 - k)})`;
            circle(c, cx + Math.sin(k * 8) * 6 + k * 14, cy - 54 - k * 70, 6 + k * 12); c.fill();
          }
        }

        const danger = g.air > g.zone[1];
        const r = drawRex(c, {
          x: 300, y: GROUND, s: 1.7, t,
          arm: 0.6, bend: 0.9,
          puff: g.state === 'inhale' ? g.air : 0,
          eye: res === true ? 'happy' : g.state === 'cough' ? 'x' : g.state === 'inhale' ? (danger ? 'wide' : 'squint') : 'open',
          mouth: g.state === 'blow' ? 0.22 : g.state === 'cough' ? 0.6 : 0,
          smile: res === true && g.blowT > 0.6, sweat: danger || g.state === 'cough',
          brow: g.state === 'inhale' ? 'focus' : null,
          squash: 1 + (g.state === 'inhale' ? g.air * 0.04 : 0),
        });
        g.mouth = r.mouth;

        // Wind
        if (g.state === 'blow' && g.blowT < 1) {
          c.save();
          c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          c.lineWidth = 5;
          c.lineCap = 'round';
          c.setLineDash([22, 18]);
          c.lineDashOffset = -g.blowT * 300;
          for (let i = -1; i <= 1; i++) {
            c.beginPath();
            c.moveTo(r.mouth.x + 10, r.mouth.y + i * 10);
            c.quadraticCurveTo(520, r.mouth.y + i * 30 + 20, tx - 80, top - 120 + i * 18);
            c.stroke();
          }
          c.restore();
        }
        if (g.weak > 0) {
          text(c, 'pff…', r.mouth.x + 40, r.mouth.y - 10, { size: 28, weight: 600, color: 'rgba(38, 48, 42, 0.6)', alpha: g.weak });
        }

        // Air meter
        const mx = 96, my = 140, mh = 250, mw = 30;
        c.fillStyle = 'rgba(255, 252, 246, 0.97)';
        rr(c, mx - 8, my - 8, mw + 16, mh + 16, 16); c.fill();
        c.fillStyle = 'rgba(38, 48, 42, 0.08)';
        rr(c, mx, my, mw, mh, 10); c.fill();
        c.fillStyle = 'rgba(121, 171, 98, 0.35)';
        c.fillRect(mx, my + mh * (1 - g.zone[1]), mw, mh * (g.zone[1] - g.zone[0]));
        const fillH = mh * clamp(g.air, 0, 1);
        c.fillStyle = danger ? '#E07A5F' : g.air >= g.zone[0] ? '#5E9C5B' : '#9BBF8A';
        rr(c, mx, my + mh - fillH, mw, Math.max(0.1, fillH), 10); c.fill();
        c.strokeStyle = '#467F45';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(mx - 6, my + mh * (1 - g.zone[1])); c.lineTo(mx + mw + 6, my + mh * (1 - g.zone[1]));
        c.moveTo(mx - 6, my + mh * (1 - g.zone[0])); c.lineTo(mx + mw + 6, my + mh * (1 - g.zone[0]));
        c.stroke();
        text(c, 'AIR', mx + mw / 2, my + mh + 28, { size: 16, weight: 600, color: 'rgba(38, 48, 42, 0.55)' });
      },
    },

    // 7 — JUMP: a boulder rolls in. Hop over it.
    {
      id: 'jump', cmd: 'JUMP!', hint: { touch: 'Tap to jump', key: 'SPACE to jump' }, dur: 4.4, survive: true,
      failText: 'Bonk!',
      init(g) {
        g.rx = 290; g.jy = 0; g.vy = 0; g.v = 330 + g.lvl * 45; g.hit = false; g.walk = 0; g.squash = 1;
        g.rocks = [{ x: 1060, r: 38, rot: 0 }];
        if (g.lvl >= 1) g.rocks.push({ x: 1060 + rand(430, 560), r: 30, rot: 0 });
      },
      update(g, dt, inp) {
        if (!g.hit) g.walk += dt * 16;
        if (!g.hit && !g.ended && inp.pressed && g.jy === 0 && g.vy === 0) {
          g.vy = -790;
          Sound.play('boing');
          dust(g.rx, GROUND - 4, 5);
        }
        if (g.jy < 0 || g.vy < 0) {
          g.vy += 2200 * dt;
          g.jy += g.vy * dt;
          if (g.jy >= 0) { g.jy = 0; g.vy = 0; g.squash = 0.86; dust(g.rx, GROUND - 4, 4); }
        }
        g.squash = lerp(g.squash, g.hit ? 0.55 : 1, clamp(dt * 10, 0, 1));
        for (const r of g.rocks) {
          r.x -= g.v * dt;
          r.rot -= (g.v / r.r) * dt;
          if (!g.hit && !g.ended && Math.abs(r.x - g.rx) < r.r + 32 && -g.jy < r.r * 1.5) {
            g.hit = true;
            g.lost = true;
            Sound.play('bonk');
            S.shake = reduceMotion ? 0 : 9;
            burst(g.rx + 20, GROUND - 150, 10, { shape: 'star', colors: ['#F3C98A', '#FFFFFF'], speed: 200, size: [6, 10] });
          }
        }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        c.strokeStyle = 'rgba(120, 100, 70, 0.22)';
        c.lineWidth = 4;
        c.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
          const x = ((((i * 137 - g.time * g.v) % 1120) + 1120) % 1120) - 80;
          const y = GROUND + 22 + (i % 3) * 22;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + 36, y); c.stroke();
        }
        const air = g.jy < 0;
        drawRex(c, {
          x: g.rx, y: GROUND + g.jy, groundY: GROUND, s: 1.35, t,
          walk: air || g.hit ? 0 : g.walk, squash: g.squash,
          arm: air ? -1.3 : -0.2 + Math.sin(g.walk) * 0.4, armFar: air ? -1.1 : -0.2 - Math.sin(g.walk) * 0.4, bend: 0.3,
          eye: g.hit ? 'x' : res === true ? 'happy' : air ? 'wide' : 'open',
          mouth: g.hit ? 0.3 : air ? 0.45 : res === true ? 0.4 : 0.1, lookX: 1, smile: true,
        });
        for (const r of g.rocks) {
          if (r.x < -80 || r.x > W + 80) continue;
          c.fillStyle = 'rgba(40, 35, 25, 0.15)';
          ellipse(c, r.x, GROUND + 3, r.r * 1.1, 7); c.fill();
          drawBoulder(c, r.x, GROUND - r.r, r.r, r.rot);
        }
      },
    },

    // 8 — BALANCE: stay on top of a beach ball in a gusty wind
    {
      id: 'balance', cmd: 'BALANCE!', hint: { touch: 'Drag left / right to lean', key: '← → to lean' }, dur: 4.5, survive: true,
      failText: 'Timber!',
      init(g) {
        g.th = rand(0.06, 0.12) * (Math.random() < 0.5 ? -1 : 1);
        g.om = 0; g.gust = 0; g.gt = 0; g.ballRot = 0; g.fallen = false; g.fallT = 0;
      },
      update(g, dt, inp) {
        if (g.ended && g.result) { g.om *= 0.85; g.th *= 0.92; return; }
        let u = 0;
        if (!g.ended) {
          if (inp.left || inp.right) u = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
          else if (inp.pointer && inp.px != null) u = clamp((inp.px - 480) / 200, -1, 1);
        }
        g.gt -= dt;
        if (g.gt <= 0) { g.gt = rand(0.5, 0.9); g.gust = rand(-1, 1) * (0.7 + g.lvl * 0.35); }
        if (!g.fallen) {
          g.om += (2.4 * Math.sin(g.th) + g.gust + u * 3.8) * dt;
          g.om *= Math.pow(0.35, dt);
          g.th += g.om * dt;
          g.ballRot -= g.om * dt * 1.6;
          if (Math.abs(g.th) > 0.62) {
            g.fallen = true;
            if (!g.ended) g.lost = true;
            Sound.play('whoosh');
          }
        } else {
          g.fallT += dt;
          g.th = lerp(g.th, Math.sign(g.th) * 1.45, clamp(dt * 6, 0, 1));
          if (g.fallT > 0.25 && !g.thud) { g.thud = true; Sound.play('bonk'); S.shake = reduceMotion ? 0 : 6; dust(480 + Math.sign(g.th) * 120, GROUND - 4, 10); }
        }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        const bx = 480, br = 64, by = GROUND - br;
        c.fillStyle = 'rgba(40, 35, 25, 0.15)';
        ellipse(c, bx, GROUND + 3, 70, 9); c.fill();
        drawBeachBall(c, bx, by, br, g.ballRot);

        const k = easeOutCubic(clamp(g.fallT * 4, 0, 1));
        const pivX = bx + Math.sign(g.th) * 110 * k;
        const pivY = lerp(by - br + 4, GROUND - 26, k);
        const scary = Math.abs(g.th) > 0.32;
        c.save();
        c.translate(pivX, pivY);
        c.rotate(g.th);
        drawRex(c, {
          x: 0, y: 0, s: 1.25, t, shadow: false,
          arm: -1.2 + Math.sin(t * 16) * 0.5, armFar: -0.6 - Math.sin(t * 16) * 0.5, bend: 0.2,
          eye: g.fallen ? 'x' : res === true ? 'happy' : scary ? 'wide' : 'open',
          brow: scary && !g.fallen ? 'worried' : null,
          mouth: scary || g.fallen ? 0.45 : res === true ? 0.4 : 0, smile: !scary,
          sweat: scary && !g.fallen, lookX: -Math.sign(g.th),
        });
        c.restore();

        if (!g.ended) {
          const mx = 480, my = GROUND + 46, mw = 280;
          c.fillStyle = 'rgba(255, 252, 246, 0.92)';
          rr(c, mx - mw / 2 - 8, my - 13, mw + 16, 26, 13); c.fill();
          c.fillStyle = 'rgba(224, 122, 95, 0.35)';
          rr(c, mx - mw / 2, my - 5, mw, 10, 5); c.fill();
          c.fillStyle = 'rgba(94, 156, 91, 0.6)';
          rr(c, mx - mw * 0.25, my - 5, mw * 0.5, 10, 5); c.fill();
          const nx = mx + clamp(g.th / 0.62, -1, 1) * (mw / 2);
          c.fillStyle = INK;
          circle(c, nx, my, 8); c.fill();
          c.fillStyle = '#FFFFFF';
          circle(c, nx, my, 3); c.fill();
        }
      },
    },

    // 9 — DROP: the pterodactyl delivers. You aim. Into the nest!
    {
      id: 'nest', cmd: 'DROP!', hint: { touch: 'Tap to drop the egg', key: 'SPACE to drop the egg' }, dur: 4.8,
      failText: 'Still holding the egg…',
      init(g) {
        g.ph = rand(0, TAU); g.w = 1.6 + g.lvl * 0.45; g.amp = 300;
        g.px = 500 + g.amp * Math.sin(g.ph); g.py = 118; g.pvx = 0; g.flap = 0;
        g.egg = null; g.landed = false;
        g.nx = rand(430, 780);
        g.nv = g.lvl >= 1 ? (Math.random() < 0.5 ? -1 : 1) * (50 + g.lvl * 28) : 0;
      },
      update(g, dt, inp) {
        g.flap += dt * 12;
        const nx = 500 + g.amp * Math.sin(g.ph + g.w * g.time);
        if (dt > 0) g.pvx = (nx - g.px) / dt;
        g.px = nx;
        g.py = 118 + Math.sin(g.time * 4) * 8;
        if (g.nv) { g.nx += g.nv * dt; if (g.nx < 400 || g.nx > 820) { g.nv *= -1; g.nx = clamp(g.nx, 400, 820); } }
        if (!g.egg && !g.ended && inp.pressed) {
          g.egg = { x: g.px + 16, y: g.py + 46, vx: g.pvx * 0.3, vy: 0, rot: 0 };
          Sound.play('whoosh');
        }
        const e = g.egg;
        if (e && !g.landed) {
          e.vy += 1100 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.rot += e.vx * 0.004;
          if (e.y >= GROUND - 32) {
            g.landed = true;
            if (Math.abs(e.x - g.nx) < 48) {
              e.inNest = true;
              e.y = GROUND - 32;
              e.rot = 0;
              Sound.play('catch');
              burst(g.nx, GROUND - 60, 14, { shape: 'star', speed: 220, size: [6, 10] });
              if (!g.ended) g.won = true;
            } else {
              e.splat = true;
              Sound.play('splat');
              burst(e.x, GROUND - 10, 12, { colors: ['#F6C945', '#FBF4E2'], speed: 200, size: [4, 8], shape: 'dot' });
              if (!g.ended) { g.lost = true; g.failText = 'Omelette.'; }
            }
          }
        }
        if (e && e.inNest) e.x = g.nx;
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        drawRex(c, {
          x: 170, y: GROUND, s: 1.5, t,
          arm: -1.1 + Math.sin(t * 10) * 0.2, armFar: -0.9, bend: -0.2,
          eye: res === true ? 'happy' : res === false ? 'closed' : 'wide',
          lookX: clamp((g.px - 300) / 300, -1, 1), lookY: -1,
          mouth: res === true ? 0.5 : 0.15, smile: res !== false, sweat: res === false,
        });
        drawNest(c, g.nx, GROUND - 12);
        const e = g.egg;
        if (e && e.inNest) drawFood(c, 'egg', g.nx, GROUND - 32, 0, 1);
        drawPtero(c, { x: g.px, y: g.py, s: 1.1, flap: g.flap, happy: res === true, flip: g.pvx > 0 });
        if (!e) {
          if (g.lvl === 0 && !g.ended) {
            c.save();
            c.setLineDash([4, 10]);
            c.strokeStyle = 'rgba(38, 48, 42, 0.18)';
            c.lineWidth = 2;
            c.beginPath(); c.moveTo(g.px + 16, g.py + 70); c.lineTo(g.px + 16 + g.pvx * 0.3 * 0.7, GROUND - 30); c.stroke();
            c.restore();
          }
          drawFood(c, 'egg', g.px + 16, g.py + 46, Math.sin(t * 6) * 0.15, 0.95);
        } else if (e.splat) {
          c.fillStyle = '#FBF4E2';
          ellipse(c, e.x, GROUND + 6, 30, 7); c.fill();
          c.fillStyle = '#F6C945';
          ellipse(c, e.x + 3, GROUND + 4, 10, 5); c.fill();
        } else if (!e.inNest) {
          drawFood(c, 'egg', e.x, e.y, e.rot, 1);
        }
      },
    },

    // 10 — BRUSH: arms can't reach the mouth, so the toothbrush is on a stick
    {
      id: 'brush', cmd: 'BRUSH!', hint: { touch: 'Drag left-right fast!', key: 'Alternate ← → fast!' }, dur: 4.6,
      failText: 'Dragon breath.',
      init(g) {
        g.cx = 0; g.prev = null; g.clean = 0; g.need = 1700 + g.lvl * 450; g.sc = 0;
        g.spots = Array.from({ length: 8 }, () => ({ x: rand(-92, 92), y: rand(-6, 30), r: rand(6, 11), k: Math.random() }));
      },
      update(g, dt, inp) {
        if (g.ended) return;
        if (inp.left || inp.right) {
          g.cx += ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 1200 * dt;
          g.cx = clamp(g.cx, -110, 110);
        } else if (inp.pointer && inp.px != null) {
          g.cx = clamp((inp.px - 480) * 0.8, -110, 110);
        }
        if (g.prev != null) {
          const d = Math.abs(g.cx - g.prev);
          g.clean += d;
          g.sc += d;
          if (g.sc > 140) { g.sc = 0; Sound.play('scrub'); }
        }
        g.prev = g.cx;
        if (g.clean >= g.need) {
          g.won = true;
          burst(705, 230, 18, { shape: 'star', colors: ['#FFFFFF', '#F3C98A', '#76A3D4'], speed: 260, size: [6, 11] });
        }
      },
      draw(g, c, t) {
        const p = clamp(g.clean / g.need, 0, 1);
        const res = g.ended ? g.result : null;
        const r = drawRex(c, {
          x: 270, y: GROUND, s: 1.7, t,
          mouth: res === true ? 0.35 : 0.5, arm: -0.55, bend: -0.1,
          eye: res === true ? 'happy' : res === false ? 'closed' : 'squint',
          brow: res == null ? 'focus' : null, sweat: res === false, smile: res === true,
        });
        // The stick
        const bx0 = r.mouth.x - 34 + g.cx * 0.14, by0 = r.mouth.y + 14;
        c.strokeStyle = '#C9A37A';
        c.lineWidth = 6;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(r.hand.x, r.hand.y); c.lineTo(bx0 + 18, by0 + 34); c.lineTo(bx0, by0 + 6); c.stroke();
        c.fillStyle = '#76A3D4';
        rr(c, bx0 - 14, by0 - 2, 28, 10, 4); c.fill();
        c.fillStyle = '#FFFFFF';
        rr(c, bx0 - 12, by0 - 10, 24, 9, 3); c.fill();
        c.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let i = 0; i < Math.floor(p * 7); i++) { circle(c, r.mouth.x - 50 + ((i * 23) % 60), r.mouth.y + 18 + ((i * 7) % 12), 4 + (i % 3) * 2); c.fill(); }

        // Zoom bubble on the teeth
        const zx = 705, zy = 230, zr = 118;
        c.save();
        c.fillStyle = 'rgba(255, 252, 246, 0.9)';
        c.shadowColor = 'rgba(70, 55, 30, 0.25)';
        c.shadowBlur = 24;
        c.shadowOffsetY = 8;
        circle(c, zx, zy, zr); c.fill();
        c.restore();
        c.save();
        circle(c, zx, zy, zr - 6); c.clip();
        c.fillStyle = '#8A3B35';
        c.fillRect(zx - zr, zy - zr, zr * 2, zr * 2);
        c.fillStyle = '#E58C8A';
        rr(c, zx - 130, zy - 70, 260, 50, 20); c.fill();
        for (let i = 0; i < 5; i++) {
          const tx = zx - 100 + i * 40;
          c.fillStyle = '#FFFDF7';
          rr(c, tx, zy - 30, 36, 62, 12); c.fill();
        }
        for (const sp of g.spots) {
          const a = clamp((1 - p) * 1.5 - sp.k * 0.5, 0, 1);
          if (a <= 0) continue;
          c.fillStyle = `rgba(190, 160, 90, ${a})`;
          circle(c, zx + sp.x, zy + sp.y, sp.r); c.fill();
        }
        const hx = zx + g.cx * 0.85;
        c.fillStyle = '#76A3D4';
        rr(c, hx - 30, zy + 40, 60, 16, 6); c.fill();
        rr(c, hx + 20, zy + 44, 90, 10, 5); c.fill();
        c.fillStyle = '#FFFFFF';
        rr(c, hx - 28, zy + 22, 56, 20, 4); c.fill();
        c.strokeStyle = 'rgba(118, 163, 212, 0.4)';
        c.lineWidth = 2;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(hx - 24 + i * 9.5, zy + 24); c.lineTo(hx - 24 + i * 9.5, zy + 40); c.stroke(); }
        c.fillStyle = 'rgba(255, 255, 255, 0.85)';
        for (let i = 0; i < Math.floor(p * 9); i++) { circle(c, hx - 40 + ((i * 37) % 80), zy + 12 - ((i * 13) % 26), 5 + (i % 3) * 2); c.fill(); }
        if (res === true) {
          c.fillStyle = '#FFFFFF';
          for (const [sx, sy, sr] of [[-60, -10, 12], [20, 0, 9], [70, -16, 11]]) { star(c, zx + sx, zy + sy, sr + Math.sin(t * 10) * 2, 4, 0.35); c.fill(); }
        }
        c.restore();
        text(c, 'ZOOM ×20', zx, zy - zr + 26, { size: 15, weight: 600, color: 'rgba(255, 255, 255, 0.75)' });
        c.fillStyle = 'rgba(38, 48, 42, 0.1)';
        rr(c, zx - 100, zy + zr + 22, 200, 14, 7); c.fill();
        c.fillStyle = res === false ? '#E07A5F' : '#79AB62';
        rr(c, zx - 100, zy + zr + 22, Math.max(14, 200 * p), 14, 7); c.fill();
      },
    },

    // 11 — STOMP: pop the party balloons (hands are useless here, feet are not)
    {
      id: 'stomp', cmd: 'STOMP!', hint: { touch: 'Drag to move, tap to stomp', key: '← → move, SPACE stomp' }, dur: 5,
      failText: 'Party pooper.',
      init(g) {
        g.rx = 260; g.walk = 0; g.dir = 1; g.jy = 0; g.vy = 0;
        const n = 2 + (g.lvl >= 2 ? 1 : 0);
        const cols = ['#E07A5F', '#76A3D4', '#F3C98A', '#F29BB5'];
        g.balloons = Array.from({ length: n }, (_, i) => ({
          x: 520 + i * 150 + rand(-30, 30),
          vx: rand(40, 90) * (Math.random() < 0.5 ? -1 : 1) * (1 + g.lvl * 0.3),
          bob: rand(0, TAU), col: cols[i % cols.length], popped: false,
        }));
      },
      update(g, dt, inp) {
        moveRex(g, dt, inp, 0, 520);
        if (!g.ended && inp.pressed && g.jy === 0 && g.vy === 0) { g.vy = -540; Sound.play('boing'); }
        if (g.vy !== 0 || g.jy < 0) {
          g.vy += 2400 * dt;
          g.jy += g.vy * dt;
          if (g.jy >= 0) {
            g.jy = 0; g.vy = 0;
            dust(g.rx, GROUND - 4, 5);
            const foot = g.rx + (g.dir || 1) * 26;
            for (const b of g.balloons) {
              if (!b.popped && Math.abs(b.x - foot) < 62) {
                b.popped = true;
                Sound.play('pop');
                S.shake = reduceMotion ? 0 : 4;
                burst(b.x, GROUND - 34, 16, { colors: [b.col, '#FFFFFF'], speed: 300 });
              }
            }
            if (!g.ended && g.balloons.every((b) => b.popped)) g.won = true;
          }
        }
        for (const b of g.balloons) {
          if (b.popped) continue;
          b.x += b.vx * dt;
          if (b.x < 110 || b.x > 880) { b.vx *= -1; b.x = clamp(b.x, 110, 880); }
          b.bob += dt * 5;
        }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        for (const b of g.balloons) {
          if (b.popped) {
            c.fillStyle = b.col;
            rr(c, b.x - 14, GROUND - 4, 10, 4, 2); c.fill();
            rr(c, b.x + 4, GROUND - 3, 12, 4, 2); c.fill();
          } else {
            drawBalloon(c, b.x, GROUND - 38 - Math.abs(Math.sin(b.bob)) * 12, b.col);
          }
        }
        const foot = g.rx + (g.dir || 1) * 26;
        if (!g.ended) {
          c.save();
          c.setLineDash([5, 6]);
          c.strokeStyle = 'rgba(224, 122, 95, 0.6)';
          c.lineWidth = 2.5;
          ellipse(c, foot, GROUND + 6, 40, 8); c.stroke();
          c.restore();
        }
        const air = g.jy < 0;
        drawRex(c, {
          x: g.rx, y: GROUND + g.jy, groundY: GROUND, s: 1.35, t, face: g.dir || 1,
          walk: air ? 0 : g.walk, squash: air ? 1.04 : 1,
          arm: air ? -1.2 : 0.5, armFar: air ? -1 : 0.7, bend: 0.3,
          eye: res === true ? 'happy' : res === false ? 'closed' : air ? 'wide' : 'open',
          lookY: 1, mouth: air ? 0.45 : 0, smile: res !== false, sweat: res === false,
        });
      },
    },

    // 12 — ROAR: scare off the egg thief… but not your baby nephew
    {
      id: 'roar', cmd: 'ROAR!', hint: { touch: 'Tap only at the egg thief!', key: 'SPACE only at the egg thief!' }, dur: 5.2,
      failText: 'Egg stolen!',
      init(g) {
        const babies = (Math.random() < 0.35 ? 0 : 1) + (g.lvl >= 2 && Math.random() < 0.5 ? 1 : 0);
        const seq = [];
        for (let i = 0; i < babies; i++) seq.push('baby');
        seq.push('thief');
        const win = Math.max(0.55, 0.85 - g.lvl * 0.1);
        g.pops = [];
        let t0 = 0.45, last = -1;
        for (const kind of seq) {
          let bush = (Math.random() * 3) | 0;
          if (bush === last) bush = (bush + 1) % 3;
          last = bush;
          g.pops.push({ kind, bush, t0, t1: t0 + win + 0.3 });
          t0 += win + 0.3 + rand(0.15, 0.35);
        }
        g.roarT = -1; g.cur = null;
      },
      update(g, dt, inp) {
        if (g.roarT >= 0) g.roarT += dt;
        g.cur = g.pops.find((p) => g.time >= p.t0 && g.time <= p.t1 && !p.scared) || null;
        if (g.ended) return;
        if (inp.pressed && g.roarT < 0) {
          g.roarT = 0;
          Sound.play('roar2');
          S.shake = reduceMotion ? 0 : 6;
          const c = g.cur;
          if (c && c.kind === 'thief') {
            c.scared = true; c.scareT = g.time;
            g.won = true;
          } else if (c && c.kind === 'baby') {
            c.cry = true;
            g.lost = true; g.failText = 'That was your nephew!';
          } else {
            g.lost = true; g.failText = 'Roaring at bushes?';
          }
          return;
        }
        const th = g.pops[g.pops.length - 1];
        if (g.time > th.t1 && !th.scared) { th.escaped = true; g.lost = true; g.failText = 'Egg stolen!'; }
      },
      draw(g, c, t) {
        const res = g.ended ? g.result : null;
        const bushes = [560, 710, 860];
        const roaring = g.roarT >= 0 && g.roarT < 0.8;
        const r = drawRex(c, {
          x: 230, y: GROUND, s: 1.6, t,
          arm: roaring ? -0.9 : 0.7, armFar: roaring ? -0.7 : 0.85, bend: roaring ? -0.4 : 0.7,
          mouth: roaring ? 1 : 0, eye: roaring ? 'squint' : res === false ? 'closed' : res === true ? 'happy' : 'open',
          brow: roaring ? 'focus' : null, lookX: 1, smile: !roaring && res !== false,
          headTilt: roaring ? -0.12 : 0, sweat: res === false && !roaring,
        });

        // Creatures (behind the bushes)
        for (const p of g.pops) {
          const bx = bushes[p.bush];
          if (p.scared) {
            const dt2 = g.time - p.scareT;
            drawFood(c, 'egg', bx - 10, GROUND - 22, 0.2, 1);
            drawThief(c, bx + dt2 * 560, GROUND - 100 - Math.sin(Math.min(dt2 * 4, Math.PI)) * 90, { scared: true });
            continue;
          }
          if (p.escaped) {
            const dt2 = g.time - p.t1;
            drawThief(c, bx + dt2 * 380, GROUND - 44 - Math.abs(Math.sin(dt2 * 14)) * 10, { egg: true });
            continue;
          }
          if (g.time < p.t0 || g.time > p.t1) continue;
          const up = clamp(Math.min((g.time - p.t0) / 0.15, (p.t1 - g.time) / 0.15), 0, 1);
          const y = GROUND - 26 - easeOutCubic(up) * 66;
          if (p.kind === 'thief') drawThief(c, bx, y, { egg: true });
          else drawBaby(c, bx, y, { cry: p.cry });
        }

        // Bushes (in front)
        for (let i = 0; i < 3; i++) {
          const bx = bushes[i];
          const sh = roaring ? Math.sin(t * 50 + i) * 4 * (1 - g.roarT) : 0;
          c.fillStyle = theme().leaf;
          c.beginPath();
          c.arc(bx - 34 + sh, GROUND - 22, 30, 0, TAU);
          c.arc(bx + sh, GROUND - 36, 36, 0, TAU);
          c.arc(bx + 36 + sh, GROUND - 20, 28, 0, TAU);
          c.fill();
          rr(c, bx - 62 + sh, GROUND - 26, 124, 26, 10); c.fill();
          c.fillStyle = 'rgba(255, 255, 255, 0.15)';
          circle(c, bx - 6 + sh, GROUND - 50, 12); c.fill();
        }

        // Shockwave
        if (roaring) {
          c.save();
          c.lineCap = 'round';
          for (let k = 0; k < 3; k++) {
            const rad = 40 + g.roarT * 700 - k * 70;
            if (rad < 20) continue;
            c.strokeStyle = `rgba(255, 255, 255, ${clamp(0.9 - g.roarT * 1.2, 0, 1)})`;
            c.lineWidth = 7 - k * 1.5;
            c.beginPath();
            c.arc(r.mouth.x, r.mouth.y, rad, -0.45, 0.45);
            c.stroke();
          }
          c.restore();
        }
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Game state & flow
  // ---------------------------------------------------------------------------
  const MAX_LIVES = 4;
  const PLAY_PHASES = new Set(['intro', 'play', 'result', 'levelup']);
  const WIN_LINES = ['Nailed it!', 'Rawr-some!', 'Dino-mite!', 'Big win, tiny arms!', 'Jurassic!', 'Clean!'];

  const S = {
    phase: 'title', paused: false, t: 0, pt: 0,
    score: 0, lives: MAX_LIVES, speed: 1, cleared: 0, level: 1, themeIdx: 0, prevThemeIdx: 0, bonus: false,
    bestLevel: store.get('tinyarms.bestLevel', 1),
    best: store.get('tinyarms.best', 0), newBest: false,
    game: null, g: null, dur: 1, left: 1,
    bag: [], lastId: null,
    shake: 0, flash: 0, parts: [],
    resultWin: false, resultText: '',
  };

  // DOM
  const hud = $('hud');
  const hudScore = $('hud-score');
  const hudSpeed = $('hud-speed');
  const hudLives = $('hud-lives');
  const timerEl = $('timer');
  const timerFill = $('timer-fill');
  const btnPause = $('btn-pause');
  const btnSound = $('btn-sound');
  const toastEl = $('toast');
  const screens = {
    title: $('screen-title'),
    help: $('screen-help'),
    pause: $('screen-pause'),
    over: $('screen-over'),
  };

  function showScreen(name) {
    for (const k in screens) screens[k].hidden = k !== name;
    if (name) {
      const el = screens[name].querySelector('[data-autofocus]');
      if (el && !input.touch) setTimeout(() => el.focus({ preventScroll: true }), 30);
    }
  }

  function blurActive() {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  function renderLives(crackIndex = -1) {
    let html = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const lost = i >= S.lives;
      html += `<span class="egg${lost ? ' lost' : ''}${i === crackIndex ? ' crack' : ''}"></span>`;
    }
    hudLives.innerHTML = html;
    hudLives.setAttribute('aria-label', `${S.lives} lives left`);
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function updateHUD() {
    hudScore.textContent = S.score;
    hudSpeed.textContent = `Level ${S.level} · ${S.speed.toFixed(1)}×`;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function updateTitleBest() {
    $('title-best').innerHTML = S.best > 0
      ? `Personal best: <strong>${S.best}</strong> · ${rankFor(S.best)} · reached level ${S.bestLevel}`
      : 'Tip: works with mouse, touch or keyboard.';
  }

  function rankFor(n) {
    if (n >= 30) return 'Extinction-Proof';
    if (n >= 22) return 'Jurassic Legend';
    if (n >= 15) return 'Apex Clapper';
    if (n >= 9) return 'Tiny-Armed Talent';
    if (n >= 4) return 'Curious Raptor';
    return 'Fresh Hatchling';
  }

  function nextGameDef() {
    if (!S.bag.length) {
      S.bag = GAMES.slice();
      for (let i = S.bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [S.bag[i], S.bag[j]] = [S.bag[j], S.bag[i]];
      }
      if (S.bag[S.bag.length - 1].id === S.lastId) S.bag.unshift(S.bag.pop());
    }
    const def = S.bag.pop();
    S.lastId = def.id;
    return def;
  }

  function setPhase(p) { S.phase = p; S.pt = 0; }

  function startRun() {
    Sound.unlock();
    Sound.play('ui');
    blurActive();
    clearInput();
    S.score = 0;
    S.lives = MAX_LIVES;
    S.speed = 1;
    S.cleared = 0;
    S.level = 1;
    S.themeIdx = 0;
    S.prevThemeIdx = 0;
    S.bag = [];
    S.lastId = null;
    S.newBest = false;
    S.paused = false;
    S.parts.length = 0;
    showScreen(null);
    hud.hidden = false;
    btnPause.disabled = false;
    renderLives();
    updateHUD();
    beginGame();
  }

  function beginGame() {
    const def = nextGameDef();
    S.game = def;
    S.g = { lvl: Math.min(3, S.level - 1), time: 0, won: false, lost: false, ended: false, result: null };
    def.init(S.g);
    S.dur = def.dur / S.speed;
    S.left = S.dur;
    timerEl.classList.remove('low');
    setPhase('intro');
    Sound.play('whoosh');
  }

  function finish(win) {
    const g = S.g;
    if (g.ended) return;
    g.ended = true;
    g.result = win;
    S.resultWin = win;
    if (win) {
      S.score++;
      S.cleared++;
      S.resultText = pick(WIN_LINES);
      Sound.play('win');
      burst(480, 120, 34, { speed: 380, up: 100 });
      bump(hudScore.parentElement);
    } else {
      S.lives--;
      S.resultText = g.failText || S.game.failText || 'Oof.';
      Sound.play('lose');
      S.shake = Math.max(S.shake, reduceMotion ? 0 : 8);
      renderLives(S.lives);
    }
    updateHUD();
    setPhase('result');
  }

  function gameOver() {
    setPhase('over');
    hud.hidden = true;
    btnPause.disabled = true;
    S.newBest = S.score > S.best;
    if (S.newBest) { S.best = S.score; store.set('tinyarms.best', S.best); }
    if (S.level > S.bestLevel) { S.bestLevel = S.level; store.set('tinyarms.bestLevel', S.bestLevel); }
    $('over-level').textContent = `Reached level ${S.level} · ${worldName()}`;
    $('over-score').textContent = S.score;
    $('over-rank').textContent = rankFor(S.score);
    $('over-best').innerHTML = S.newBest && S.score > 0
      ? 'Personal best <span class="new-best">New record!</span>'
      : `Personal best: <strong>${S.best}</strong>`;
    $('over-h').textContent = S.score >= 15 ? 'What a run!' : 'Extinct!';
    Sound.play('roar');
    showScreen('over');
    updateTitleBest();
  }

  function goMenu() {
    S.paused = false;
    S.themeIdx = 0;
    setPhase('title');
    hud.hidden = true;
    btnPause.disabled = true;
    S.parts.length = 0;
    clearInput();
    updateTitleBest();
    showScreen('title');
  }

  function togglePause() {
    if (!PLAY_PHASES.has(S.phase)) return;
    S.paused = !S.paused;
    clearInput();
    showScreen(S.paused ? 'pause' : null);
    if (!S.paused) blurActive();
  }

  function toggleMute() {
    Sound.unlock();
    Sound.setMuted(!Sound.muted);
    syncMuteButton();
    if (!Sound.muted) Sound.play('ui');
  }
  function syncMuteButton() {
    btnSound.classList.toggle('is-muted', Sound.muted);
    btnSound.setAttribute('aria-label', Sound.muted ? 'Unmute sound' : 'Mute sound');
  }

  async function shareScore() {
    const url = location.href.split('#')[0];
    const msg = `I scored ${S.score} in Tiny Arms 🦖 (${rankFor(S.score)}). Can you beat it?`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Tiny Arms', text: msg, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(`${msg} ${url}`);
      toast('Copied to clipboard — paste it anywhere');
    } catch (e) {
      toast('Could not copy automatically');
    }
  }

  // Buttons
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    Sound.unlock();
    const a = btn.dataset.action;
    if (a === 'play') startRun();
    else if (a === 'help') { Sound.play('ui'); S.phase = 'help'; showScreen('help'); }
    else if (a === 'menu') { Sound.play('ui'); goMenu(); }
    else if (a === 'resume') togglePause();
    else if (a === 'share') shareScore();
  });
  btnPause.addEventListener('click', () => { togglePause(); });
  btnSound.addEventListener('click', toggleMute);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && PLAY_PHASES.has(S.phase) && !S.paused) togglePause();
  });

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function update(dt) {
    S.t += dt;
    S.pt += dt;
    S.shake = Math.max(0, S.shake - dt * 40);
    S.flash = Math.max(0, S.flash - dt * 2.6);
    updateParts(dt);

    const def = S.game, g = S.g;
    switch (S.phase) {
      case 'intro': {
        const len = Math.max(0.75, 1.2 / Math.sqrt(S.speed));
        if (S.pt >= len) { setPhase('play'); input.pressed = false; }
        break;
      }
      case 'play': {
        const gdt = dt * S.speed;
        g.time += gdt;
        def.update(g, gdt, input);
        S.left -= dt;
        if (g.won) finish(true);
        else if (g.lost) finish(false);
        else if (S.left <= 0) { S.left = 0; finish(!!def.survive); }
        break;
      }
      case 'result': {
        g.time += dt * S.speed;
        def.update(g, dt * S.speed, NO_INPUT);
        if (S.pt >= 1.2) {
          if (S.lives <= 0) gameOver();
          else if (S.resultWin && S.cleared % 5 === 0) {
            S.level++;
            S.prevThemeIdx = S.themeIdx;
            S.themeIdx = S.level - 1;
            S.speed = Math.min(2.2, Math.round((1 + (S.level - 1) * 0.15) * 10) / 10);
            S.bonus = S.lives < MAX_LIVES;
            if (S.bonus) { S.lives++; renderLives(); }
            Sound.play('level');
            updateHUD();
            bump(hudSpeed);
            setPhase('levelup');
          } else beginGame();
        }
        break;
      }
      case 'levelup':
        if (S.pt >= 2.2) beginGame();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function drawCommand(def, t, intro) {
    const hint = input.touch ? def.hint.touch : def.hint.key;
    if (intro) {
      const k = easeOutBack(clamp(t / 0.32, 0, 1));
      ctx.save();
      ctx.fillStyle = `rgba(243, 236, 223, ${0.45 * clamp(t / 0.15, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, 200);
      ctx.scale(k, k);
      text(ctx, def.cmd, 0, 0, { size: 112, strokeW: 16, stroke: '#FFFCF6' });
      ctx.restore();
      text(ctx, hint, W / 2, 290, { size: 30, weight: 500, color: '#45513F', strokeW: 9, alpha: clamp((t - 0.15) / 0.2, 0, 1) });
    } else {
      text(ctx, def.cmd, W / 2, 62, { size: 46, strokeW: 10 });
      if (S.pt < 1.4) text(ctx, hint, W / 2, 104, { size: 21, weight: 500, color: '#45513F', strokeW: 7, alpha: clamp(1.4 - S.pt, 0, 1) });
    }
  }

  function drawResult() {
    const k = easeOutBack(clamp(S.pt / 0.3, 0, 1));
    const col = S.resultWin ? '#467F45' : '#B9573C';
    ctx.save();
    ctx.translate(W / 2, 74);
    ctx.scale(k, k);
    ctx.rotate(S.resultWin ? -0.03 : 0.03);
    text(ctx, S.resultText, 0, 0, { size: 54, color: col, strokeW: 12 });
    ctx.restore();
  }

  function drawTitleScene(t) {
    drawRex(ctx, {
      x: 690, y: GROUND, s: 1.95, t,
      arm: -1 + Math.sin(t * 7) * 0.45, bend: -0.3 + Math.sin(t * 7) * 0.3,
      armFar: 0.7, smile: true, eye: 'open', lookX: -0.4,
      squash: 1 + Math.sin(t * 2.2) * 0.012,
    });
    // tiny speech bubble
    const a = clamp((Math.sin(t * 0.9) + 0.2) * 2, 0, 1);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFFCF6';
      ctx.shadowColor = 'rgba(70, 55, 30, 0.18)';
      ctx.shadowBlur = 14;
      rr(ctx, 520, 150, 150, 46, 23); ctx.fill();
      ctx.beginPath(); ctx.moveTo(650, 186); ctx.lineTo(682, 200); ctx.lineTo(640, 192); ctx.fill();
      ctx.restore();
      text(ctx, 'Hi! *waves*', 595, 174, { size: 21, weight: 600, alpha: a });
    }
  }

  function drawOverScene(t) {
    drawRex(ctx, {
      x: 720, y: GROUND, s: 1.8, t,
      arm: 1.3, armFar: 1.4, bend: 0.4, eye: 'closed', brow: 'worried',
      headTilt: 0.22, squash: 0.9, mouth: 0, blush: false,
    });
    // Personal rain cloud
    const cx = 790, cy = 70 + Math.sin(t * 1.5) * 4;
    ctx.fillStyle = '#B9C1C4';
    ctx.beginPath();
    ctx.arc(cx - 40, cy, 26, 0, TAU);
    ctx.arc(cx, cy - 14, 34, 0, TAU);
    ctx.arc(cx + 40, cy, 26, 0, TAU);
    ctx.fill();
    rr(ctx, cx - 64, cy - 4, 128, 30, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(118, 163, 212, 0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const k = ((t * 1.3 + i * 0.37) % 1);
      const x = cx - 50 + i * 12.5;
      const y = cy + 30 + k * 120;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLevelUp(t) {
    const k = clamp(S.pt / 2.2, 0, 1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const y = 120 + i * 30;
      const x = ((i * 137 - S.pt * 1400) % (W + 300) + W + 300) % (W + 300) - 150;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 90, y); ctx.stroke();
    }
    drawRex(ctx, {
      x: lerp(-140, W + 160, easeOutCubic(k)), y: GROUND, s: 1.5, t,
      walk: S.pt * 30, arm: -1.1, armFar: -0.8, eye: 'happy', mouth: 0.6, headTilt: -0.05,
    });
    const p = easeOutBack(clamp(S.pt / 0.35, 0, 1));
    ctx.save();
    ctx.translate(W / 2, 170);
    ctx.scale(p, p);
    text(ctx, `LEVEL ${S.level}`, 0, 0, { size: 104, color: '#B9573C', strokeW: 16 });
    ctx.restore();
    const a1 = clamp((S.pt - 0.25) / 0.3, 0, 1);
    const a2 = clamp((S.pt - 0.55) / 0.3, 0, 1);
    text(ctx, worldName(), W / 2, 250, { size: 36, weight: 600, color: INK, strokeW: 9, alpha: a1 });
    const extra = S.bonus ? '  ·  +1 egg 🥚' : '';
    text(ctx, `${S.speed.toFixed(1)}× speed${extra}`, W / 2, 298, { size: 26, weight: 500, color: '#45513F', strokeW: 8, alpha: a2 });
  }

  function render() {
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    ctx.save();
    if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake, rand(-1, 1) * S.shake);
    if (S.phase === 'levelup' && S.pt < 0.8) {
      drawWorld(ctx, S.t, THEMES[S.prevThemeIdx % THEMES.length]);
      ctx.save();
      ctx.globalAlpha = clamp(S.pt / 0.8, 0, 1);
      drawWorld(ctx, S.t);
      ctx.restore();
    } else drawWorld(ctx, S.t);

    if (S.phase === 'title' || S.phase === 'help') drawTitleScene(S.t);
    else if (S.phase === 'over') drawOverScene(S.t);
    else if (S.phase === 'levelup') drawLevelUp(S.t);
    else if (S.game) S.game.draw(S.g, ctx, S.t);

    drawParts(ctx);
    ctx.restore();

    if (S.phase === 'intro') drawCommand(S.game, S.pt, true);
    else if (S.phase === 'play') drawCommand(S.game, S.pt, false);
    else if (S.phase === 'result') drawResult();

    if (S.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${S.flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Timer bar
    let frac = 0;
    if (S.phase === 'intro') frac = 1;
    else if (S.phase === 'play') frac = S.left / S.dur;
    else if (S.phase === 'result') frac = S.left / S.dur;
    timerFill.style.transform = `scaleX(${clamp(frac, 0, 1)})`;
    timerEl.classList.toggle('low', S.phase === 'play' && frac < 0.3);
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!S.paused) update(dt);
    render();
    input.pressed = false;
    input.released = false;
    requestAnimationFrame(frame);
  }

  syncMuteButton();
  updateTitleBest();
  showScreen('title');
  requestAnimationFrame(frame);

  // Small debug hook for automated tests (harmless in production)
  window.__tinyArms = { S, GAMES, startRun, beginGame, updateHUD };
})();
