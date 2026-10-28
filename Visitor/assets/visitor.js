// Visitor: mapa de los lugares a los que me ha llevado la investigación y diario de viaje.
// Los datos los prepara Visitor/_scripts/visitor.R a partir del CV (están en #visitor-data).
// Lo usan Visitor/Visitor.qmd y es/Visitor/Visitor.qmd. El mapa necesita d3 y topojson
// (se cargan desde jsDelivr); si no llegan, la página sigue funcionando sin mapa.
// El mundo se repite hacia los lados: se puede arrastrar sin fin (neverending).
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('visitor-data').textContent);
  const ui = data.ui;
  const root = document.querySelector('.vz');
  const $ = (sel) => root.querySelector(sel);
  const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  const plain = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent; };
  const locale = data.lang === 'es' ? 'es-ES' : 'en-GB';
  const num = new Intl.NumberFormat(locale);
  const num1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const KINDS = ['congress', 'visit', 'talk'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = window.matchMedia('(min-width: 980px)');
  const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
  const EARTH_KM = 40075;

  const places = new Map(data.places.map((p) => [p.id, p]));
  const home = data.places.find((p) => p.home) || data.places[0];
  const events = data.events.map((e) => {
    const years = [].concat(e.years);
    return { ...e, years, first: Math.min(...years), year: Math.floor(e.sort / 100), items: e.items || [] };
  });
  const minYear = Math.min(...events.map((e) => e.first));
  const maxYear = Math.max(...events.map((e) => e.year));
  const state = { kinds: new Set(KINDS), year: maxYear, selected: null };

  const matchesKind = (e) => state.kinds.has(e.kind);
  const shown = (e) => matchesKind(e) && e.first <= state.year;
  const visits = (n) => fmt(n === 1 ? ui.n_one : ui.n_many, { n: num.format(n) });
  const placeName = (p) => (p ? `${p.name}, ${p.country}` : '');

  // Lugares con algo visible: id → méritos
  function groups() {
    const m = new Map();
    events.forEach((e) => {
      if (!e.place || !shown(e)) return;
      if (!m.has(e.place)) m.set(e.place, []);
      m.get(e.place).push(e);
    });
    return m;
  }

  function distanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  // ── Cifras del título ──────────────────────────────────────────────────────
  const statEls = {};
  root.querySelectorAll('[data-stat]').forEach((el) => { statEls[el.dataset.stat] = el; });

  function tween(el, to) {
    const from = Number(el.dataset.n) || 0;
    el.dataset.n = to;
    if (reduceMotion || from === to) { el.textContent = num.format(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 700);
      el.textContent = num.format(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderStats() {
    const g = groups();
    const ids = [...g.keys()];
    // ida y vuelta desde casa; lo que coincide en una ciudad el mismo año cuenta como un solo viaje
    let km = 0;
    g.forEach((evs, id) => {
      if (id !== home.id) km += 2 * distanceKm(home, places.get(id)) * new Set(evs.map((e) => e.year)).size;
    });
    km = Math.round(km / 100) * 100;
    tween(statEls.cities, ids.length);
    tween(statEls.countries, new Set(ids.map((id) => places.get(id).country)).size);
    tween(statEls.km, km);
    statEls.km.title = fmt(ui.laps, { n: num1.format(km / EARTH_KM) });
  }

  // ── Leyenda: qué se ve en el mapa ──────────────────────────────────────────
  root.querySelectorAll('.vz-key').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.kind;
      if (state.kinds.has(k)) state.kinds.delete(k);
      else state.kinds.add(k);
      b.setAttribute('aria-pressed', String(state.kinds.has(k)));
      update();
      renderLog();
    });
  });

  // ── Viaje en el tiempo ─────────────────────────────────────────────────────
  const yearInput = $('.vz-year');
  const yearOut = $('.vz-year-out');
  const playBtn = $('.vz-play');
  const PLAY = playBtn.innerHTML;
  const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  let playing = null;

  yearInput.min = minYear;
  yearInput.max = maxYear;

  function setYear(y) {
    state.year = y;
    yearInput.value = y;
    yearInput.setAttribute('aria-valuetext', fmt(ui.until, { y }));
    yearOut.textContent = y < maxYear ? `${minYear}–${y}` : `${minYear}–${maxYear}`;
    update();
  }

  function stop() {
    clearInterval(playing);
    playing = null;
    playBtn.innerHTML = PLAY;
    playBtn.setAttribute('aria-label', ui.play);
    playBtn.title = ui.play;
  }

  playBtn.addEventListener('click', () => {
    if (playing) return stop();
    if (map && map.calm) map.calm();
    if (state.year >= maxYear) setYear(minYear);
    playBtn.innerHTML = PAUSE;
    playBtn.setAttribute('aria-label', ui.pause);
    playBtn.title = ui.pause;
    playing = setInterval(() => (state.year >= maxYear ? stop() : setYear(state.year + 1)), reduceMotion ? 900 : 1500);
  });
  yearInput.addEventListener('input', () => { stop(); setYear(Number(yearInput.value)); });

  // ── Tarjeta de un lugar ────────────────────────────────────────────────────
  const stage = $('.vz-stage');
  const panel = $('.vz-panel');
  const LETTER = { congress: 'C', visit: 'V', talk: 'T' };   // como los marcadores del mapa antiguo

  function eventHtml(e) {
    const items = e.items.map((it) =>
      `<li>${it.type ? `<span class="vz-ev-type">${it.type}</span>` : ''}<span class="vz-ev-text">${it.text}</span></li>`).join('');
    return `<li class="vz-ev">
      ${e.logo ? `<img class="vz-ev-logo" src="${e.logo}" alt="" loading="lazy">`
        : `<span class="vz-ev-logo vz-ev-logo--none vz-ev-logo--${e.kind}" aria-hidden="true">${LETTER[e.kind]}</span>`}
      <div class="vz-ev-body">
        <p class="vz-ev-when"><i class="vz-dot vz-dot--${e.kind}" aria-hidden="true"></i>${ui[`kind_${e.kind}`]} · ${e.date}</p>
        <strong class="vz-ev-title">${e.title}</strong>
        ${e.org ? `<span class="vz-ev-org">${e.org}</span>` : ''}
        ${e.role || e.tag ? `<span class="vz-ev-org">${[e.role, e.tag].filter(Boolean).join(' · ')}</span>` : ''}
        ${e.award ? `<span class="vz-ev-award"><span aria-hidden="true">🏆</span> ${e.award}</span>` : ''}
        ${items ? `<ul class="vz-ev-items">${items}</ul>` : ''}
      </div>
    </li>`;
  }

  function renderPanel() {
    const p = places.get(state.selected);
    const evs = p ? events.filter((e) => e.place === p.id && shown(e)) : [];
    if (!p || !evs.length) { closePanel(); return; }
    const years = evs.flatMap((e) => e.years);
    const span = [...new Set([Math.min(...years), Math.max(...years)])].join('–');
    const meta = [p.country, visits(evs.length), span].join(' · ');
    panel.innerHTML = `<div class="vz-panel-head">
        <div><h2 class="vz-panel-city">${p.name}${p.home ? ` <span class="vz-panel-home">(${ui.home})</span>` : ''}</h2><p class="vz-panel-meta">${meta}</p></div>
        <button type="button" class="vz-panel-close" aria-label="${ui.close}" title="${ui.close}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div><ol class="vz-panel-list">${evs.map(eventHtml).join('')}</ol>`;
    panel.querySelector('.vz-panel-close').addEventListener('click', () => closePanel(true));
    if (panel.hidden) {
      panel.hidden = false;
      stage.classList.add('has-panel');
      requestAnimationFrame(() => panel.classList.add('is-open'));
      if (map && map.layoutChanged) map.layoutChanged();
    }
    panel.scrollTop = 0;
  }

  function select(id, opts = {}) {
    state.selected = id;
    renderPanel();
    if (map) map.focus(id, opts);
  }

  function closePanel(refocus = false) {
    if (state.selected === null && panel.hidden) return;
    const was = state.selected;
    state.selected = null;
    panel.classList.remove('is-open');
    panel.hidden = true;
    stage.classList.remove('has-panel');
    if (map) {
      map.draw();
      if (map.layoutChanged) map.layoutChanged();
      if (refocus) map.focusPin(was);
    }
  }
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && state.selected) closePanel(true); });

  // ── Diario de viaje ────────────────────────────────────────────────────────
  const logList = $('.vz-log-list');

  function summary(e) {
    if (e.kind !== 'congress') return plain(e.items[0] ? e.items[0].text : '');
    const counts = new Map();
    e.items.forEach((it) => counts.set(it.type, (counts.get(it.type) || 0) + 1));
    return [...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(' · ') || e.tag || '';
  }

  function renderLog() {
    const byYear = new Map();
    events.filter(matchesKind).forEach((e) => {
      if (!byYear.has(e.year)) byYear.set(e.year, []);
      byYear.get(e.year).push(e);
    });
    logList.innerHTML = [...byYear].map(([y, evs]) => `<section class="vz-log-year">
        <h3>${y}</h3>
        <ol>${evs.map((e) => {
          const p = places.get(e.place);
          const when = e.date.replace(String(y), '').replace(/\s+/g, ' ').trim();
          const tag = p ? 'button' : 'div';
          return `<li><${tag} class="vz-row"${p ? ` type="button" data-place="${p.id}" title="${ui.see_map}"` : ''}>
            <span class="vz-row-when">${when}</span>
            <span class="vz-row-main">
              <span class="vz-row-title">${plain(e.title)}${e.award ? ' <span aria-hidden="true">🏆</span>' : ''}</span>
              <span class="vz-row-meta"><i class="vz-dot vz-dot--${e.kind}" aria-hidden="true"></i>${ui[`kind_${e.kind}`]} · ${p ? p.name : `<em>${e.online ? ui.online : e.where}</em>`}${summary(e) ? ` · ${summary(e)}` : ''}</span>
            </span>
            ${p ? '<span class="vz-row-go" aria-hidden="true">→</span>' : ''}
          </${tag}></li>`;
        }).join('')}</ol>
      </section>`).join('');
  }

  logList.addEventListener('click', (ev) => {
    const row = ev.target.closest('button.vz-row');
    if (!row) return;
    stop();
    if (state.year < maxYear) setYear(maxYear);
    stage.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => select(row.dataset.place, { fly: true }), reduceMotion ? 0 : 450);
  });

  // ── Mapa: lo común a las dos vistas (mapa plano y globo) ───────────────────
  let map = null;
  const mapEl = $('.vz-map');
  const hintEl = $('.vz-hint');
  const zoomInput = $('.vz-zoom');
  const dragText = $('.vz-drag-text');
  const rad = Math.PI / 180;
  const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const radius = (n) => (wide.matches ? 8 : 7) + 3 * Math.sqrt(n);
  const worlds = {};
  const loadWorld = (res) => {
    worlds[res] = worlds[res] || window.d3.json(`https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-${res}.json`);
    return worlds[res];
  };
  let hintTimer = null;

  function hint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove('is-on'), 1600);
  }

  // La rueda solo hace zoom con Ctrl (o ⌘), para que la página se pueda bajar
  function zoomFilter(ev) {
    if (ev.type === 'wheel') {
      if (ev.ctrlKey || ev.metaKey) return true;
      hint(ui.wheel_hint);
      return false;
    }
    return !ev.ctrlKey && !ev.button;
  }

  // Zona del mapa que no tapan el menú, los controles, el título ni la tarjeta (coordenadas del svg)
  function viewBox(W, H) {
    const m = mapEl.getBoundingClientRect();
    let x0 = 20, y0 = 20, x1 = W - 20, y1 = H - 20;
    const header = document.getElementById('quarto-header');
    if (header) y0 = Math.max(y0, header.getBoundingClientRect().bottom - m.top + 16);
    [$('.vz-controls'), wide.matches && !state.selected ? $('.vz-hero') : null].forEach((el) => {
      if (el) y1 = Math.min(y1, el.getBoundingClientRect().top - m.top - 16);
    });
    if (!wide.matches) y0 = Math.max(y0, $('.vz-hero').getBoundingClientRect().bottom - m.top + 12);
    if (!panel.hidden) {
      const r = panel.getBoundingClientRect();
      if (wide.matches) x1 = Math.min(x1, r.left - m.left - 28);
      else y1 = Math.min(y1, r.top - m.top - 16);
    }
    if (x1 - x0 < 120) { x0 = 20; x1 = W - 20; }
    if (y1 - y0 < 120) { y0 = 20; y1 = H - 20; }
    return [[x0, y0], [x1, y1]];
  }

  // Avance de la ruta de cada lugar (0–1): las rutas nuevas crecen desde casa.
  // Devuelve true si alguna está aún creciendo.
  function syncProgress(progress, g) {
    g.forEach((_, id) => { if (!progress.has(id)) progress.set(id, reduceMotion || id === home.id ? 1 : 0); });
    [...progress.keys()].forEach((id) => { if (!g.has(id)) progress.delete(id); });
    return [...progress.values()].some((v) => v < 1);
  }

  function growRoutes(progress, redraw) {
    let busy = true;
    const timer = window.d3.timer(() => {
      busy = false;
      progress.forEach((v, id) => { if (v < 1) { progress.set(id, Math.min(1, v + 0.02)); busy = true; } });
      redraw();
      if (!busy) timer.stop();
    });
    return timer;
  }

  // Rutas desde casa; offsets = desplazamientos en x de cada copia del mundo.
  // Cada ruta lleva debajo un trazo claro para que se vea igual sobre el mar que sobre tierra.
  function drawRoutes(gArcs, arcs, offsets) {
    const d3 = window.d3;
    gArcs.selectAll('g.vz-copy').data(offsets).join('g').attr('class', 'vz-copy')
      .attr('transform', (dx) => `translate(${dx},0)`)
      .selectAll('g.vz-route').data(arcs, (a) => a.id).join((enter) => {
        const route = enter.append('g').attr('class', 'vz-route');
        route.append('path').attr('class', 'vz-arc-halo');
        route.append('path').attr('class', 'vz-arc');
        return route;
      })
      .classed('is-selected', (a) => a.id === state.selected)
      .selectAll('path').attr('d', function () { return d3.select(this.parentNode).datum().d || ''; });
  }

  // Casa, cuando no tiene marcador propio (porque ahí no se ve nada con los filtros)
  function drawHome(gArcs, xy) {
    gArcs.selectAll('circle').data(xy ? [xy] : []).join('circle')
      .attr('class', 'vz-home-dot').attr('r', 4).attr('cx', (d) => d[0]).attr('cy', (d) => d[1]);
  }

  // Marcadores: pts = [{ id, p, evs, x, y, grow }]. Los que se solapan se juntan en un grupo.
  function drawPins(gPins, pts, W, activate) {
    const d3 = window.d3;
    pts.forEach((pt) => { pt.r = radius(pt.evs.length); });
    pts.sort((a, b) => b.evs.length - a.evs.length);
    const clusters = [];
    pts.forEach((pt) => {
      const c = clusters.find((cl) => Math.hypot(cl.x - pt.x, cl.y - pt.y) < cl.members[0].r + pt.r + 4);
      if (c) c.members.push(pt);
      else clusters.push({ x: pt.x, y: pt.y, members: [pt] });
    });
    clusters.forEach((c) => {
      c.key = c.members.map((m) => m.id).sort().join('+');
      c.evs = c.members.flatMap((m) => m.evs);
      c.r = radius(c.evs.length);
      c.lead = c.members[0].p;
      c.single = c.members.length === 1;
      c.grow = Math.min(...c.members.map((m) => m.grow));
      c.home = c.members.some((m) => m.p.home);
      c.label = c.single ? c.lead.name : fmt(ui.cluster, { name: c.lead.name, n: c.members.length - 1 });
    });
    // Las etiquetas que chocan con otro marcador u otra etiqueta solo se ven al pasar por encima
    const boxes = [];
    const free = (c, box) =>
      box[0] > 0 && box[2] < W &&
      !clusters.some((o) => o !== c &&
        (Math.max(box[0], Math.min(o.x, box[2])) - o.x) ** 2 + (Math.max(box[1], Math.min(o.y, box[3])) - o.y) ** 2 < (o.r + 3) ** 2) &&
      !boxes.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]);
    clusters.forEach((c) => {
      const w = c.label.length * 7.5 + 4;
      const right = [c.x + c.r + 7, c.y - 9, c.x + c.r + 7 + w, c.y + 9];
      const left = [c.x - c.r - 7 - w, c.y - 9, c.x - c.r - 7, c.y + 9];
      const box = [right, left].find((b) => free(c, b));
      c.left = box ? box === left : c.x > W - 150;
      c.labelOn = Boolean(box);
      if (box) boxes.push(box);
    });

    const arcGen = d3.arc();
    const pie = d3.pie().sort(null).value((d) => d.n);
    gPins.selectAll('g.vz-pin').data(clusters, (c) => c.key).join((enter) => {
      const pin = enter.append('g').attr('class', 'vz-pin').attr('tabindex', 0).attr('role', 'button');
      const body = pin.append('g').attr('class', 'vz-pin-body');
      body.append('circle').attr('class', 'vz-pin-ring');
      body.append('g').attr('class', 'vz-pin-pie');
      body.append('circle').attr('class', 'vz-pin-core');
      body.append('text').attr('class', 'vz-pin-n').attr('dy', '0.35em');
      pin.append('text').attr('class', 'vz-pin-label').attr('dy', '0.35em');
      pin.on('click', (ev, c) => { ev.stopPropagation(); activate(c); })
        .on('keydown', (ev, c) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(c); } });
      return pin;
    }).each(function (c) {
      const pin = d3.select(this);
      const counts = KINDS.map((k) => ({ k, n: c.evs.filter((e) => e.kind === k).length })).filter((d) => d.n);
      const selected = c.single && c.lead.id === state.selected;
      const grow = c.grow >= 1 ? 1 : Math.max(0, (c.grow - 0.75) / 0.25);
      pin.attr('transform', `translate(${c.x},${c.y})`)
        .classed('is-cluster', !c.single).classed('is-home', c.home).classed('is-selected', selected)
        .classed('is-label-off', !c.labelOn && !selected)
        .attr('aria-label', `${c.single ? placeName(c.lead) : c.label}: ${visits(c.evs.length)}`)
        .attr('aria-pressed', c.single ? String(selected) : null);
      pin.select('.vz-pin-body').attr('transform', `scale(${grow < 1 ? d3.easeBackOut(grow) : 1})`).style('opacity', grow ? 1 : 0);
      pin.select('.vz-pin-ring').attr('r', c.r + 3.5);
      pin.select('.vz-pin-pie').selectAll('path').data(pie(counts)).join('path')
        .attr('class', (d) => `vz-fill--${d.data.k}`)
        .attr('d', (d) => arcGen({ ...d, innerRadius: c.r * 0.56, outerRadius: c.r }));
      pin.select('.vz-pin-core').attr('r', c.r * 0.56);
      pin.select('.vz-pin-n').text(c.evs.length).style('font-size', `${Math.max(10, c.r * 0.7)}px`);
      pin.select('.vz-pin-label').text(c.label)
        .attr('x', c.left ? -(c.r + 7) : c.r + 7).attr('text-anchor', c.left ? 'end' : 'start')
        .style('opacity', grow);
    });
  }

  function focusPinIn(gPins, id) {
    gPins.selectAll('g.vz-pin').filter((c) => c.members.some((m) => m.id === id)).each(function () { this.focus(); });
  }

  // Lienzo y capa de marcadores de una vista; se quitan al cambiar de vista
  function surface() {
    const canvas = document.createElement('canvas');
    canvas.className = 'vz-canvas';
    mapEl.prepend(canvas);
    const svg = window.d3.select(mapEl).append('svg').attr('class', 'vz-svg');
    return { canvas, ctx: canvas.getContext('2d'), svg, gArcs: svg.append('g').attr('class', 'vz-arcs'), gPins: svg.append('g').attr('class', 'vz-pins') };
  }

  function sizeSurface(s, W, H) {
    const dpr = window.devicePixelRatio || 1;
    s.canvas.width = Math.round(W * dpr);
    s.canvas.height = Math.round(H * dpr);
    s.svg.attr('viewBox', [0, 0, W, H]).attr('width', W).attr('height', H);
  }

  function themeColors(names) {
    const cs = getComputedStyle(root);
    const out = {};
    names.forEach((n) => { out[n] = cs.getPropertyValue(`--vz-${n}`).trim(); });
    return out;
  }

  // ── Vista «mapa»: el mundo se repite hacia los lados y se arrastra sin fin ──
  function createFlat() {
    const d3 = window.d3;
    const LAT_TOP = 83;      // el mapa va de Groenlandia…
    const LAT_BOTTOM = -57;  // …al cabo de Hornos (sin la Antártida)
    const K_MAX = 40;
    const ac = new AbortController();
    let alive = true;
    const { canvas, ctx, svg, gArcs, gPins } = surface();
    let W = 0, H = 0, projection, kMin = 1;
    let shapes = null, colors = null;
    let transform = d3.zoomIdentity;
    const progress = new Map();
    let timer = null;

    const zoom = d3.zoom().filter(zoomFilter).on('zoom', (ev) => {
      transform = ev.transform;
      paint();
      draw();
      zoomInput.value = Math.log(transform.k / kMin) / Math.log(K_MAX / kMin);
    });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', (ev) => { if (!ev.target.closest('.vz-pin') && state.selected) closePanel(); });
    zoomInput.addEventListener('input', () => {
      svg.call(zoom.scaleTo, kMin * Math.pow(K_MAX / kMin, Number(zoomInput.value)));
    }, { signal: ac.signal });

    // El mundo mide W de ancho a escala 1; en pantalla, W·k, y se repite cada W·k
    const mod = (a, n) => ((a % n) + n) % n;
    const period = () => W * transform.k;
    // Punto del mapa (coordenadas a escala 1) → pantalla, en la copia del mundo más cercana al centro
    function screen(pt) {
      const P = period();
      const x = transform.x + transform.k * pt[0];
      return [x - Math.floor((x - (W - P) / 2) / P) * P, transform.y + transform.k * pt[1]];
    }
    // La copia de un punto más cercana a lo que se está viendo (para no dar la vuelta al mundo)
    function nearX(x) {
      const cx = (W / 2 - transform.x) / transform.k;
      return x + Math.round((cx - x) / W) * W;
    }
    const zoomed = () => d3.geoMercator()
      .scale(projection.scale() * transform.k)
      .translate([projection.translate()[0] * transform.k + transform.x, projection.translate()[1] * transform.k + transform.y]);

    function layout() {
      W = mapEl.clientWidth;
      H = mapEl.clientHeight;
      sizeSurface({ canvas, svg }, W, H);
      const s = W / (2 * Math.PI);
      const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
      projection = d3.geoMercator().scale(s).translate([W / 2, s * y(LAT_TOP)]);
      const worldH = s * (y(LAT_TOP) - y(LAT_BOTTOM));
      kMin = Math.max(1, H / worldH);
      zoom.scaleExtent([kMin, K_MAX]).extent([[0, 0], [W, H]])
        .translateExtent([[-Infinity, 0], [Infinity, worldH]]);   // sin límite hacia los lados
      if (shapes) buildShapes(shapes.world);
    }

    function buildShapes(world) {
      const path = d3.geoPath(projection);
      const obj = world.objects.countries;
      const countries = topojson.feature(world, obj);
      countries.features = countries.features.filter((f) => f.id !== '010');   // sin la Antártida
      shapes = {
        world,
        land: new Path2D(path(countries)),
        coast: new Path2D(path(topojson.mesh(world, obj, (a, b) => a === b))),
        borders: new Path2D(path(topojson.mesh(world, obj, (a, b) => a !== b))),
      };
      paint();
    }

    // Continentes: tres copias del mundo, una junto a otra, para que no se acabe nunca
    function paint() {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!shapes) return;
      if (!colors) colors = themeColors(['land', 'coast', 'border']);
      const { k, y } = transform;
      const P = period();
      const x0 = mod(transform.x, P);
      for (let i = -1; i <= 1; i++) {
        const x = x0 + i * P;
        if (x > W || x + P < 0) continue;
        ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
        ctx.fillStyle = colors.land;
        ctx.fill(shapes.land);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.6 / k;
        ctx.strokeStyle = colors.border;
        ctx.stroke(shapes.borders);
        ctx.lineWidth = 0.9 / k;
        ctx.strokeStyle = colors.coast;
        ctx.stroke(shapes.coast);
      }
    }
    const observer = new MutationObserver(() => { colors = null; paint(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Encuadre que muestra esos lugares; si no caben, se centra donde hay más visitas
    function transformFor(pts, maxK, weights = pts.map(() => 1)) {
      const xy = pts.map((p) => { const b = projection([p.lon, p.lat]); return [nearX(b[0]), b[1]]; });
      const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
      const [[vx0, vy0], [vx1, vy1]] = viewBox(W, H);
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
      const pad = 120;
      const fitK = Math.min(maxK, (vx1 - vx0 - pad) / Math.max(bw, 1), (vy1 - vy0 - pad) / Math.max(bh, 1));
      let k = Math.max(kMin, fitK);
      let cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      if (fitK < kMin) {
        if (!wide.matches) k = kMin * 2.2;
        const total = d3.sum(weights);
        cx = d3.sum(xs, (x, i) => x * weights[i]) / total;
        cy = d3.sum(ys, (yy, i) => yy * weights[i]) / total;
      }
      return d3.zoomIdentity.translate((vx0 + vx1) / 2 - k * cx, (vy0 + vy1) / 2 - k * cy).scale(k);
    }

    function go(t, ms = 900) {
      svg.interrupt();
      if (reduceMotion || ms === 0) svg.call(zoom.transform, t);
      else svg.transition().duration(ms).ease(d3.easeCubicInOut).call(zoom.transform, t);
    }

    function fit(ms) {
      const g = groups();
      if (!g.size) return go(transformFor([home], 7), ms);
      go(transformFor([...g.keys()].map((id) => places.get(id)), 7, [...g.values()].map((evs) => evs.length)), ms);
    }

    function draw() {
      const g = groups();
      if (syncProgress(progress, g) && !timer) timer = growRoutes(progress, () => { draw(); if ([...progress.values()].every((v) => v >= 1)) timer = null; });
      const P = period();
      const path = d3.geoPath(zoomed());
      const homeLL = [home.lon, home.lat];
      const homeXY = projection(homeLL);
      const shift = screen(homeXY)[0] - (transform.x + transform.k * homeXY[0]);
      const arcs = [...g.keys()].filter((id) => id !== home.id).map((id) => {
        const p = places.get(id);
        return { id, d: path({ type: 'LineString', coordinates: [homeLL, d3.geoInterpolate(homeLL, [p.lon, p.lat])(progress.get(id))] }) };
      });
      // las rutas se dibujan también en las copias del mundo vecinas, para que siempre lleguen al marcador
      drawRoutes(gArcs, arcs, [shift - P, shift, shift + P]);
      drawHome(gArcs, g.has(home.id) ? null : screen(homeXY));
      drawPins(gPins, [...g].map(([id, evs]) => {
        const p = places.get(id);
        const [x, y] = screen(projection([p.lon, p.lat]));
        return { id, p, evs, x, y, grow: progress.get(id) };
      }), W, activate);
    }

    function activate(c) {
      if (c.single) {
        if (state.selected === c.lead.id) closePanel();
        else select(c.lead.id);
      } else {
        go(transformFor(c.members.map((m) => m.p), Math.min(K_MAX, transform.k * 10)));
      }
    }

    // Lleva un lugar a la zona visible (o se acerca a él, si viene del diario)
    function focus(id, { fly = false } = {}) {
      draw();
      const p = places.get(id);
      if (!p) return;
      const [[vx0, vy0], [vx1, vy1]] = viewBox(W, H);
      const base = projection([p.lon, p.lat]);
      if (fly) {
        const k = Math.max(transform.k, 7);
        go(d3.zoomIdentity.translate((vx0 + vx1) / 2 - k * nearX(base[0]), (vy0 + vy1) / 2 - k * base[1]).scale(k), 1100);
        return;
      }
      const [sx, sy] = screen(base);
      const m = 40;
      if (sx < vx0 + m || sx > vx1 - m || sy < vy0 + m || sy > vy1 - m) {
        go(transform.translate(((vx0 + vx1) / 2 - sx) / transform.k, ((vy0 + vy1) / 2 - sy) / transform.k), 600);
      }
    }

    let lastW = 0;
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (mapEl.clientWidth === lastW && Math.abs(mapEl.clientHeight - H) < 80) return;
        lastW = mapEl.clientWidth;
        layout();
        fit(0);
      }, 150);
    }, { signal: ac.signal });

    layout();
    lastW = W;
    fit(0);
    draw();
    loadWorld('50m').then((w) => {
      if (!alive) return;
      buildShapes(w);
      mapEl.classList.add('is-ready');
    }).catch(() => { if (alive) mapEl.classList.add('is-error'); });

    function destroy() {
      alive = false;
      if (timer) timer.stop();
      svg.interrupt();
      clearTimeout(resizeTimer);
      ac.abort();
      observer.disconnect();
      canvas.remove();
      svg.remove();
    }

    return { draw, fit, focus, focusPin: (id) => focusPinIn(gPins, id), destroy };
  }

  // ── Vista «globo»: se gira en cualquier dirección, también por encima de los polos ──
  function createGlobe() {
    const d3 = window.d3;
    const K_MAX = 12;
    const ac = new AbortController();
    let alive = true;
    const { canvas, ctx, svg, gArcs, gPins } = surface();
    const front = d3.geoOrthographic().precision(0.6);
    const back = d3.geoOrthographic().precision(0.6).reflectX(true);   // la cara de atrás, vista a través del cristal
    const graticule = d3.geoGraticule10();
    let W = 0, H = 0, R0 = 1, k = 1, center = [0, 0];
    let rot = [0, 0, 0];
    const shapes = {};     // '110m' (mientras se mueve) y '50m' (en reposo)
    let colors = null;
    let moving = false, idleTimer = null;
    let spin = null;       // giro lento del principio, hasta que se toca
    const progress = new Map();
    let timer = null;
    let prev = d3.zoomIdentity;

    // Arrastrar gira el globo; el zoom (Ctrl + rueda, pellizco o la barra) lo acerca
    const zoom = d3.zoom().scaleExtent([1, K_MAX]).filter(zoomFilter)
      .on('start', (ev) => { if (ev.sourceEvent) stopSpin(); })
      .on('zoom', (ev) => {
        const t = ev.transform;
        if (Math.abs(t.k - prev.k) > 1e-9) {
          k = t.k;
        } else if (ev.sourceEvent) {
          const f = 1 / (rad * R0 * k);
          const flip = Math.cos(rot[1] * rad) < 0 ? -1 : 1;   // pasado el polo, el globo está del revés
          rot = [rot[0] + (t.x - prev.x) * f * flip, wrap180(rot[1] - (t.y - prev.y) * f), rot[2]];
        }
        prev = t;
        moved();
      });
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', (ev) => { if (!ev.target.closest('.vz-pin') && state.selected) closePanel(); });
    zoomInput.addEventListener('input', () => {
      stopSpin();
      svg.call(zoom.scaleTo, Math.pow(K_MAX, Number(zoomInput.value)));
    }, { signal: ac.signal });

    function syncZoom() {
      prev = d3.zoomIdentity.translate(prev.x, prev.y).scale(k);
      svg.property('__zoom', prev);
    }

    function layout() {
      W = mapEl.clientWidth;
      H = mapEl.clientHeight;
      sizeSurface({ canvas, svg }, W, H);
      const [[, y0], [, y1]] = viewBox(W, H);
      R0 = wide.matches ? Math.min(W, H) * 0.4 : Math.min(W * 0.44, (y1 - y0) * 0.48);
      center = centerTarget();
      zoom.extent([[0, 0], [W, H]]);
    }

    // Centro del globo: en medio de lo que deja libre la tarjeta de un lugar
    function centerTarget() {
      if (wide.matches) {
        if (panel.hidden) return [W / 2, H / 2];
        return [(panel.getBoundingClientRect().left - mapEl.getBoundingClientRect().left) / 2, H / 2];
      }
      const [[, y0], [, y1]] = viewBox(W, H);
      return [W / 2, (y0 + y1) / 2];
    }

    function render() {
      const s = R0 * k;
      front.scale(s).translate(center).rotate(rot);
      back.scale(s).translate(center).rotate([rot[0] + 180, -rot[1], -rot[2]]);
      paint();
      draw();
      zoomInput.value = Math.log(k) / Math.log(K_MAX);
    }

    // Mientras se mueve se dibuja con menos detalle, para que vaya fluido
    function moved() {
      moving = true;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { moving = false; paint(); }, 160);
      render();
    }

    function addWorld(res, w) {
      const obj = w.objects.countries;
      shapes[res] = {
        land: topojson.feature(w, obj),
        borders: topojson.mesh(w, obj, (a, b) => a !== b),
        coast: topojson.mesh(w, obj, (a, b) => a === b),
      };
    }

    function circle(cx, cy, r) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    }

    function paint() {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!colors) colors = themeColors(['land', 'coast', 'border', 'globe-sea', 'globe-back', 'globe-grid', 'globe-glow', 'globe-light', 'globe-shade']);
      const s = R0 * k;
      const [cx, cy] = center;
      // halo alrededor del globo
      const halo = ctx.createRadialGradient(cx, cy, s * 0.96, cx, cy, s * 1.14);
      halo.addColorStop(0, colors['globe-glow']);
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      circle(cx, cy, s * 1.14);
      ctx.fill();
      // el agua
      ctx.fillStyle = colors['globe-sea'];
      circle(cx, cy, s);
      ctx.fill();
      const geo = (moving && shapes['110m']) || shapes['50m'] || shapes['110m'];
      if (geo) {
        const bp = d3.geoPath(back, ctx);
        ctx.beginPath(); bp(geo.land); ctx.fillStyle = colors['globe-back']; ctx.fill();
        const fp = d3.geoPath(front, ctx);
        ctx.beginPath(); fp(graticule); ctx.lineWidth = 0.6; ctx.strokeStyle = colors['globe-grid']; ctx.stroke();
        ctx.beginPath(); fp(geo.land); ctx.fillStyle = colors.land; ctx.fill();
        ctx.lineJoin = 'round';
        ctx.beginPath(); fp(geo.borders); ctx.lineWidth = 0.6; ctx.strokeStyle = colors.border; ctx.stroke();
        ctx.beginPath(); fp(geo.coast); ctx.lineWidth = 0.9; ctx.strokeStyle = colors.coast; ctx.stroke();
      }
      // luz arriba a la izquierda y sombra en el borde, para que parezca una esfera
      const light = ctx.createRadialGradient(cx - s * 0.45, cy - s * 0.5, 0, cx - s * 0.45, cy - s * 0.5, s * 1.3);
      light.addColorStop(0, colors['globe-light']);
      light.addColorStop(1, 'rgba(255, 255, 255, 0)');
      const shade = ctx.createRadialGradient(cx, cy, s * 0.55, cx, cy, s);
      shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
      shade.addColorStop(1, colors['globe-shade']);
      circle(cx, cy, s);
      ctx.fillStyle = light;
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.fill();
    }
    const observer = new MutationObserver(() => { colors = null; paint(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function draw() {
      const g = groups();
      if (syncProgress(progress, g) && !timer) timer = growRoutes(progress, () => { draw(); if ([...progress.values()].every((v) => v >= 1)) timer = null; });
      const path = d3.geoPath(front);
      const homeLL = [home.lon, home.lat];
      const arcs = [...g.keys()].filter((id) => id !== home.id).map((id) => {
        const p = places.get(id);
        return { id, d: path({ type: 'LineString', coordinates: [homeLL, d3.geoInterpolate(homeLL, [p.lon, p.lat])(progress.get(id))] }) };
      });
      drawRoutes(gArcs, arcs, [0]);
      // solo se ven los marcadores de la cara de delante
      const c = front.invert(center);
      const seen = (ll) => d3.geoDistance(ll, c) < Math.PI / 2 - 0.03;
      drawHome(gArcs, !g.has(home.id) && seen(homeLL) ? front(homeLL) : null);
      drawPins(gPins, [...g].filter(([id]) => seen([places.get(id).lon, places.get(id).lat])).map(([id, evs]) => {
        const p = places.get(id);
        const [x, y] = front([p.lon, p.lat]);
        return { id, p, evs, x, y, grow: progress.get(id) };
      }), W, activate);
    }

    // Gira el globo hasta poner ese punto delante (y ajusta el zoom y el centro)
    function turnTo(ll, kTarget = k, ms = 1000) {
      stopSpin();
      const r0 = rot.slice(), k0 = k, c0 = center.slice();
      const r1 = [r0[0] + wrap180(-ll[0] - r0[0]), r0[1] + wrap180(-ll[1] - r0[1]), 0];
      const c1 = centerTarget();
      svg.interrupt('turn');
      if (reduceMotion || !ms) {
        rot = r1; k = kTarget; center = c1;
        syncZoom();
        render();
        return;
      }
      const ir = d3.interpolate(r0, r1), ik = d3.interpolate(k0, kTarget), ic = d3.interpolate(c0, c1);
      svg.transition('turn').duration(ms).ease(d3.easeCubicInOut)
        .tween('turn', () => (t) => { rot = ir(t); k = ik(t); center = ic(t); syncZoom(); moved(); });
    }

    // Punto medio de varios lugares sobre la esfera (ponderado por visitas)
    function centroid(pts, weights) {
      let x = 0, y = 0, z = 0;
      pts.forEach((p, i) => {
        const w = weights ? weights[i] : 1;
        x += w * Math.cos(p.lat * rad) * Math.cos(p.lon * rad);
        y += w * Math.cos(p.lat * rad) * Math.sin(p.lon * rad);
        z += w * Math.sin(p.lat * rad);
      });
      return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad];
    }

    function fit(ms = 1000) {
      const g = groups();
      const ids = [...g.keys()];
      const ll = ids.length ? centroid(ids.map((id) => places.get(id)), ids.map((id) => g.get(id).length)) : [home.lon, home.lat];
      turnTo([ll[0], ll[1] * 0.6], 1, ms);
    }

    function activate(c) {
      if (c.single) {
        if (state.selected === c.lead.id) closePanel();
        else select(c.lead.id);
        return;
      }
      const ps = c.members.map((m) => m.p);
      const ll = centroid(ps);
      const spread = Math.max(...ps.map((p) => d3.geoDistance(ll, [p.lon, p.lat])), 0.002);
      turnTo(ll, Math.max(k * 1.5, Math.min(K_MAX, (Math.min(W, H) * 0.3) / (R0 * Math.sin(spread)))));
    }

    function focus(id, { fly = false } = {}) {
      const p = places.get(id);
      if (p) turnTo([p.lon, p.lat], fly ? Math.max(k, 3) : k, fly ? 1300 : 800);
    }

    function startSpin() {
      if (reduceMotion) return;
      const lon0 = rot[0];
      spin = d3.timer((elapsed) => {
        rot = [lon0 + elapsed * 0.004, rot[1], rot[2]];
        moving = true;
        render();
      });
    }

    function stopSpin() {
      if (!spin) return;
      spin.stop();
      spin = null;
      moving = false;
      render();
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { layout(); render(); }, 150);
    }, { signal: ac.signal });
    svg.on('pointerdown.spin', stopSpin);

    layout();
    fit(0);
    render();
    startSpin();
    loadWorld('110m').then((w) => {
      if (!alive) return null;
      addWorld('110m', w);
      mapEl.classList.add('is-ready');
      paint();
      return loadWorld('50m');
    }).then((w) => {
      if (!alive || !w) return;
      addWorld('50m', w);
      paint();
    }).catch(() => { if (alive && !shapes['110m']) mapEl.classList.add('is-error'); });

    function destroy() {
      alive = false;
      if (spin) spin.stop();
      if (timer) timer.stop();
      svg.interrupt('turn');
      clearTimeout(idleTimer);
      clearTimeout(resizeTimer);
      ac.abort();
      observer.disconnect();
      canvas.remove();
      svg.remove();
    }

    // al darle a ▶ se para el giro y se vuelve a la vista de todo
    const calm = () => { stopSpin(); fit(800); };
    const layoutChanged = () => turnTo(front.invert(center), k, 450);

    return { draw, fit, focus, focusPin: (id) => focusPinIn(gPins, id), destroy, calm, layoutChanged };
  }

  // ── Cambio de vista (mapa / globo) ─────────────────────────────────────────
  const VIEWS = { map: createFlat, globe: createGlobe };
  const viewBtns = [...root.querySelectorAll('.vz-views button')];

  function setView(view) {
    if (map) map.destroy();
    mapEl.classList.remove('is-ready', 'is-error');
    map = VIEWS[view]();
    root.dataset.view = view;
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    dragText.textContent = view === 'globe' ? ui.drag_globe : ui.drag;
    try { localStorage.setItem('vz-view', view); } catch (e) { /* no se recuerda */ }
  }
  viewBtns.forEach((b) => b.addEventListener('click', () => { if (root.dataset.view !== b.dataset.view) setView(b.dataset.view); }));

  // ── Todo junto ─────────────────────────────────────────────────────────────
  function update() {
    renderStats();
    if (state.selected) renderPanel();
    if (map) map.draw();
  }

  mapEl.setAttribute('data-error', ui.map_error);
  if (window.d3 && window.topojson) {
    let saved = null;
    try { saved = localStorage.getItem('vz-view'); } catch (e) { /* sin almacenamiento */ }
    setView(VIEWS[saved] ? saved : 'globe');
  } else {
    mapEl.classList.add('is-error');
  }
  setYear(maxYear);
  renderLog();
})();
