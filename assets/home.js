// Portada: el bucle NeverEnding. Lo usan index.qmd y es/index.qmd (estilos en styles.scss).
//
//  · Auryn gira según lo que bajas, con inercia: si dejas de bajar sigue girando un poco y
//    frena suave, y mientras está a la vista gira muy despacio por sí solo.
//  · Debajo de Auryn se añade una copia del principio de la página (vídeo + comienzo de la
//    presentación). Cuando esa copia llega justo a donde está el principio, la página salta
//    arriba en el mismo fotograma: como se ve exactamente lo mismo, no se nota y la web
//    vuelve a empezar, como la historia interminable.
//  · No se guarda ninguna posición calculada de antemano: todo se mide en el momento, así que
//    da igual que las fotos o las fuentes tarden en cargar.
//  · Con "reducir movimiento" activado en el sistema no hay bucle ni giro.
(() => {
  "use strict";
  const section = document.querySelector(".person-auryn-loop");
  const zone = section && section.querySelector(".auryn-zone");
  const stage = section && section.querySelector(".auryn-stage");
  const wheel = section && section.querySelector(".auryn-wheel");
  const hero = document.querySelector(".hero-video");
  const story = document.querySelector(".person-story-wrap");
  if (!section || !zone || !stage || !wheel || !hero || !story) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DEG_PER_PX = 0.3;      // grados de giro por cada píxel que bajas
  const IDLE_DEG_PER_S = 5;    // giro lento en reposo
  const INERTIA_S = 0.45;      // cuánto tarda en alcanzar el giro del scroll (más = más inercia)

  // ── Aparición: Auryn entra desde abajo, de transparente y algo pequeño a su tamaño ──
  function updateEntrance() {
    const r = stage.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh - (r.top + r.height / 2)) / (vh * 0.45)));
    stage.style.opacity = (0.96 * p).toFixed(3);
    stage.style.transform = `scale(${(0.86 + 0.14 * p).toFixed(3)})`;
  }

  if (reduceMotion) {
    // sin bucle ni giro: solo aparece al llegar
    window.addEventListener("scroll", updateEntrance, { passive: true });
    updateEntrance();
    return;
  }

  // ── Copia del principio de la página, para volver a él sin costura ──
  const heroVideo = hero.querySelector("video");
  const returnBlock = document.createElement("div");
  returnBlock.className = "neverending-return";
  returnBlock.setAttribute("aria-hidden", "true");
  returnBlock.setAttribute("inert", "");
  const heroCopy = hero.cloneNode(true);
  returnBlock.append(heroCopy, story.cloneNode(true));
  section.after(returnBlock);

  // el vídeo de la copia solo se reproduce cuando se ve
  const videoCopy = heroCopy.querySelector("video");
  if (videoCopy) {
    videoCopy.muted = true;
    videoCopy.removeAttribute("autoplay");
    videoCopy.pause();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) videoCopy.play().catch(() => {});
        else videoCopy.pause();
      }).observe(heroCopy);
    }
  }

  // Si la copia ya está donde estaba el principio, salta arriba (mismo encuadre, mismo fotograma)
  function loopBack() {
    const period = heroCopy.getBoundingClientRect().top - hero.getBoundingClientRect().top;
    if (period <= 0 || window.scrollY < period) return false;
    if (heroVideo && videoCopy) {
      try { heroVideo.currentTime = videoCopy.currentTime; } catch (e) { /* sin sincronizar */ }
      heroVideo.play().catch(() => {});
    }
    window.scrollTo({ top: window.scrollY - period, behavior: "instant" });
    return true;
  }

  // ── Giro ──
  let target = 0;        // giro que pide el scroll (y el reposo)
  let shown = 0;         // giro que se ve (persigue a target con inercia)
  let lastY = window.scrollY;
  let lastT = 0;
  let running = false;
  let visible = false;

  function frame(t) {
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    if (visible) target += IDLE_DEG_PER_S * dt;
    shown += (target - shown) * (1 - Math.exp(-dt / INERTIA_S));
    wheel.style.transform = `rotate(${(shown % 360).toFixed(2)}deg)`;
    updateEntrance();
    if (visible || Math.abs(target - shown) > 0.05) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      lastT = 0;
    }
  }

  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    target += (y - lastY) * DEG_PER_PX;
    lastY = loopBack() ? window.scrollY : y;   // el salto no cuenta como giro
    if (visible) wake();
  }, { passive: true });

  // El bucle de animación solo funciona mientras Auryn está cerca de la pantalla
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !running) {
        shown = target;    // fuera de la vista no se ha movido: empieza donde toca, sin acelerón
        wake();
      }
    }, { rootMargin: "25% 0px" }).observe(zone);
  } else {
    visible = true;
    wake();
  }
  updateEntrance();
})();
