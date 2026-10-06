// CV — interacción de la versión web (pestaña CV):
//  · buscador que filtra todas las entradas (sin tildes, resalta coincidencias)
//  · filtros por grupo/tipo dentro de cada sección
//  · listas largas plegadas con "Show all"
//  · índice lateral que marca la sección visible
//  · aparición suave de las entradas y contadores animados
(() => {
  const root = document.querySelector(".cvw");
  if (!root) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // textos de la interfaz según el idioma de la página (<html lang="es"> en la versión en español)
  const es = document.documentElement.lang.startsWith("es");
  const t = es
    ? { less: "Ver menos", all: (n) => `Ver todo (${n})`, results: (n) => `${n} resultado${n === 1 ? "" : "s"}`, none: "Sin resultados" }
    : { less: "Show less", all: (n) => `Show all ${n}`, results: (n) => `${n} result${n === 1 ? "" : "s"}`, none: "No results" };
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const sections = [...root.querySelectorAll(".cvw-section")];
  const navLinks = new Map([...root.querySelectorAll(".cvw-nav a")].map((a) => [a.hash.slice(1), a]));
  const input = root.querySelector(".cvw-search input");
  const status = root.querySelector(".cvw-search-status");
  const empty = root.querySelector(".cvw-empty");
  let query = "";

  root.querySelectorAll(".cv-entry").forEach((e) => { e.cvText = norm(e.textContent); });

  const matchesFilter = (entry, filter) => {
    if (filter === "all") return true;
    const [kind, value] = filter.split(":");
    if (kind === "group") return entry.closest(".cv-group")?.dataset.group === value;
    if (kind === "type") return (entry.dataset.types || "").split(" ").includes(value);
    return true;
  };

  // Estado de cada sección: filtro activo, límite y si está desplegada
  const state = new Map(sections.map((sec) => {
    const st = { filter: "all", expanded: false, limit: parseInt(sec.dataset.limit || "0", 10) };
    if (st.limit) {
      st.button = document.createElement("button");
      st.button.type = "button";
      st.button.className = "cvw-more";
      st.button.addEventListener("click", () => {
        st.expanded = !st.expanded;
        update();
        if (!st.expanded) sec.scrollIntoView({ block: "start" });
      });
      sec.append(st.button);
    }
    return [sec, st];
  }));

  // Filtros (chips): número de entradas de cada uno y clic
  root.querySelectorAll(".cvw-chips").forEach((group) => {
    const sec = group.closest(".cvw-section");
    const st = state.get(sec);
    const secEntries = [...sec.querySelectorAll(".cv-entry")];
    group.querySelectorAll(".cvw-chip").forEach((chip) => {
      const n = secEntries.filter((e) => matchesFilter(e, chip.dataset.filter)).length;
      chip.querySelector(".cvw-chip-n").textContent = n;
    });
    group.addEventListener("click", (ev) => {
      const chip = ev.target.closest(".cvw-chip");
      if (!chip) return;
      st.filter = chip.dataset.filter;
      group.querySelectorAll(".cvw-chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      update();
    });
  });

  function update() {
    let total = 0;
    sections.forEach((sec) => {
      const st = state.get(sec);
      const [kind, value] = st.filter.split(":");
      let matching = 0;
      sec.querySelectorAll(".cv-entry").forEach((entry) => {
        const ok = (!query || entry.cvText.includes(query)) && matchesFilter(entry, st.filter);
        if (ok) matching++;
        const folded = ok && st.limit && !query && st.filter === "all" && !st.expanded && matching > st.limit;
        entry.hidden = !ok || folded;
      });
      sec.querySelectorAll("[data-type]").forEach((cell) => {
        cell.hidden = kind === "type" && cell.dataset.type !== value;
      });
      sec.querySelectorAll(".cv-group").forEach((g) => {
        g.hidden = !g.querySelector(".cv-entry:not([hidden])");
      });
      sec.classList.toggle("is-filtered", st.filter !== "all");
      sec.hidden = Boolean(query) && matching === 0;

      if (st.button) {
        st.button.hidden = Boolean(query) || st.filter !== "all" || matching <= st.limit;
        st.button.textContent = st.expanded ? t.less : t.all(matching);
      }
      const link = navLinks.get(sec.id);
      if (link) {
        link.classList.toggle("is-empty", Boolean(query) && matching === 0);
        link.querySelector(".cvw-nav-n").textContent = query && matching ? matching : "";
      }
      total += matching;
    });

    if (status) status.textContent = query ? (total ? t.results(total) : t.none) : "";
    if (empty) empty.hidden = !query || total > 0;
    highlight();
  }

  // Resaltado de coincidencias (CSS Custom Highlight API; si el navegador no la tiene, no pasa nada)
  function highlight() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
    CSS.highlights.delete("cv-search");
    if (!query) return;
    const ranges = [];
    root.querySelectorAll(".cvw-section:not([hidden]) .cv-entry:not([hidden])").forEach((entry) => {
      const walker = document.createTreeWalker(entry, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue;
        let flat = "";
        const map = [];
        for (let i = 0; i < text.length; i++) {
          for (const ch of norm(text[i])) { flat += ch; map.push(i); }
        }
        for (let at = flat.indexOf(query); at !== -1; at = flat.indexOf(query, at + query.length)) {
          const range = new Range();
          range.setStart(node, map[at]);
          range.setEnd(node, map[at + query.length - 1] + 1);
          ranges.push(range);
        }
      }
    });
    CSS.highlights.set("cv-search", new Highlight(...ranges));
  }

  // Buscador
  if (input) {
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = norm(input.value.trim());
        update();
      }, 120);
    });
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { input.value = ""; query = ""; update(); input.blur(); }
    });
    document.addEventListener("keydown", (ev) => {
      const tag = document.activeElement?.tagName || "";
      if (ev.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag)) { ev.preventDefault(); input.focus(); }
    });
  }

  update();

  // Índice: marca la sección visible
  if ("IntersectionObserver" in window) {
    const setActive = (id) => {
      navLinks.forEach((a, key) => a.classList.toggle("is-active", key === id));
      const a = navLinks.get(id);
      const nav = a?.parentElement;
      if (nav && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
      }
    };
    const spy = new IntersectionObserver((items) => {
      items.forEach((it) => { if (it.isIntersecting) setActive(it.target.id); });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  // Aparición suave de las entradas
  if (!reduceMotion && "IntersectionObserver" in window) {
    root.classList.add("cvw-anim");
    const reveal = new IntersectionObserver((items) => {
      items.forEach((it) => {
        if (it.isIntersecting) { it.target.classList.add("is-in"); reveal.unobserve(it.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    root.querySelectorAll(".cv-entry, .cvw-section-head").forEach((el) => reveal.observe(el));
  }

  // Contadores de la cabecera
  if (!reduceMotion) {
    root.querySelectorAll(".cvw-stat-n").forEach((el) => {
      const target = Number(el.dataset.count);
      if (!target) return;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / 1100);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    });
  }
})();
