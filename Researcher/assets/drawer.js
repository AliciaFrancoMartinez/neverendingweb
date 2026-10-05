(() => {
  "use strict";

  const form = document.querySelector("#drawer-form");
  const projectsRoot = document.querySelector("#drawer-projects");
  const formStatus = document.querySelector("#drawer-form-status");
  const refreshButton = document.querySelector("#drawer-refresh");
  const description = document.querySelector("#project-description");
  const descriptionCount = document.querySelector("#description-count");
  const yearInput = document.querySelector("#project-year");

  if (!form || !projectsRoot || !formStatus) return;

  const config = window.DRAWER_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const isConfigured = /^https:\/\/.+\.supabase\.co$/i.test(baseUrl) &&
    anonKey.length > 40;
  const stageLabels = {
    idea: "At the idea",
    planning: "During planning",
    data: "During data collection",
    analysis: "During data analysis",
    writing: "During writing",
    other: "Somewhere else",
  };

  if (yearInput) yearInput.max = String(new Date().getFullYear());

  const setStatus = (message, kind = "") => {
    formStatus.textContent = message;
    formStatus.dataset.kind = kind;
  };

  const addText = (parent, tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  };

  const apiHeaders = (extra = {}) => ({
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    ...extra,
  });

  function renderEmpty(
    message =
      "The drawer is quiet for now. The first unfinished project could be yours.",
    root = projectsRoot,
  ) {
    root.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "drawer-empty";
    addText(empty, "span", "", "03");
    addText(empty, "p", "", message);
    root.appendChild(empty);
    root.setAttribute("aria-busy", "false");
  }

  // owner: si se indica, la firma es "Filed by <owner>" (para My file drawer)
  function renderProjects(projects, root = projectsRoot, { owner = "", emptyMessage } = {}) {
    root.replaceChildren();

    if (!projects.length) {
      renderEmpty(emptyMessage, root);
      return;
    }

    projects.forEach((project, index) => {
      const article = document.createElement("article");
      article.className = "drawer-project";
      article.style.setProperty("--card-index", String(index));
      article.tabIndex = 0;
      article.setAttribute("aria-expanded", "false");
      article.setAttribute(
        "aria-label",
        `${project.title}. Open project details`,
      );

      const setExpanded = (expanded) => {
        article.classList.toggle("is-open", expanded);
        article.setAttribute("aria-expanded", String(expanded));
      };

      if (window.matchMedia("(hover: none)").matches) {
        article.addEventListener("click", () => {
          const willOpen = !article.classList.contains("is-open");
          setExpanded(willOpen);
          if (!willOpen) article.blur();
        });
      }

      article.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const willOpen = !article.classList.contains("is-open");
        setExpanded(willOpen);
        if (!willOpen) article.blur();
      });

      article.addEventListener("mouseenter", () => {
        article.setAttribute("aria-expanded", "true");
      });

      article.addEventListener("mouseleave", () => {
        if (!article.classList.contains("is-open")) {
          article.setAttribute("aria-expanded", "false");
        }
      });

      article.addEventListener("focus", () => {
        article.setAttribute("aria-expanded", "true");
      });

      article.addEventListener("blur", () => {
        if (!article.classList.contains("is-open")) {
          article.setAttribute("aria-expanded", "false");
        }
      });

      const tab = document.createElement("div");
      tab.className = "drawer-project-tab";
      tab.textContent = project.topic;
      article.appendChild(tab);

      const meta = document.createElement("div");
      meta.className = "drawer-project-meta";
      const stageLabel = stageLabels[project.stage] || "Unfinished";
      const filingLabel = project.abandoned_year
        ? `Filed in ${project.abandoned_year} · ${stageLabel}`
        : stageLabel;
      addText(meta, "span", "drawer-project-filing", filingLabel);
      article.appendChild(meta);

      addText(article, "h3", "", project.title);
      addText(article, "p", "drawer-project-story", project.description);

      const name = owner || project.display_name;
      const byline = name ? `Filed by ${name}` : "Filed anonymously";
      addText(article, "p", "drawer-project-byline", byline);
      root.appendChild(article);
    });

    root.setAttribute("aria-busy", "false");
  }

  // Copia guardada en la web de los proyectos aprobados (assets/community-drawer.json).
  // Se muestra siempre, aunque Supabase esté pausado; si Supabase responde, se usa lo último.
  const mineIds = new Set((window.MY_DRAWER || []).map((p) => p && p.id).filter(Boolean));
  const notMine = (projects) => projects.filter((p) => p && !mineIds.has(p.id));
  let snapshot = [];

  async function loadSnapshot() {
    try {
      const response = await fetch("assets/community-drawer.json", { cache: "no-cache" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        snapshot = notMine(data);
        if (snapshot.length) renderProjects(snapshot);
      }
    } catch (error) {
      console.warn("File drawer snapshot not available", error);
    }
  }

  async function loadProjects() {
    if (!isConfigured) {
      if (!snapshot.length) {
        renderEmpty("The shared drawer is being prepared. Please come back soon.");
      }
      return;
    }

    projectsRoot.setAttribute("aria-busy", "true");
    if (refreshButton) refreshButton.disabled = true;

    try {
      const query = new URLSearchParams({
        select:
          "id,title,topic,description,stage,abandoned_year,display_name,created_at",
        moderation_status: "eq.published",
        order: "abandoned_year.desc.nullslast,created_at.desc",
        limit: "100",
      });
      const response = await fetch(
        `${baseUrl}/rest/v1/drawer_projects?${query}`,
        {
          headers: apiHeaders(),
        },
      );
      if (!response.ok) {
        throw new Error(`Archive request failed (${response.status})`);
      }
      // los proyectos que ya están en "My file drawer" (por su id) no se repiten aquí
      renderProjects(notMine(await response.json()));
    } catch (error) {
      console.error(error);
      if (snapshot.length) {
        renderProjects(snapshot);
      } else {
        renderEmpty(
          "The community’s drawer is waiting for its first projects. File yours below, and it will appear here after review.",
        );
      }
    } finally {
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  if (description && descriptionCount) {
    description.addEventListener("input", () => {
      descriptionCount.textContent = String(description.value.length);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    if (String(data.get("website") || "").trim()) {
      form.reset();
      setStatus(
        "Thank you. Your project has been filed for review.",
        "success",
      );
      return;
    }

    if (!isConfigured) {
      setStatus(
        "The shared drawer is not connected yet. Please try again soon.",
        "error",
      );
      return;
    }

    const lastSubmission = Number(
      window.localStorage.getItem("drawer-last-submission") || 0,
    );
    if (Date.now() - lastSubmission < 45000) {
      setStatus("Please wait a moment before filing another project.", "error");
      return;
    }

    const payload = {
      title: String(data.get("title") || "").trim(),
      topic: String(data.get("topic") || "").trim(),
      stage: String(data.get("stage") || ""),
      abandoned_year: Number(data.get("abandoned_year")),
      description: String(data.get("description") || "").trim(),
      display_name: String(data.get("display_name") || "").trim() || null,
    };

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.dataset.loading = "true";
    setStatus("Filing your project…");

    try {
      const response = await fetch(`${baseUrl}/rest/v1/drawer_projects`, {
        method: "POST",
        headers: apiHeaders({
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        }),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Submission failed (${response.status})`);
      }

      window.localStorage.setItem("drawer-last-submission", String(Date.now()));
      form.reset();
      if (descriptionCount) descriptionCount.textContent = "0";
      setStatus(
        "Thank you. Your project has been filed for review.",
        "success",
      );
    } catch (error) {
      console.error(error);
      setStatus("The project could not be filed. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.dataset.loading = "false";
    }
  });

  if (refreshButton) refreshButton.addEventListener("click", loadProjects);
  loadSnapshot().then(loadProjects);

  // ── My file drawer: proyectos propios (assets/my-drawer.js) ──
  const myRoot = document.querySelector("#my-projects");
  if (myRoot) {
    const mine = (Array.isArray(window.MY_DRAWER) ? window.MY_DRAWER : [])
      .filter((p) => p && p.title)
      .sort((a, b) => (b.abandoned_year || 0) - (a.abandoned_year || 0));
    renderProjects(mine, myRoot, {
      owner: "Alicia",
      emptyMessage: "I am still sorting through my own drawer. My abandoned projects will be filed here soon.",
    });
  }

  // ── Dos archivadores: "My file drawer" y "Community's file drawer" ──
  const page = document.querySelector(".drawer-page");
  const cabinets = Array.from(document.querySelectorAll(".drawer-cabinet"));
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // La flecha del margen (solo en el de la comunidad) empieza justo debajo de la frase del título
  const arrow = document.querySelector(".drawer-margin-arrow");
  const archive = document.querySelector(".drawer-archive");
  function placeArrow() {
    if (!arrow || !archive || page.dataset.view !== "community") return;
    const subtitle = archive.querySelector(".drawer-subtitle[data-for='community']");
    if (!subtitle) return;
    const top = subtitle.getBoundingClientRect().bottom - archive.getBoundingClientRect().top + 14;
    arrow.style.top = `${Math.round(top)}px`;
  }
  window.addEventListener("resize", placeArrow);

  function setView(view, { updateHash = true } = {}) {
    if (!page || !view || page.dataset.view === view) return;
    page.dataset.view = view;
    window.requestAnimationFrame(placeArrow);
    cabinets.forEach((cabinet) => {
      const active = cabinet.dataset.view === view;
      cabinet.setAttribute("aria-selected", String(active));
      cabinet.tabIndex = active ? 0 : -1;
    });
    if (updateHash) {
      const url = view === "community" ? "#community" : window.location.pathname + window.location.search;
      window.history.replaceState(null, "", url);
    }
  }

  cabinets.forEach((cabinet, index) => {
    cabinet.tabIndex = cabinet.getAttribute("aria-selected") === "true" ? 0 : -1;
    let hoverTimer;
    // con ratón: basta con pasar por encima (con una pequeña pausa para no cambiar sin querer)
    cabinet.addEventListener("mouseenter", () => {
      if (!canHover) return;
      hoverTimer = window.setTimeout(() => setView(cabinet.dataset.view), 140);
    });
    cabinet.addEventListener("mouseleave", () => window.clearTimeout(hoverTimer));
    // con dedo o teclado: al pulsar
    cabinet.addEventListener("click", () => setView(cabinet.dataset.view));
    cabinet.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const next = cabinets[(index + (event.key === "ArrowRight" ? 1 : -1) + cabinets.length) % cabinets.length];
      next.focus();
      setView(next.dataset.view);
    });
  });

  // Enlaces directos: …/Drawer.html#community o #leave-a-project abren el de la comunidad
  if (["#community", "#leave-a-project"].includes(window.location.hash)) {
    setView("community", { updateHash: false });
  }
  if (document.fonts) document.fonts.ready.then(placeArrow);
})();
