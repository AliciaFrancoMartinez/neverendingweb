// Inicio: el símbolo de Auryn que gira con el scroll y el bucle infinito al final de la página.
// Lo usan index.qmd y es/index.qmd.
(() => {
  const loopSection = document.querySelector('.person-auryn-loop');
  const auryn = document.querySelector('.auryn-wheel');
  const storyCard = document.querySelector('.person-story-card');
  if (!loopSection || !auryn || !storyCard) return;

  const WRAP_MARGIN = 120;
  const AFTER_TEXT_BLANK = 220;
  const LOOP_OFFSET_AFTER_APPEAR = 520;
  const LOOP_SPAN = 2200;
  const ROTATION_TURNS_PER_LOOP = 3;
  let bounds = { startY: 0, appearY: 0, tailStartY: 0, tailEndY: 0 };
  let lastScrollY = window.scrollY;
  let rafId = null;
  let wrapping = false;
  let rotationCarry = 0;

  function topY(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function updateBounds() {
    const startY = topY(loopSection);
    const storyBottomY = topY(storyCard) + storyCard.offsetHeight;
    const appearY = Math.max(startY + 280, storyBottomY + AFTER_TEXT_BLANK);
    const tailStartY = appearY + LOOP_OFFSET_AFTER_APPEAR;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const plannedEndY = tailStartY + LOOP_SPAN;
    const safeEndY = Math.max(tailStartY + 700, maxY - WRAP_MARGIN);
    const tailEndY = Math.min(plannedEndY, safeEndY);
    bounds = { startY, appearY, tailStartY, tailEndY };
  }

  function maybeWrapDownward(currentY) {
    const scrollingDown = currentY > lastScrollY;
    if (!scrollingDown || wrapping) return { y: currentY, carry: 0 };

    if (currentY >= bounds.tailEndY) {
      const resetY = Math.max(bounds.tailStartY + (bounds.tailEndY - bounds.tailStartY) * 0.5, 0);
      wrapping = true;
      loopSection.classList.add('is-wrapping');
      setTimeout(() => {
        window.scrollTo(0, resetY);
        requestAnimationFrame(() => {
          loopSection.classList.remove('is-wrapping');
          setTimeout(() => { wrapping = false; }, 60);
        });
      }, 110);
      return { y: resetY, carry: Math.max(0, bounds.tailEndY - resetY) };
    }
    return { y: currentY, carry: 0 };
  }

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const wrapState = maybeWrapDownward(window.scrollY);
      const y = wrapState.y;
      rotationCarry += wrapState.carry;
      lastScrollY = y;

      const active = y >= bounds.appearY && y <= bounds.tailEndY;
      loopSection.classList.toggle('is-active', active);
      loopSection.classList.toggle('show-wheel', y >= bounds.appearY);

      if (active) {
        const loopLen = Math.max(1, bounds.tailEndY - bounds.tailStartY);
        const relLoop = (y - bounds.tailStartY) + rotationCarry;
        const phase = ((relLoop % loopLen) + loopLen) % loopLen;
        const angle = (phase / loopLen) * (360 * ROTATION_TURNS_PER_LOOP);
        auryn.style.transform = `rotate(${angle}deg)`;
      } else {
        const rel = Math.max(0, y - bounds.startY);
        auryn.style.transform = `rotate(${rel * 0.12}deg)`;
      }
    });
  }

  updateBounds();
  onScroll();
  window.addEventListener('resize', updateBounds);
  window.addEventListener('scroll', onScroll, { passive: true });
})();
