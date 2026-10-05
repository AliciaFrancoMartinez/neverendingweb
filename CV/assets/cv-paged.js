// Ajustes del PDF durante y tras la paginación con Paged.js:
//  1. si una sección continúa en otra página, deja hueco arriba y repite su título
//  2. rellena los números de página del índice de la portada ("p. 4–5")
class CvPagedHandler extends Paged.Handler {
  beforePageLayout(page, content, breakToken) {
    const node = breakToken && breakToken.node;
    if (!node) return;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || el.matches(".cv-section, .cv-sections")) return;
    const section = el.closest(".cv-section");
    if (!section) return;
    page.element.classList.add("cv-continued");
    page.element.dataset.cvSection = section.dataset.section;
  }

  afterRendered() {
    document.querySelectorAll(".pagedjs_page.cv-continued").forEach((page) => {
      const original = document.querySelector(
        `.cv-section[data-section="${page.dataset.cvSection}"] > .cv-section-title`
      );
      const cv = page.querySelector(".cv");
      if (!original || !cv) return;
      const repeat = original.cloneNode(true);
      repeat.classList.add("cv-section-title--repeat");
      cv.prepend(repeat);
    });

    const pagesBySection = {};
    document.querySelectorAll(".pagedjs_page").forEach((page, i) => {
      page.querySelectorAll(".cv-section[data-section]").forEach((section) => {
        (pagesBySection[section.dataset.section] ||= []).push(i + 1);
      });
    });
    document.querySelectorAll(".cv-index-page[data-for]").forEach((el) => {
      const pages = pagesBySection[el.dataset.for];
      if (!pages) return;
      const first = Math.min(...pages);
      const last = Math.max(...pages);
      el.textContent = first === last ? `p. ${first}` : `p. ${first}–${last}`;
    });

    document.body.dataset.cvPaged = "done";
  }
}
Paged.registerHandlers(CvPagedHandler);
