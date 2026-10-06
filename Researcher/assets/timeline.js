// Researcher: bucle de scroll infinito al final de la línea de tiempo.
// Lo usan Researcher/Researcher.qmd y es/Researcher/Researcher.qmd.
(() => {
  const timeline = document.querySelector('.timeline');
  if (!timeline) return;

  const WRAP_MARGIN = 120;
  const TAIL_START_OFFSET = 48;

  let lastScrollY = window.scrollY;
  let rafId = 0;
  let adjusting = false;
  let tailStartY = 0;
  let tailEndY = 0;

  function docTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function recomputeTailBounds() {
    const items = timeline.querySelectorAll(':scope > .timeline-item');
    if (!items.length) {
      tailStartY = 0;
      tailEndY = 0;
      return;
    }

    const last = items[items.length - 1];
    const lastTop = docTop(last);
    const lastHeight = last.getBoundingClientRect().height || 0;
    const lastBottom = lastTop + lastHeight;

    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    // Start loop only when viewport is already below the last item.
    tailStartY = Math.max(0, lastBottom + TAIL_START_OFFSET);
    tailEndY = Math.max(tailStartY + window.innerHeight, maxY - WRAP_MARGIN);
  }

  function maybeWrapDownward(currentY) {
    if (adjusting) return currentY;
    if (tailEndY <= tailStartY + 120) return currentY;

    const scrollingDown = currentY > lastScrollY;
    if (!scrollingDown) return currentY;

    if (currentY > tailEndY) {
      adjusting = true;
      const overflow = currentY - tailEndY;
      const resetY = tailStartY + overflow;
      window.scrollTo(0, resetY);
      adjusting = false;
      return resetY;
    }

    return currentY;
  }

  function onFrame() {
    recomputeTailBounds();
    const y = maybeWrapDownward(window.scrollY);
    lastScrollY = y;
    rafId = 0;
  }

  function onScroll() {
    if (!rafId) rafId = window.requestAnimationFrame(onFrame);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  recomputeTailBounds();
  onFrame();
})();
