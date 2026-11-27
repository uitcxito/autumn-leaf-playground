(() => {
  'use strict';

  const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
  const between = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const center = { x: 0.52, y: 0.755 };
  // Each leaf uses the same tiny woodcut at rest, edge-on and in flight.
  const shapes = [
    ['......2....','.....123...','..2..123.2.','..12213312.','2.1234312..','122344322.2','.1234433212','..1233321..','...11221...','.....1.....','....1......'],
    ['.....22....','....2332...','..211432...','..2334312..','...134332..','..2334311..','.1234332...','..123321...','...1121....','....1......','...1.......'],
    ['....222....','..2233322..','.233343332.','23334343332','12344344321','.123434321.','..1234321..','...12321...','....121....','.....1.....','.....1.....'],
    ['.........2.','.......232.','.....23332.','...2234332.','..23343321.','.23343321..','.1234321...','.123321....','..1121.....','..1........','.1.........'],
    ['.....5.....','....535....','..5533355..','.533363335.','53333633335','53323632335','.532263235.','.553263255.','..5556555..','.....1.....','....1......'],
    ['.....5.....','....535....','...53335...','..5333635..','.533363335.','.533633335.','.53363335..','..536335...','...5635....','....15.....','...1.......']
  ];
  const hues = [
    ['#76351b','#aa4a20','#df702a','#f7a546'],
    ['#844824','#b76425','#e49731','#ffcc62'],
    ['#7e3924','#ae4327','#da5b2b','#f18c40'],
    ['#896026','#ad7b29','#d4a83a','#ffe17b'],
    ['#68371f','#944c28','#bf733c','#e89f57'],
    ['#793222','#99402b','#bd5132','#de7d40'],
    ['#786329','#968231','#baa143','#e1c56b']
  ];

  function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function makeSprites() {
    const cell = 22;
    const atlas = makeCanvas(8 * cell, shapes.length * hues.length * cell);
    const atlasInk = atlas.getContext('2d');
    atlasInk.imageSmoothingEnabled = false;
    const tile = makeCanvas(20, 20);
    const ink = tile.getContext('2d');
    const coral = ['#905337','#db6d48','#e98859','#ffb16a','#f5be69','#ac4d3a'];
    const butter = ['#97763e','#d9a742','#e9bd54','#f8d581','#f5cf71','#ba913d'];
    for (let shape = 0; shape < shapes.length; shape++) {
      for (let hue = 0; hue < hues.length; hue++) {
        const palette = shape < 4 ? hues[hue] : ([0, 2, 5].includes(hue) ? coral : butter);
        ink.clearRect(0, 0, tile.width, tile.height);
        shapes[shape].forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            if (row[x] === '.') continue;
            ink.fillStyle = palette[Number(row[x]) - 1];
            ink.fillRect(x + 4, y + 4, 1, 1);
          }
        });
        const top = (shape * hues.length + hue) * cell;
        for (let angle = 0; angle < 8; angle++) {
          atlasInk.save();
          atlasInk.translate(angle * cell + 11, top + 11);
          atlasInk.rotate(angle * Math.PI / 4);
          atlasInk.drawImage(tile, -9.5, -9.5);
          atlasInk.restore();
        }
      }
    }
    return atlas;
  }

  // piles.webp contains the original artwork at five densities and two screen
  // layouts. The live simulation controls the size of the picture independently.
  const pileLevels = [24, 78, 164, 348, 704];
  function pileFrames(layoutWidth, top) {
    let left = 0;
    return pileLevels.map(count => {
      const volume = count / 164;
      const radius = Math.min(layoutWidth * .157, 100) * volume ** .2;
      const height = Math.min(layoutWidth * .097, 58.8) * volume ** .61;
      const width = Math.ceil(radius * 2 + 24);
      const rows = Math.ceil(height * 1.23 + radius * .21 + 24);
      const frame = { left, top, width, rows, radius, height };
      left += width + 2;
      return frame;
    });
  }
  const compactPileFrames = pileFrames(320, 0);
  const widePileFrames = pileFrames(720, 133);
  let pileAtlas, fallbackPile, pileShadow;
  if (typeof Image === 'function') {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (image.decode) image.decode().then(() => { pileAtlas = image; }, () => { pileAtlas = image; });
      else pileAtlas = image;
    };
    image.src = 'piles.webp';
  }
  let spriteLibrary;
  function createLeafGame(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    spriteLibrary ||= makeSprites();
    const sprites = spriteLibrary;
    let W = 720, H = 400, radius = 88, mound = 48;
    let pile = [], floor = [], air = [], breeze = [];
    let time = 0, mode = 'rake', modeTime = 0, resumeMode = 'rake', pendingToss = false;
    let lastTime = 0, frameId = 0, paused = false, destroyed = false;
    let jumpStart = { x: .72, y: .78 }, bounds, press, rakePoint, rakeTarget;
    const movingFloor = new Set();
    let groundLayer, groundInk, groundDirty = null, pointerBounds;
    let sweep = 0, keyboardStroke = 0, sweepOrigin, contact = 0, strokeTime = -10, idle = 0, wiggle = 0;
    const sound = (type, strength = 1) => options.onSound?.(type, strength);
    const pickColor = () => [0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 4, 5, 6][Math.floor(Math.random() * 13)];

    function leaf() {
      return {
        shape: Math.floor(Math.random() * shapes.length), hue: pickColor(), turn: Math.floor(Math.random() * 8),
        scale: between(.72, 1.18), phase: between(0, TAU), spin: between(-2.6, 2.6),
        px: between(-1, 1), py: Math.random(), x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, guided: false
      };
    }
    function updateMeasures() {
      const volume = pile.length / 164;
      radius = Math.min(W * .157, H * .25) * Math.pow(volume, .2);
      mound = Math.min(W * .097, H * .147) * Math.pow(volume, .61);
    }
    function notify() {
      updateMeasures();
      const height = Math.round(58 * Math.pow(pile.length / 164, .61));
      options.onUpdate?.({ count: pile.length, height, mode });
    }
    function changed() {
      notify();
    }
    function switchMode(next) {
      mode = next;
      modeTime = 0;
      notify();
    }
    function ridge(u) {
      const body = Math.max(0, 1 - Math.abs(u) ** 1.38);
      const bumps = .065 * Math.sin(u * 12 + .8) + .035 * Math.cos(u * 29) + .028 * Math.sin(u * 52 + .6);
      return Math.max(0, body * (1 + bumps) - Math.max(0, u * .045));
    }
    function pxLeaf(context, item, x, y, size, direction = item.turn, across = 1, vertical = 1) {
      const left = (((Math.round(direction) % 8) + 8) % 8) * 22;
      const top = (item.shape * hues.length + item.hue) * 22;
      const w = Math.max(3, Math.round(22 * size * across));
      const h = Math.max(3, Math.round(22 * size * vertical));
      context.drawImage(sprites, left, top, 22, 22, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    }
    function pixelLine(context, x1, y1, x2, y2, width, color) {
      x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
      const dx = Math.abs(x2 - x1), sx = x1 < x2 ? 1 : -1;
      const dy = -Math.abs(y2 - y1), sy = y1 < y2 ? 1 : -1;
      let err = dx + dy;
      context.fillStyle = color;
      const half = Math.floor(width / 2);
      while (true) {
        context.fillRect(x1 - half, y1 - half, width, width);
        if (x1 === x2 && y1 === y2) break;
        const e2 = err * 2;
        if (e2 >= dy) { err += dy; x1 += sx; }
        if (e2 <= dx) { err += dx; y1 += sy; }
      }
    }
    function oval(c, x, y, rx, ry, color) {
      if (rx <= 0 || ry <= 0) return;
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, TAU);
      c.fill();
    }

    function makeFallbackPile() {
      // A small, reusable bed keeps the game playable while the artwork loads
      // or if the image request fails. It is never rebuilt during a gesture.
      const f = widePileFrames[2];
      const surface = makeCanvas(f.width, f.rows);
      const c = surface.getContext('2d');
      c.imageSmoothingEnabled = false;
      const ox = f.width / 2, oy = f.rows - 12 - f.radius * .12;
      c.fillStyle = '#bd692d';
      c.beginPath();
      c.moveTo(ox - f.radius, oy);
      for (let i = -20; i <= 20; i++) {
        const u = i / 20;
        c.lineTo(ox + u * f.radius, oy - ridge(u) * f.height);
      }
      c.quadraticCurveTo(ox, oy + f.radius * .2, ox - f.radius, oy);
      c.fill();
      for (const item of pile) {
        const x = ox + item.px * f.radius;
        const y = oy - ridge(item.px) * (1 - item.py) * f.height
          + (1 - item.px * item.px) * item.py * f.radius * .11;
        pxLeaf(c, item, x, y, item.scale * 1.15, item.turn, 1.05, .76);
      }
      return surface;
    }

    function drawMound() {
      if (!pile.length) return;
      const x = center.x * W, y = center.y * H;
      if (!pileShadow) {
        pileShadow = makeCanvas(224, 40);
        const shadow = pileShadow.getContext('2d');
        oval(shadow, 112 - 6.5, 12 + 7.5, 110, 15, 'rgba(58,39,20,.12)');
        oval(shadow, 112 - 3, 12 + 6.8, 96, 11.5, 'rgba(63,35,17,.17)');
      }
      const shadowScale = radius / 100;
      ctx.drawImage(pileShadow, Math.round(x - 112 * shadowScale), Math.round(y - 12 * shadowScale),
        Math.max(1, Math.round(224 * shadowScale)), Math.max(1, Math.round(40 * shadowScale)));
      const bounce = contact > 0 ? Math.sin(contact * Math.PI * 2.4) * contact * .14 : 0;
      const rx = radius * (1 + bounce * .22), rise = mound * (1 - bounce);
      const count = pile.length;
      if (count <= 20) {
        // At the very bottom each actual remaining leaf is visible individually.
        for (const item of pile) {
          const yy = y - ridge(item.px) * (1 - item.py) * rise
            + (1 - item.px * item.px) * item.py * rx * .11;
          pxLeaf(ctx, item, x + item.px * rx, yy, item.scale, item.turn, 1.05, .76);
        }
        return;
      }
      function stamp(bitmap, frame, left, top) {
        const sx = rx / frame.radius, sy = rise / frame.height;
        const anchor = frame.rows - 12 - frame.radius * .12;
        ctx.drawImage(bitmap, left, top, frame.width, frame.rows,
          Math.round(x - frame.width * sx / 2), Math.round(y - anchor * sy),
          Math.max(1, Math.round(frame.width * sx)), Math.max(1, Math.round(frame.rows * sy)));
      }
      if (!pileAtlas) {
        fallbackPile ||= makeFallbackPile();
        stamp(fallbackPile, widePileFrames[2], 0, 0);
        return;
      }
      const frames = W < 510 ? compactPileFrames : widePileFrames;
      let i = 0;
      while (i < pileLevels.length - 1 && count >= pileLevels[i + 1]) i++;
      const frame = frames[i];
      stamp(pileAtlas, frame, frame.left, frame.top);
      if (i < frames.length - 1 && count > pileLevels[i]) {
        // Only blend near a density change, leaving most frames a single blit.
        const t = (count - pileLevels[i]) / (pileLevels[i + 1] - pileLevels[i]);
        if (t > .55) {
          const next = frames[i + 1];
          ctx.globalAlpha = (t - .55) / .45;
          stamp(pileAtlas, next, next.left, next.top);
          ctx.globalAlpha = 1;
        }
      }
    }
    function inPile(x, y) {
      const dx = Math.abs((x - center.x) * W);
      const dy = Math.abs((y - center.y) * H);
      const area = Math.max(16, radius * .84);
      return (dx / area) ** 2 + (dy / Math.max(12, area * .37)) ** 2 < 1;
    }
    function scatter(amount, style) {
      const isToss = style === 'toss', isAngel = style === 'angel';
      const n = Math.min(amount, pile.length);
      for (let i = 0; i < n; i++) {
        const item = pile.pop();
        const side = Math.random() < .5 ? -1 : 1;
        const startWidth = isToss ? .16 : .66;
        item.x = center.x + side * between(0, startWidth) * radius / W;
        item.y = center.y + between(-.016, .021);
        item.z = Math.max(.017, mound / H * between(.22, .59));
        item.vx = side * between(isToss ? .15 : .09, isToss ? .61 : isAngel ? .20 : .34) * H / W;
        item.vy = isToss ? between(-.15, .24) : between(-.073, .085);
        item.towardCamera = isToss ? Math.random() ** 2 : 0;
        item.vz = isToss ? between(.65, .97) : (isAngel ? between(.14, .39) : between(.28, .58));
        item.spin = between(-6.3, 6.3);
        item.guided = false;
        air.push(item);
      }
      if (n) changed();
    }

    // Keep only the handful of nearest leaves this stroke can actually collect.
    function autoGather(at, n, restrict) {
      const nearest = [], distances = [];
      const reach = restrict ? Math.max(35, radius * .7) ** 2 : Infinity;
      for (const f of floor) {
        if (f.guided) continue;
        const d = ((f.x - at.x) * W) ** 2 + ((f.y - at.y) * H) ** 2;
        if (d > reach || (nearest.length === n && d >= distances[n - 1])) continue;
        let slot = nearest.length;
        while (slot > 0 && distances[slot - 1] > d) slot--;
        nearest.splice(slot, 0, f);
        distances.splice(slot, 0, d);
        if (nearest.length > n) { nearest.pop(); distances.pop(); }
      }
      for (const f of nearest) {
        wakeGroundLeaf(f);
        f.guided = true;
        f.guideDelay = between(0, .07);
        f.vx += (center.x - f.x) * .6;
        f.vy += (center.y - f.y) * .6;
      }
      if (nearest.length) {
        sweep = 1;
        sound('rake', Math.min(1, .38 + nearest.length / 12));
      }
      return nearest.length;
    }
    function rake() {
      if (paused || mode === 'jump' || mode === 'toss') return;
      if (mode === 'rest') switchMode('rake');
    }
    function sweepNearby() {
      if (paused || mode === 'jump' || mode === 'toss') return;
      if (mode === 'rest') switchMode('rake');
      let nearest, best = Infinity;
      for (const f of floor) {
        if (f.guided) continue;
        const d = ((f.x - rakePoint.x) * W) ** 2 + ((f.y - rakePoint.y) * H) ** 2;
        if (d <= best) { best = d; nearest = f; }
      }
      if (!nearest) return;
      sweepOrigin = { x: nearest.x, y: nearest.y };
      rakePoint = { ...sweepOrigin };
      rakeTarget = { ...sweepOrigin };
      keyboardStroke = 1;
      autoGather(sweepOrigin, 7, false);
    }
    function jump() {
      if (paused || mode === 'jump' || mode === 'toss') return;
      jumpStart = mode === 'rest' ? { x: center.x + .025, y: center.y } :
        { x: center.x + Math.min(.29, radius / W + .10), y: center.y + .035 };
      press = undefined;
      switchMode('jump');
      sound('jump', .8);
    }
    function toss() {
      if (paused || mode === 'jump' || mode === 'toss') return;
      if (!pile.length && floor.length) autoGather({ ...center }, 13, false);
      resumeMode = mode;
      pendingToss = true;
      switchMode('toss');
      press = undefined;
    }
    function angel() {
      if (paused || mode !== 'rest' || time - strokeTime < .16) return;
      strokeTime = time;
      wiggle = 1;
      scatter(Math.min(6, Math.ceil(pile.length * .045)), 'angel');
      sound('angel', .48);
    }
    function position(event) {
      // The camera can zoom while a pointer is down. Refresh at most once per frame.
      pointerBounds ||= canvas.getBoundingClientRect();
      return { x: clamp((event.clientX - pointerBounds.left) / Math.max(1, pointerBounds.width), 0, 1),
        y: clamp((event.clientY - pointerBounds.top) / Math.max(1, pointerBounds.height), 0, 1) };
    }
    function aim(p) {
      keyboardStroke = 0;
      rakeTarget = { x: p.x, y: clamp(p.y, .465, .976) };
      idle = 0;
    }
    function down(event) {
      if (paused || press || event.button !== undefined && event.button !== 0) return;
      pointerBounds = null;
      const p = position(event);
      if (mode !== 'rest' && (mode !== 'rake' || p.y < .409)) return;
      press = { ...p, id: event.pointerId, moved: 0, touched: new Set() };
      canvas.setPointerCapture?.(event.pointerId);
      if (mode === 'rest') angel(); else { aim(p); sweep = .5; }
      event.preventDefault();
    }
    function move(event) {
      if (paused || (press ? press.id !== event.pointerId : mode !== 'rake' || event.pointerType === 'touch')) return;
      const p = position(event);
      if (mode === 'rake' && (press || event.pointerType !== 'touch') && p.y > .40) aim(p);
      if (!press) return;
      const dx = p.x - press.x, dy = p.y - press.y;
      const dl = Math.hypot(dx * W, dy * H);
      if (mode === 'rest') {
        if (dl > .5) angel();
      } else if (mode === 'rake' && dl > .02) {
        const sx = press.x * W, sy = press.y * H;
        const vx = dx * W, vy = dy * H;
        const rr = Math.min(40, Math.max(19, W * .058));
        const nearX = Math.min(sx, sx + vx) - rr, farX = Math.max(sx, sx + vx) + rr;
        const nearY = Math.min(sy, sy + vy) - rr, farY = Math.max(sy, sy + vy) + rr;
        for (const f of floor) {
          if (f.guided || f.x * W < nearX || f.x * W > farX ||
              f.y * H < nearY || f.y * H > farY) continue;
          const fx = f.x * W - sx, fy = f.y * H - sy;
          const alpha = clamp((fx * vx + fy * vy) / (dl * dl), 0, 1);
          const dist2 = (fx - alpha * vx) ** 2 + (fy - alpha * vy) ** 2;
          if (dist2 >= rr * rr) continue;
          const pull = .22 + (1 - Math.sqrt(dist2) / rr) * .77;
          wakeGroundLeaf(f);
          f.x = clamp(f.x + dx * pull * .9, .015, .985);
          f.y = clamp(f.y + dy * pull * .9, .465, .98);
          f.vx = clamp(f.vx + dx * 7 * pull, -.52, .52);
          f.vy = clamp(f.vy + dy * 7 * pull, -.39, .39);
          f.turn += dx * 6 + dy * 7;
          press.touched.add(f);
        }
        if (time - strokeTime > .16 && press.touched.size) {
          sound('rake', clamp(dl / 20, .2, .75));
          strokeTime = time;
        }
        sweep = Math.max(.5, sweep);
      }
      press.moved += dl;
      press.x = p.x; press.y = p.y;
    }
    function up(event) {
      if (!press || event.pointerId !== press.id) return;
      if (event.type === 'pointerup' && mode === 'rake') {
        if (press.moved < 6) autoGather(press, 5, true);
        else for (const f of press.touched) {
          if (Math.hypot((f.x - center.x) * W, (f.y - center.y) * H) < radius * 1.8 ||
              (center.x - f.x) * f.vx + (center.y - f.y) * f.vy > .007) {
            // A long stroke may have already moved this leaf into the pile.
            if (!movingFloor.has(f)) {
              if (!floor.includes(f)) continue;
              wakeGroundLeaf(f);
            }
            f.guided = true;
            f.guideDelay = between(0, .12);
          }
        }
      }
      press = undefined;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
    const listeners = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up };
    for (const [event, fn] of Object.entries(listeners)) canvas.addEventListener(event, fn);
    canvas.style.touchAction = 'none';

    function character(x, y, pose, progress = 0) {
      const d = Math.min(1.27, Math.max(.84, W / 570));
      const c = ctx;
      const line = (ax, ay, bx, by, size, color) => pixelLine(c, x + ax * d, y + ay * d,
        x + bx * d, y + by * d, Math.max(1, Math.round(size * d)), color);
      const block = (ax, ay, w, h, color) => {
        c.fillStyle = color;
        c.fillRect(Math.round(x + ax * d), Math.round(y + ay * d), Math.max(1, Math.round(w * d)), Math.max(1, Math.round(h * d)));
      };
      let lax, lay, rax, ray, lax2, lay2, rax2, ray2, lx, ly, rx, ry;
      if (pose === 'jump') {
        const lift = Math.sin(progress * Math.PI);
        lax = -8; lay = -11 * lift; rax = 8; ray = -8 * lift;
        lax2 = -3; lay2 = -4; rax2 = 3; ray2 = -4;
        lx = -5 - 3 * lift; ly = 14 - 7 * lift; rx = 4 + 8 * lift; ry = 13 - 3 * lift;
      } else {
        const wave = pose === 'toss' ? Math.sin(Math.min(1, progress / .7) * Math.PI) :
          wiggle > 0 ? Math.sin((1 - wiggle) * Math.PI * 1.5) : Math.sin(time * 1.8) * .04;
        lax = -15 + 4 * wave; lay = -6 - wave * 9;
        rax = 15 - 4 * wave; ray = -7 - wave * 9;
        lax2 = -4; lay2 = -3; rax2 = 4; ray2 = -3;
        lx = -7 - 5 * wave; ly = 14; rx = 9 + 5 * wave; ry = 13;
      }
      // Boots, cuffed jeans and long sleeves stay readable down to small mobile widths.
      line(-2, 3, lx, ly, 5, '#333e3e');
      line(2, 3, rx, ry, 5, '#384743');
      line(-2, 4, lx, ly - 1, 2, '#607475');
      line(2, 4, rx, ry - 1, 2, '#647f7c');
      line(lx - 1, ly, lx - 3, ly + 1, 4, '#493c30');
      line(rx, ry, rx + 2, ry + 1, 4, '#493c30');
      line(lax2, lay2, lax, lay, 5, '#365a4a');
      line(rax2, ray2, rax, ray, 5, '#477663');
      line(lax2, lay2 - 1, lax + 1, lay - 1, 2, '#739a78');
      line(rax2, ray2 - 1, rax - 1, ray - 1, 2, '#81a783');
      block(lax - 2, lay - 1, 3, 3, '#e3ae78');
      block(rax, ray - 2, 3, 3, '#f4ce94');
      block(-4, -6, 9, 12, '#335b4a');
      block(-3, -5, 6, 9, '#6c9674');
      block(2, -5, 2, 9, '#769f79');
      block(-6, -7, 7, 2, '#b44e29');
      block(-6, -6, 3, 5, '#cc6230');
      block(-3, -12, 7, 7, '#985c3b');
      block(-2, -12, 6, 6, '#f0be89');
      block(3, -10, 2, 2, '#ffcf90');
      block(-4, -15, 7, 3, '#78432b');
      block(-5, -13, 9, 3, '#a9572e');
      block(-4, -14, 6, 2, '#e78843');
      block(-4, -11, 2, 4, '#7d462f');
      if (pose !== 'jump') {
        block(-1, -9, 1, 1, '#765542'); block(2, -9, 1, 1, '#765542');
      }
    }

    // The teeth and wooden handle are rigid. Draw them once at their typical
    // angle, then animate this sprite around its collar when the rake moves.
    function makeRakeSprite() {
      const image = makeCanvas(116, 124);
      const ink = image.getContext('2d');
      const cs = Math.cos(-.81), sn = Math.sin(-.81);
      const l = (u, v, uu, vv, width, color) => {
        pixelLine(ink, 36 + u * cs - v * sn, 82 + u * sn + v * cs,
          36 + uu * cs - vv * sn, 82 + uu * sn + vv * cs, Math.round(width), color);
      };
      // Tang, brass collar, polished ash handle and bent spring-steel tines.
      l(4, 0, 103, 0, 5.3, '#6c482b');
      l(4, -1, 103, -1, 3.3, '#bd8d53');
      l(11, -2, 100, -2, 1.2, '#ebbd77');
      l(97, 0, 103, 0, 3, '#ab784e');
      l(2, 0, 9, 0, 5, '#716546');
      l(3, -1, 8, -1, 3, '#c9ae72');
      for (let i = -5; i <= 5; i++) {
        const t = i / 5, at = -22 + Math.abs(t) * 3.5;
        l(2, t * 1.8, at, t * 18, 1.7, '#5a5947');
        l(at, t * 18, at - 4, t * 18 + 1, 1.6, '#4c4f42');
        if (i % 2 === 0) l(-5, t * 6.3 - 1, at + 1, t * 17.4 - 1, 1, '#d3c4a0');
      }
      l(-12, -11.5, -13, 11.5, 2.1, '#7d7560');
      l(-13, -11, -14, 11, 1.1, '#b7ab84');
      return image;
    }
    const rakeSprite = makeRakeSprite();

    function drawRake() {
      const x = rakePoint.x * W, y = rakePoint.y * H;
      const scale = Math.min(1.17, Math.max(.73, W / 620)) * (.84 + (rakePoint.y - .45) * .43);
      const lean = press ? .07 + Math.sin(time * 7) * .035 : Math.sin(time * 1.15) * .025;
      oval(ctx, x - 6, y + 5, 17 * scale, 3 * scale, 'rgba(70,44,25,.18)');
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(lean - sweep * .085);
      ctx.scale(scale, scale);
      ctx.drawImage(rakeSprite, -36, -82);
      ctx.restore();
    }

    // Covers every ground sprite and its shadow at the closest supported depth.
    const groundMargin = 22;
    function markGround(f) {
      const x = Math.round(f.x * W), y = Math.round(f.y * H);
      if (!groundDirty) {
        groundDirty = { l: x - groundMargin, r: x + groundMargin, t: y - groundMargin, b: y + groundMargin };
      } else {
        groundDirty.l = Math.min(groundDirty.l, x - groundMargin);
        groundDirty.r = Math.max(groundDirty.r, x + groundMargin);
        groundDirty.t = Math.min(groundDirty.t, y - groundMargin);
        groundDirty.b = Math.max(groundDirty.b, y + groundMargin);
      }
    }
    function wakeGroundLeaf(f) {
      if (movingFloor.has(f)) return;
      markGround(f);
      movingFloor.add(f);
    }
    function paintGroundLeaf(c, f) {
      const depth = clamp((f.y - .45) / .55, 0, 1);
      const size = f.scale * (.38 + depth * .83);
      const lift = f.guided ? Math.abs(Math.sin(time * 12 + f.phase)) * 2.2 : 0;
      oval(c, f.x * W - size * 1.5, f.y * H + size * 1.7, size * 4.4, size * 1.15, 'rgba(68,47,26,.14)');
      pxLeaf(c, f, f.x * W, f.y * H - lift, size, f.turn, 1.14, .62);
    }
    function drawFloor() {
      if (!groundLayer) return;
      if (groundDirty) {
        const { l, r, t, b } = groundDirty;
        groundInk.clearRect(l, t, r - l, b - t);
        groundInk.save();
        groundInk.beginPath(); groundInk.rect(l, t, r - l, b - t); groundInk.clip();
        for (const f of floor) {
          const x = f.x * W, y = f.y * H;
          if (x + groundMargin < l || x - groundMargin > r || y + groundMargin < t || y - groundMargin > b ||
              movingFloor.has(f)) continue;
          paintGroundLeaf(groundInk, f);
        }
        groundInk.restore();
        groundDirty = null;
      }
      const top = Math.floor(H * .4);
      ctx.drawImage(groundLayer, 0, top, W, H - top, 0, top, W, H - top);
      for (const f of movingFloor) paintGroundLeaf(ctx, f);
    }

    function reset() {
      pile = Array.from({ length: 164 }, leaf);
      floor = [];
      movingFloor.clear();
      groundDirty = { l: 0, t: 0, r: W, b: H };
      for (let i = 0; i < 140; i++) {
        const item = leaf();
        item.x = between(.015, .985);
        item.y = .462 + Math.pow(Math.random(), .71) * .523;
        if (Math.abs(item.x - center.x) < .12 && Math.abs(item.y - center.y) < .043)
          item.x += item.x > center.x ? .14 : -.14;
        if (i < 22) {
          const a = between(.05, Math.PI - .05);
          item.x = center.x + Math.cos(a) * between(.115, .17);
          item.y = center.y + Math.sin(a) * between(.021, .051);
        }
        floor.push(item);
      }
      air = [];
      breeze = Array.from({ length: 9 }, () => {
        const item = leaf();
        item.x = between(.01, .99); item.y = between(-.05, .64);
        item.speed = between(.028, .085); item.swing = between(.3, 1);
        return item;
      });
      rakePoint = { x: center.x + .20, y: center.y + .025 };
      rakeTarget = { ...rakePoint }; press = undefined;
      pendingToss = false; keyboardStroke = wiggle = sweep = contact = 0;
      mode = 'rake'; modeTime = idle = 0;
      changed();
      render();
    }
    function resize() {
      bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      H = 400;
      W = Math.max(140, Math.round(H * bounds.width / bounds.height));
      if (groundLayer && canvas.width === W && canvas.height === H) return;
      canvas.width = W; canvas.height = H;
      pointerBounds = null;
      groundLayer = makeCanvas(W, H);
      groundInk = groundLayer.getContext('2d');
      groundInk.imageSmoothingEnabled = false;
      groundDirty = { l: 0, t: 0, r: W, b: H };
      ctx.imageSmoothingEnabled = false;
      updateMeasures();
      if (pile.length) render();
    }
    function advance(dt) {
      time += dt; modeTime += dt; idle += dt;
      sweep = Math.max(0, sweep - dt * 2.4);
      contact = Math.max(0, contact - dt * 1.5);
      wiggle = Math.max(0, wiggle - dt * 1.5);
      if (keyboardStroke > 0) {
        keyboardStroke = Math.max(0, keyboardStroke - dt * 1.9);
        const progress = 1 - keyboardStroke * keyboardStroke;
        rakeTarget.x = sweepOrigin.x + (center.x - sweepOrigin.x) * progress * .82;
        rakeTarget.y = sweepOrigin.y + (center.y - sweepOrigin.y) * progress * .82;
      }
      const easing = 1 - Math.exp(-dt * 21);
      rakePoint.x += (rakeTarget.x - rakePoint.x) * easing;
      rakePoint.y += (rakeTarget.y - rakePoint.y) * easing;
      if (mode === 'jump' && modeTime >= .83) {
        contact = 1;
        scatter(Math.max(7, Math.min(38, Math.floor(pile.length * .19))), 'jump');
        switchMode('rest');
        sound('land', 1);
      }
      if (mode === 'toss') {
        if (pendingToss && modeTime > .22) {
          pendingToss = false;
          scatter(Math.min(40, Math.max(14, Math.round(pile.length * .25))), 'toss');
          sound('toss', 1);
        }
        if (modeTime > 1.35) switchMode(resumeMode);
      }
      let gathered = 0;
      // Keep collection order stable for leaves reaching the pile together.
      for (let i = movingFloor.size ? floor.length - 1 : -1; i >= 0; i--) {
        const f = floor[i];
        if (!movingFloor.has(f)) continue;
        if (f.guided && f.guideDelay > 0) f.guideDelay -= dt;
        else if (f.guided) {
          const factor = 1 - Math.exp(-dt * 8);
          f.vx += ((center.x - f.x) * 3.25 - f.vx) * factor;
          f.vy += ((center.y - f.y) * 3.25 - f.vy) * factor;
          f.turn += dt * f.spin * 1.5;
        }
        const moving = f.guided || Math.abs(f.vx) + Math.abs(f.vy) > .002;
        if (!moving) {
          movingFloor.delete(f);
          markGround(f);
          continue;
        }
        f.x = clamp(f.x + f.vx * dt, .008, .992);
        f.y = clamp(f.y + f.vy * dt, .45, .984);
        if (!f.guided) {
          const friction = Math.exp(-dt * 4.3);
          f.vx *= friction; f.vy *= friction;
        }
        if (inPile(f.x, f.y)) {
          f.guided = false;
          movingFloor.delete(f);
          floor.splice(i, 1); pile.push(f); gathered++;
        }
      }
      for (let i = air.length - 1; i >= 0; i--) {
        const a = air[i];
        a.vz -= dt * 1.14;
        if (a.vz < -.24) a.vz = -.24;
        const flutter = a.vz < 0 ? .029 : .009;
        a.x += (a.vx + Math.cos(time * 5.8 + a.phase) * flutter) * dt;
        a.y += a.vy * dt;
        a.vx *= Math.exp(-dt * 1.42); a.vy *= Math.exp(-dt * .95);
        a.z += a.vz * dt; a.turn += a.spin * dt;
        if (a.z <= 0) {
          air.splice(i, 1);
          a.x = clamp(a.x, .01, .99); a.y = clamp(a.y, .47, .98);
          a.vx *= .23; a.vy *= .23; a.z = 0;
          if (inPile(a.x, a.y)) { pile.push(a); gathered++; }
          else { floor.push(a); movingFloor.add(a); }
        }
      }
      if (gathered) changed();
      for (const b of breeze) {
        b.x += dt * (.018 + .017 * Math.sin(time * b.swing + b.phase));
        b.y += b.speed * dt;
        b.turn += b.spin * dt;
        if (b.y > .56 + b.swing * .15 || b.x > 1.04) {
          // Windblown leaves become rakeable when they touch a previously cleared lawn.
          if (floor.length < 112 && floor.length + pile.length + air.length < 760 &&
              b.x > .02 && b.x < .98 && !inPile(b.x, b.y)) {
            const landed = { ...b, vx: 0, vy: 0, vz: 0, z: 0, guided: false };
            floor.push(landed);
            markGround(landed);
          }
          b.y = between(-.16, -.035); b.x = between(-.04, .98);
        }
      }
    }
    function render() {
      if (!rakePoint) return;
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      for (const b of breeze) {
        ctx.globalAlpha = .63 + b.swing * .26;
        pxLeaf(ctx, b, b.x * W + Math.sin(time * 2.3 + b.phase) * 3, b.y * H, b.scale * .62,
          b.turn, .35 + Math.abs(Math.sin(time * 2.1 + b.phase)) * .65, .73);
      }
      ctx.globalAlpha = 1;
      drawFloor();
      for (const a of air) if (a.z < .24) {
        const fade = clamp(1 - a.z / .24, 0, 1);
        oval(ctx, a.x * W - a.z * 35, a.y * H, 4.3 * a.scale, 1.4, 'rgba(60,42,28,' + (.16 * fade) + ')');
      }
      drawMound();
      const restY = center.y * H - mound * .42;
      if (mode === 'jump') {
        const t = clamp(modeTime / .83, 0, 1), smooth = t * t * (3 - 2 * t);
        const x = (jumpStart.x * (1 - smooth) + center.x * smooth) * W;
        const y = jumpStart.y * H * (1 - smooth) + restY * smooth - Math.sin(t * Math.PI) * H * .265;
        oval(ctx, x, center.y * H + 1, 9 - Math.sin(t * Math.PI) * 3, 2, 'rgba(54,37,25,.16)');
        character(x, y, 'jump', t);
      }
      if (mode === 'rest' || mode === 'toss') {
        const x = center.x * W, y = restY + (contact * 2);
        ctx.save();
        // Resting diagonally lets the outstretched body settle against the slope.
        ctx.translate(x, y);
        ctx.rotate(-.57);
        character(0, 0, mode, modeTime);
        ctx.restore();
        // A few leaves across the lap visibly tuck the player inside the pile.
        for (let i = 0; i < Math.min(13, pile.length); i++) {
          const f = pile[i], across = ((i * 13) % 21) - 10;
          pxLeaf(ctx, f, x + across, y + 4 + Math.sin(i) * 3, f.scale * .63, f.turn, 1, .77);
        }
      }
      if (mode === 'rake') drawRake();
      for (const a of air) {
        const x = a.x * W, y = (a.y - a.z) * H;
        const flip = .28 + Math.abs(Math.sin(time * (4 + Math.abs(a.spin)) + a.phase)) * .72;
        const closeness = 1 + (a.towardCamera || 0) * Math.min(1.6, a.z * 3.2);
        pxLeaf(ctx, a, x, y, a.scale * (1.02 + a.z * .48) * closeness, a.turn, flip, .97);
      }
    }
    function frame(now) {
      pointerBounds = null;
      if (destroyed) return;
      if (!paused) {
        const elapsed = lastTime ? Math.min(.25, (now - lastTime) / 1000) : .016;
        const steps = Math.max(1, Math.ceil(elapsed / .04));
        for (let i = 0; i < steps; i++) advance(elapsed / steps);
        render();
      }
      lastTime = now;
      frameId = requestAnimationFrame(frame);
    }
    function setPaused(next) {
      paused = Boolean(next);
      if (paused) press = undefined;
      lastTime = 0;
    }
    function destroy() {
      destroyed = true; cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      for (const [event, fn] of Object.entries(listeners)) canvas.removeEventListener(event, fn);
    }
    resize(); reset();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    frameId = requestAnimationFrame(frame);
    return { rake, sweep: sweepNearby, jump, toss, angel, reset, setPaused, destroy };
  }
  window.createLeafGame = createLeafGame;
})();
