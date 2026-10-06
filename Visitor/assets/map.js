// Visitor: mapa del mundo que se arrastra, se amplía y muestra las tarjetas de cada marcador.
// Lo usan Visitor/Visitor.qmd y es/Visitor/Visitor.qmd.
(() => {
  const stage = document.getElementById('map-stage');
  const pan = document.getElementById('map-pan');
  const zoomInput = document.getElementById('map-zoom');
  const INITIAL_FOCUS_LON = 8;
  const INITIAL_FOCUS_LAT = 50;
  const INITIAL_ZOOM = 2.3;

  let dragging = false;
  let lastClientX = 0;
  let lastClientY = 0;
  let x = 0;
  let y = 0;
  const sliderMin = zoomInput ? Number(zoomInput.min) || 1 : 1;
  const sliderMax = zoomInput ? Number(zoomInput.max) || 4.8 : 4.8;
  const initialZoom = clamp(INITIAL_ZOOM, sliderMin, sliderMax);
  if (zoomInput) zoomInput.value = String(initialZoom);
  let zoom = initialZoom;

  function getClientX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }

  function wrap(value, mod) {
    return ((value % mod) + mod) % mod;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function tileWidth() {
    const tile = pan.querySelector('.map-tile');
    return tile ? (tile.offsetWidth || tile.getBoundingClientRect().width) : 1;
  }

  function tileHeight() {
    const tile = pan.querySelector('.map-tile');
    return tile ? (tile.offsetHeight || tile.getBoundingClientRect().height) : 1;
  }

  function setInitialViewAroundEurope() {
    const w = tileWidth();
    const h = tileHeight();
    const targetX = ((INITIAL_FOCUS_LON + 180) / 360) * w;
    const targetY = ((90 - INITIAL_FOCUS_LAT) / 180) * h;
    x = -zoom * (targetX - w / 2);
    y = -zoom * (targetY - h / 2);
  }

  function render() {
    const w = tileWidth();
    const h = tileHeight();
    const stageRect = stage.getBoundingClientRect();
    const scaledW = w * zoom;
    const scaledH = h * zoom;
    // Center map on viewport midpoint; x/y are pan offsets in screen pixels.
    const baseX = (stageRect.width - scaledW) / 2;
    const baseY = (stageRect.height - scaledH) / 2;
    // Keep marker appearance coherent at all zoom levels (size, stroke, label).
    // Less aggressive than inverse zoom, with a readable floor at max zoom.
    const markerScale = clamp(1 / (1 + 0.85 * Math.max(zoom - 1, 0)), 0.28, 1);
    const cardScale = 1 / Math.max(zoom, 1);
    pan.style.setProperty('--marker-scale', String(markerScale));
    pan.style.setProperty('--card-scale', String(cardScale));
    pan.style.transformOrigin = `0 0`;
    const wrapPeriodX = scaledW;
    const wrappedX = wrap(baseX + x, wrapPeriodX) - wrapPeriodX; // wrap in screen-space period
    const maxY = Math.max(0, (scaledH - stageRect.height) / 2);
    y = clamp(y, -maxY, maxY);
    pan.style.transform = `translate(${wrappedX}px, ${baseY + y}px) scale(${zoom})`;
    updateAllTipPlacements();
  }

  function onDown(e) {
    dragging = true;
    pan.style.cursor = 'grabbing';
    lastClientX = getClientX(e);
    lastClientY = getClientY(e);
  }

  function onMove(e) {
    if (!dragging) return;
    const cx = getClientX(e);
    const cy = getClientY(e);
    x += cx - lastClientX;
    y += cy - lastClientY;
    lastClientX = cx;
    lastClientY = cy;
    render();
  }

  function onUp() {
    dragging = false;
    pan.style.cursor = 'grab';
  }

  pan.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  pan.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onUp);

  function placeMarkerByLatLon(el, lat, lon) {
    const leftPct = ((lon + 180) / 360) * 100;
    const topPct = ((90 - lat) / 180) * 100;
    el.style.setProperty('--left', `${leftPct}%`);
    el.style.setProperty('--top', `${topPct}%`);
  }

  function syncMarkersAcrossTiles() {
    const tiles = Array.from(pan.querySelectorAll('.map-tile'));
    if (tiles.length < 2) return;

    const sourceMarkers = Array.from(tiles[0].querySelectorAll('.marker'));
    tiles.slice(1).forEach((tile) => {
      tile.querySelectorAll('.marker').forEach((m) => m.remove());
      sourceMarkers.forEach((src) => {
        tile.appendChild(src.cloneNode(true));
      });
    });
  }

  function updateTipPlacement(markerEl) {
    const tip = markerEl.querySelector('.tip');
    if (!tip) return;

    const stageRect = stage.getBoundingClientRect();
    const topUiEls = Array.from(document.querySelectorAll('#quarto-header, .navbar, header, nav'));
    let topUiBottom = stageRect.top;
    topUiEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height <= 0) return;
      if (r.bottom <= stageRect.top) return;
      if (r.top > stageRect.top + 180) return;
      topUiBottom = Math.max(topUiBottom, r.bottom);
    });
    // Treat menu/header + border/shadow area as fully unsafe.
    const safeTop = Math.max(stageRect.top + 12, topUiBottom + 32);
    const safeLeft = stageRect.left + 8;
    const safeRight = stageRect.right - 8;
    const safeBottom = stageRect.bottom - 8;
    const safeHeight = Math.max(160, safeBottom - safeTop - 12);
    pan.style.setProperty('--tip-safe-height', `${safeHeight}px`);
    const markerRect = markerEl.getBoundingClientRect();
    const cardScale = Number(getComputedStyle(pan).getPropertyValue('--card-scale')) || 1;
    const tipW = tip.offsetWidth * cardScale;
    const tipH = tip.offsetHeight * cardScale;

    const spaceAbove = markerRect.top - safeTop;
    const spaceBelow = safeBottom - markerRect.bottom;
    const showBelow = (
      (spaceAbove >= tipH) ? false :
      (spaceBelow >= tipH) ? true :
      (spaceBelow > spaceAbove)
    );

    const spaceRight = safeRight - markerRect.left;
    const spaceLeft = markerRect.right - safeLeft;
    const alignRight = spaceRight < tipW && spaceLeft > spaceRight;

    markerEl.dataset.tipV = showBelow ? 'below' : 'above';
    markerEl.dataset.tipH = alignRight ? 'right' : 'left';
  }

  function updateAllTipPlacements() {
    document.querySelectorAll('.marker').forEach(updateTipPlacement);
  }

  syncMarkersAcrossTiles();

  document.querySelectorAll('.marker').forEach((mk) => {
    const lat = Number(mk.dataset.lat);
    const lon = Number(mk.dataset.lon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      placeMarkerByLatLon(mk, lat, lon);
    }

    mk.addEventListener('click', () => {
      const open = mk.getAttribute('aria-expanded') === 'true';
      mk.setAttribute('aria-expanded', String(!open));
      updateTipPlacement(mk);
    });

    mk.addEventListener('mouseenter', () => updateTipPlacement(mk));
    mk.addEventListener('focus', () => updateTipPlacement(mk));
  });

  window.addEventListener('load', render);
  window.addEventListener('resize', render);
  if (zoomInput) {
    zoomInput.addEventListener('input', () => {
      const nextZoom = Number(zoomInput.value) || 1;
      const factor = nextZoom / Math.max(zoom, 0.0001);
      // Keep the map point under viewport center fixed while zooming.
      x *= factor;
      y *= factor;
      zoom = nextZoom;
      render();
    });
  }
  setInitialViewAroundEurope();
  render();
})();
