# ─────────────────────────────────────────────────────────────────────────────
#  cv.R — convierte los YAML de CV/data en el HTML del CV.
#  Lo usan cv.qmd (pestaña CV de la web) y build-pdf.R (PDF). Normalmente no hace
#  falta tocar este archivo para añadir méritos: basta con editar CV/data/*.yml
# ─────────────────────────────────────────────────────────────────────────────

invisible(Sys.setlocale("LC_CTYPE", "en_US.UTF-8"))
suppressPackageStartupMessages({
  library(yaml)
  library(commonmark)
})

CV_ROOT <- "CV"
CV_FONTS <- paste0(
  "https://fonts.googleapis.com/css2?",
  "family=Barlow+Semi+Condensed:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700",
  "&family=Fraunces:opsz,wght@9..144,400;9..144,700",
  "&display=swap"
)

`%||%` <- function(a, b) {
  if (is.function(a)) return(a)
  if (is.null(a) || length(a) == 0 || identical(a, "") || (length(a) == 1 && is.na(a))) b else a
}

cv <- new.env()  # estado de la generación actual (perfil, ruta de imágenes…)

# ── Utilidades de texto ──────────────────────────────────────────────────────

esc <- function(x) htmltools::htmlEscape(as.character(x), attribute = TRUE)

# Markdown en línea → HTML (sin <p>). Admite *cursiva*, **negrita**, [enlaces](url) y HTML.
md <- function(x) {
  if (is.null(x) || length(x) == 0 || identical(x, "")) return("")
  html <- commonmark::markdown_html(paste(as.character(x), collapse = "\n\n"), extensions = TRUE)
  html <- trimws(html)
  html <- gsub("^<p>|</p>$", "", html)
  html <- gsub("</p>\\s*<p>", "<br>", html)
  gsub("<a href=", "<a target=\"_blank\" rel=\"noopener\" href=", html, fixed = TRUE)
}

# Pone en negrita tu nombre dentro de una lista de autores
highlight <- function(authors) {
  for (n in cv$profile$highlight) {
    authors <- gsub(n, paste0("<strong class=\"cv-me\">", n, "</strong>"), authors, fixed = TRUE)
  }
  authors
}

# Versalitas "a mano", como en la plantilla de Pages: las mayúsculas que escribes salen
# grandes y el resto en mayúscula pequeña ("PhD in Psychology" → PʜD ɪɴ Pꜱʏᴄʜᴏʟᴏɢʏ)
caps <- function(html) {
  parts <- regmatches(html, gregexpr("<[^>]+>|[^<]+", html))[[1]]
  out <- vapply(parts, function(p) {
    if (startsWith(p, "<")) p else gsub("(\\p{Lu}+)", "<span class=\"cv-cap\">\\1</span>", p, perl = TRUE)
  }, "", USE.NAMES = FALSE)
  paste(out, collapse = "")
}

img <- function(file, alt = "", cls = NULL) {
  sprintf("<img%s src=\"%s%s\" alt=\"%s\" loading=\"lazy\">",
          if (is.null(cls)) "" else sprintf(" class=\"%s\"", cls), cv$img, esc(file), esc(alt))
}

link_icon <- function(url, icon = "🔗", label = "link") {
  if (is.null(url) || identical(url, "")) return("")
  sprintf(" <a class=\"cv-icon-link\" href=\"%s\" target=\"_blank\" rel=\"noopener\" aria-label=\"%s\">%s</a>",
          esc(url), esc(label), icon)
}

visible <- function(items) Filter(function(e) !(is.list(e) && isTRUE(e$hide)), items %||% list())

strip_md <- function(x) trimws(gsub("<[^>]+>", "", gsub("[*_`]", "", paste(as.character(x %||% ""), collapse = " "))))

slug <- function(x) {
  x <- iconv(strip_md(x), "UTF-8", "ASCII//TRANSLIT", sub = "")
  gsub("^-+|-+$", "", tolower(gsub("[^A-Za-z0-9]+", "-", x)))
}

fmt_date <- function(d) {
  if (is.null(d) || length(d) == 0) return("")
  paste(vapply(d, esc, ""), collapse = "<br>")
}

# ── Bloques de maquetación ───────────────────────────────────────────────────
# Cada entrada es una rejilla: [fecha | contenido | (logo)]. Cada fila es un par
# (celda izquierda, celda de contenido).

row <- function(when = "", what = "", cls = "", attrs = "") {
  if (!nzchar(when) && !nzchar(what)) return("")
  a <- if (nzchar(attrs)) paste0(" ", attrs) else ""
  sprintf("<div class=\"cv-when\"%s>%s</div><div class=\"cv-what %s\"%s>%s</div>", a, when, cls, a, what)
}

entry <- function(rows, aside = NULL, cls = "", attrs = "") {
  rows <- rows[nzchar(rows)]
  aside_html <- if (length(aside)) {
    sprintf("<div class=\"cv-aside\" style=\"grid-row: 1 / span %d\">%s</div>", length(rows), paste(aside, collapse = ""))
  } else ""
  sprintf("<div class=\"cv-entry %s\"%s>%s%s</div>", cls, if (nzchar(attrs)) paste0(" ", attrs) else "",
          paste(rows, collapse = ""), aside_html)
}

date_cell <- function(d, extra = "") {
  paste0(if (length(d) && !identical(d, "")) sprintf("<span class=\"cv-date\">%s</span>", fmt_date(d)) else "", extra)
}

p <- function(html, cls = "cv-line") if (nzchar(html)) sprintf("<p class=\"%s\">%s</p>", cls, html) else ""

title_line <- function(html, bullet = "•") {
  sprintf("<p class=\"cv-title\"><span class=\"cv-bullet\">%s</span>%s</p>", bullet, html)
}

lines_html <- function(lines, cls = "cv-line") paste(vapply(lines %||% list(), function(l) p(md(l), cls), ""), collapse = "")

places_html <- function(places, cls = "cv-line cv-place") {
  if (!length(places)) return("")
  lines_html(paste("📍", unlist(places)), cls)
}

bar <- function(title, cls, note = NULL) {
  sprintf("<h3 class=\"cv-bar %s\"><span class=\"cv-bar-text\">%s%s</span></h3>", cls, caps(md(title)),
          if (length(note)) sprintf(" <span class=\"cv-bar-note\">%s</span>", caps(md(note))) else "")
}

groups_html <- function(s, render_entry) {
  if (!is.null(s$groups)) {
    paste(vapply(visible(s$groups), function(g) {
      entries <- vapply(visible(g$entries %||% g$items), render_entry, "")
      # la barra del grupo va siempre en la misma página que su primera entrada
      first <- sprintf("<div class=\"cv-keep\">%s%s</div>", bar(g$title, "cv-bar--group"), if (length(entries)) entries[[1]] else "")
      sprintf("<div class=\"cv-group\" data-group=\"%s\">%s%s</div>", slug(g$chip %||% g$title), first, paste(entries[-1], collapse = ""))
    }, ""), collapse = "")
  } else {
    paste(vapply(visible(s$entries), render_entry, ""), collapse = "")
  }
}

# ── Badges de ciencia abierta ────────────────────────────────────────────────

BADGES <- list(
  prereg    = list(label = "Preregistered",  col = "#e8473e",
                   icon = "<path d=\"M7.4 13.3l3.1 3 6.2-6.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"),
  data      = list(label = "Open data",      col = "#0b89cc",
                   icon = "<path d=\"M8.2 17.6v-4.4M12 17.6V8.6M15.8 17.6v-6.2\" stroke=\"#fff\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>"),
  materials = list(label = "Open materials", col = "#f5991f",
                   icon = "<path d=\"M6.8 10.8 12 8.2l5.2 2.6v5.6L12 19l-5.2-2.6z\" fill=\"#fff\"/><path d=\"M6.8 10.8 12 13.4l5.2-2.6M12 13.4V19\" fill=\"none\" stroke=\"%COL%\" stroke-width=\"1.2\"/>"),
  code      = list(label = "Open code",      col = "#72a43f",
                   icon = "<path d=\"M9.3 9.6 6.4 13l2.9 3.4M14.7 9.6l2.9 3.4-2.9 3.4M13.1 8.6l-2.2 8.8\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>")
)

badge_state <- function(v) {
  if (isTRUE(v) || identical(tolower(as.character(v %||% "")), "yes")) "yes"
  else if (identical(tolower(as.character(v %||% "")), "na")) "na"
  else "no"
}

badge_svg <- function(kind, state) {
  b <- BADGES[[kind]]
  col <- switch(state, yes = b$col, na = "#c9c3b8", "#3b3634")
  sprintf(paste0("<svg class=\"cv-badge\" viewBox=\"0 0 24 26\" aria-hidden=\"true\">",
                 "<path d=\"M12 1.6 21.4 7v12L12 24.4 2.6 19V7z\" fill=\"%s\" stroke=\"%s\" stroke-width=\"2.2\" stroke-linejoin=\"round\"/>%s</svg>"),
          col, col, gsub("%COL%", col, b$icon, fixed = TRUE))
}

badges_html <- function(badges) {
  if (is.null(badges)) return("")
  states <- vapply(names(BADGES), function(k) badge_state(badges[[k]]), "")
  title <- paste(sprintf("%s: %s", vapply(BADGES, `[[`, "", "label"),
                         c(yes = "yes", no = "no", na = "not applicable")[states]), collapse = " · ")
  sprintf("<span class=\"cv-badges\" title=\"%s\">%s</span>", esc(title),
          paste(mapply(badge_svg, names(BADGES), states), collapse = ""))
}

badges_legend <- function() {
  items <- vapply(names(BADGES), function(k) {
    sprintf("<span class=\"cv-legend-item\">%s<span>%s</span></span>", badge_svg(k, "yes"), BADGES[[k]]$label)
  }, "")
  sprintf("<span class=\"cv-legend\">%s%s</span>", img("logo-open-access.png", "Open Access", "cv-legend-oa"), paste(items, collapse = ""))
}

# ── Secciones ────────────────────────────────────────────────────────────────

render_education <- function(s) {
  paste(vapply(visible(s$entries), function(e) {
    rows <- c(row(date_cell(e$date), bar(e$degree, "cv-bar--entry", e$degree_note), "cv-what--bar"))
    if (!is.null(e$thesis)) {
      t <- e$thesis
      rows <- c(rows, row("", p(sprintf("<span class=\"cv-label\">%s:</span> <em>%s</em>%s", md(t$label %||% "Thesis"), md(t$title),
                                         if (length(t$note)) sprintf(" <span class=\"cv-light\">%s</span>", md(t$note)) else ""))))
    }
    rows <- c(rows, row("", lines_html(e$lines)), row("", places_html(e$places)))
    for (sub in visible(e$sub)) {
      rows <- c(rows, row(date_cell(sub$date), p(md(sub$title), "cv-line cv-sub")),
                row("", places_html(sub$places, "cv-line cv-place cv-place--small")))
    }
    entry(rows, cls = "cv-entry--degree")
  }, ""), collapse = "")
}

render_experience <- function(s) {
  groups_html(s, function(e) {
    entry(c(row(date_cell(e$date), title_line(md(e$title))),
            row("", lines_html(e$lines))),
          aside = if (length(e$logos)) vapply(unlist(e$logos), function(f) img(f, "", "cv-logo"), ""))
  })
}

render_publications <- function(s) {
  groups_html(s, function(e) {
    venue <- ""
    if (length(e$venue) || length(e$doi)) {
      doi <- if (length(e$doi)) {
        sprintf(" %s <a class=\"cv-doi\" href=\"https://doi.org/%s\" target=\"_blank\" rel=\"noopener\">%s</a>",
                esc(e$doi_label %||% "doi:"), esc(e$doi), esc(e$doi))
      } else ""
      oa <- if (isTRUE(e$open_access)) img("icon-open-access.png", "Open Access", "cv-oa") else ""
      venue <- p(sprintf("<span class=\"cv-venue-icon\">%s</span>%s%s%s", e$icon %||% "📰", md(e$venue), doi, oa), "cv-line cv-venue")
    }
    entry(c(row(date_cell(e$date, badges_html(e$badges)),
                paste0(title_line(highlight(md(e$authors))), p(md(e$title), "cv-line cv-pub-title"),
                       venue, if (length(e$extra)) p(md(e$extra), "cv-line cv-venue cv-venue--extra") else ""))))
  })
}

render_generic <- function(s) {
  groups_html(s, function(e) {
    entry(c(row(date_cell(e$date),
                paste0(title_line(md(e$title)), p(md(e$org)),
                       if (length(e$project)) p(sprintf("<em>%s</em>", md(e$project)), "cv-line cv-project") else "",
                       if (length(e$amount)) p(md(e$amount), "cv-line cv-amount") else "",
                       lines_html(e$lines)))))
  })
}

place_inline <- function(place) {
  if (is.null(place) || identical(place, "")) "" else sprintf(" <span class=\"cv-place-inline\">📍%s</span>", md(place))
}

tag_html <- function(t) if (length(t) && !identical(t, "")) sprintf("<span class=\"cv-tag\">%s</span>", esc(t)) else ""

render_conferences <- function(s) {
  groups_html(s, function(e) {
    contribs <- visible(e$contributions)
    head <- paste0(md(e$event), place_inline(e$place),
                   if (length(e$role)) sprintf("<span class=\"cv-conf-role\">%s</span>", md(e$role)) else "")
    rows <- c(row(date_cell(e$date, if (!length(contribs)) tag_html(e$tag) else ""), title_line(head)))
    types <- if (length(contribs)) vapply(contribs, function(c) slug(c$type), "") else slug(e$tag)
    for (c in contribs) {
      body <- paste0(
        sprintf("<p class=\"cv-contrib-authors\"><span class=\"cv-bullet cv-bullet--sub\">○</span>%s</p>", highlight(md(c$authors))),
        p(paste0("<em>", md(c$title), "</em>", link_icon(c$link), link_icon(c$video, "📽", "video"),
                 if (length(c$note)) sprintf(" <span class=\"cv-note\">%s</span>", md(c$note)) else ""), "cv-line cv-contrib-title"))
      rows <- c(rows, row(tag_html(c$type), body, "cv-what--contrib", sprintf("data-type=\"%s\"", slug(c$type))))
    }
    entry(rows, attrs = sprintf("data-types=\"%s\"", paste(unique(types), collapse = " ")))
  })
}

render_talks <- function(s) {
  groups_html(s, function(e) {
    detail <- paste0(if (length(e$detail)) sprintf("<em>%s</em>", md(e$detail)) else "", link_icon(e$link),
                     if (length(e$duration)) sprintf(" <span class=\"cv-duration\">(%s)</span>", esc(e$duration)) else "")
    entry(c(row(date_cell(e$date),
                paste0(title_line(paste0(md(e$title), place_inline(e$place))),
                       p(md(e$org), "cv-line cv-org"), p(detail, "cv-line cv-detail"), lines_html(e$lines)))))
  })
}

render_awards <- render_generic

render_projects <- function(s) {
  groups_html(s, function(e) {
    funder <- paste0(md(e$funder), if (length(e$ref)) sprintf(" · %s", esc(e$ref)) else "")
    role <- paste0(if (length(e$role)) sprintf("<em>%s</em>", md(e$role)) else "",
                   if (length(e$pi)) sprintf(" · PI: %s", md(e$pi)) else "")
    entry(c(row(date_cell(e$date),
                paste0(title_line(md(e$title)), p(funder, "cv-line cv-org"), p(role, "cv-line cv-project"),
                       if (length(e$amount)) p(md(e$amount), "cv-line cv-amount") else "", lines_html(e$lines)))))
  })
}

render_teaching <- function(s) {
  groups_html(s, function(e) {
    items <- visible(e$items)
    item_line <- function(it) p(sprintf("📍 <span class=\"cv-place-small\">%s</span>%s%s", md(it$place),
                                        if (length(it$detail)) sprintf(" - <strong>%s</strong>", md(it$detail)) else "",
                                        if (length(it$evaluation)) sprintf(" <span class=\"cv-eval\">· Student evaluation: %s</span>", esc(it$evaluation)) else ""),
                                "cv-line cv-item")
    if (length(items) == 1) {
      rows <- c(row(date_cell(items[[1]]$date), title_line(md(e$title))), row("", item_line(items[[1]])))
    } else {
      rows <- c(row("", title_line(md(e$title))),
                vapply(items, function(it) row(date_cell(it$date), item_line(it)), ""))
    }
    entry(rows)
  })
}

render_dissemination <- function(s) {
  groups_html(s, function(e) {
    links <- if (length(e$links)) {
      p(paste(vapply(e$links, function(l) sprintf("<a href=\"%s\" target=\"_blank\" rel=\"noopener\">🔗 %s</a>", esc(l$url), esc(l$label)), ""),
              collapse = " "), "cv-line cv-links")
    } else ""
    entry(c(row(date_cell(e$date), paste0(title_line(md(e$title)), lines_html(e$lines, "cv-line cv-desc"), links))),
          aside = if (length(e$image)) img(e$image, "", "cv-thumb"))
  })
}

render_training <- function(s) {
  groups_html(s, function(e) {
    org <- paste0(md(e$org), if (length(e$hours)) sprintf(" (%s)", esc(e$hours)) else "", place_inline(e$place))
    entry(c(row(date_cell(e$date),
                paste0(title_line(sprintf("%s: <em class=\"cv-course\">%s</em>", md(e$kind %||% "Workshop"), md(e$title))),
                       p(org, "cv-line cv-org")))))
  })
}

render_skills <- function(s) {
  groups_html(s, function(it) {
    if (is.character(it)) return(entry(row("", sub("cv-title", "cv-title cv-title--plain", title_line(md(it)), fixed = TRUE))))
    entry(row("", paste0(title_line(md(it$title)), lines_html(it$text))))
  })
}

# ── Documento completo ───────────────────────────────────────────────────────

cv_load <- function(root = CV_ROOT) {
  profile <- read_yaml(file.path(root, "data", "profile.yml"))
  sections <- lapply(profile$sections, function(id) {
    s <- read_yaml(file.path(root, "data", paste0(id, ".yml")))
    s$id <- id
    s
  })
  cv$profile <- profile
  list(profile = profile, sections = sections)
}

cv_date <- function(profile) {
  if (is.null(profile$date) || identical(profile$date, "auto")) format(Sys.Date(), "%Y-%m-%d") else as.character(profile$date)
}

section_html <- function(s) {
  # Secciones sin plantilla propia usan la genérica (date, title, org, project, amount, lines)
  renderer <- get0(paste0("render_", s$id), mode = "function") %||% render_generic
  sprintf(paste0("<section class=\"cv-section cv-sec-%s\" id=\"cv-%s\" data-section=\"%s\">",
                 "<h2 class=\"cv-section-title\"><span class=\"cv-bar cv-bar--section\"><span class=\"cv-bar-text\">%s%s</span></span>%s</h2>",
                 "<div class=\"cv-section-body\">%s</div></section>"),
          s$id, s$id, s$id, caps(md(s$title)),
          if (length(s$title_note)) sprintf(" <span class=\"cv-bar-note\">%s</span>", md(s$title_note)) else "",
          if (isTRUE(s$legend)) badges_legend() else "",
          renderer(s))
}

cover_html <- function(profile, sections) {
  contacts <- paste(vapply(profile$contacts, function(c) {
    sprintf("<a href=\"%s\" target=\"_blank\" rel=\"noopener\" title=\"%s\">%s</a>", esc(c$url), esc(c$label), img(c$icon, c$label))
  }, ""), collapse = "")
  index <- paste(vapply(sections, function(s) {
    sprintf("<li><span class=\"cv-index-page\" data-for=\"%s\"></span><a class=\"cv-bar cv-bar--index\" href=\"#cv-%s\"><span class=\"cv-bar-text\">%s</span></a></li>",
            s$id, s$id, caps(md(s$title)))
  }, ""), collapse = "")
  sprintf(paste0("<header class=\"cv-cover\">",
                 "<p class=\"cv-role\">%s</p>",
                 "<h1 class=\"cv-name\"><span class=\"cv-name-first\">%s</span> <span class=\"cv-name-last\">%s</span></h1>",
                 "<p class=\"cv-tagline\">%s</p>",
                 "<p class=\"cv-contacts\">%s</p>",
                 "</header><nav class=\"cv-index\" aria-label=\"CV sections\" style=\"--index-gap: %.2fem\"><ol>%s</ol></nav>"),
          esc(profile$role), esc(profile$name$first), esc(profile$name$last),
          paste(vapply(profile$tagline, esc, ""), collapse = "<br>"), contacts,
          # separación entre barras del índice para que quepan todas en la portada (205 mm disponibles)
          (min(20.3, 205 / length(sections)) - 11.4) / 4.27, index)
}

cv_body <- function(data, mode) {
  sections <- Filter(function(s) !isTRUE(s$hide), data$sections)
  sprintf("<div class=\"cv cv--%s\">%s<div class=\"cv-sections\">%s</div></div>",
          mode, cover_html(data$profile, sections), paste(vapply(sections, section_html, ""), collapse = ""))
}

# ── Versión web (pestaña CV) ─────────────────────────────────────────────────
# Usa los mismos renderizadores de entradas que el PDF, pero con otra estructura:
# cabecera con contadores, barra lateral (buscador + índice) y secciones filtrables.
# El comportamiento está en CV/assets/cv-web.js y el estilo en CV/assets/cv-web.css.

section_entries <- function(s, group = NULL) {
  if (is.null(s$groups)) return(visible(s$entries))
  gs <- visible(s$groups)
  if (!is.null(group)) gs <- gs[as.integer(group)]
  unlist(lapply(gs, function(g) visible(g$entries %||% g$items)), recursive = FALSE)
}

stat_value <- function(st, sections) {
  s <- Find(function(x) identical(x$id, st$section), sections)
  if (is.null(s)) return(NA_integer_)
  entries <- section_entries(s, st$group)
  if (identical(st$count, "contributions")) {
    as.integer(sum(vapply(entries, function(e) length(visible(e$contributions)), 0)))
  } else length(entries)
}

web_chips <- function(s) {
  chip <- function(filter, label) {
    sprintf("<button type=\"button\" class=\"cvw-chip\" data-filter=\"%s\" aria-pressed=\"%s\">%s<span class=\"cvw-chip-n\"></span></button>",
            filter, if (filter == "all") "true" else "false", esc(label))
  }
  chips <- switch(s$web_filter %||% "",
    groups = vapply(visible(s$groups), function(g) chip(paste0("group:", slug(g$chip %||% g$title)), strip_md(g$chip %||% g$title)), ""),
    types = {
      types <- unlist(lapply(section_entries(s), function(e) {
        cs <- visible(e$contributions)
        if (length(cs)) vapply(cs, function(c) as.character(c$type %||% ""), "") else as.character(e$tag %||% "")
      }))
      types <- unique(types[nzchar(types)])
      vapply(types, function(t) chip(paste0("type:", slug(t)), t), "", USE.NAMES = FALSE)
    },
    character(0))
  if (!length(chips)) return("")
  sprintf("<div class=\"cvw-chips\" role=\"group\" aria-label=\"Filter %s\">%s%s</div>",
          esc(strip_md(s$title)), chip("all", "All"), paste(chips, collapse = ""))
}

section_html_web <- function(s) {
  renderer <- get0(paste0("render_", s$id), mode = "function") %||% render_generic
  sprintf(paste0("<section class=\"cvw-section cv-sec-%s\" id=\"cv-%s\" data-section=\"%s\"%s>",
                 "<header class=\"cvw-section-head\"><h2 class=\"cvw-section-title\">%s%s</h2>%s</header>%s",
                 "<div class=\"cv-section-body\">%s</div></section>"),
          s$id, s$id, s$id,
          if (length(s$web_limit)) sprintf(" data-limit=\"%d\"", as.integer(s$web_limit)) else "",
          caps(md(s$title)),
          if (length(s$title_note)) sprintf(" <span class=\"cvw-note\">%s</span>", md(s$title_note)) else "",
          if (isTRUE(s$legend)) badges_legend() else "",
          web_chips(s), renderer(s))
}

hero_html <- function(profile, sections, root) {
  contacts <- paste(vapply(profile$contacts, function(c) {
    sprintf("<a href=\"%s\" target=\"_blank\" rel=\"noopener\" title=\"%s\" aria-label=\"%s\">%s</a>",
            esc(c$url), esc(c$label), esc(c$label), img(c$icon, ""))
  }, ""), collapse = "")
  stats <- paste(vapply(profile$stats %||% list(), function(st) {
    n <- stat_value(st, sections)
    if (is.na(n)) return("")
    sprintf("<a class=\"cvw-stat\" href=\"#cv-%s\"><span class=\"cvw-stat-n\" data-count=\"%d\">%d</span><span class=\"cvw-stat-l\">%s</span></a>",
            esc(st$section), n, n, esc(st$label))
  }, ""), collapse = "")
  updated <- max(file.mtime(list.files(file.path(root, "data"), pattern = "\\.yml$", full.names = TRUE)))
  buttons <- sprintf("<a class=\"cvw-btn cvw-btn--primary\" href=\"%s/%s\" download>%s Download CV (PDF)</a>",
                     root, esc(profile$pdf), ICON_DOWNLOAD)
  if (length(profile$short_pdf)) {
    buttons <- paste0(buttons, sprintf("<a class=\"cvw-btn\" href=\"%s/%s\" download>Short CV</a>", root, esc(profile$short_pdf)))
  }
  sprintf(paste0("<header class=\"cvw-hero\"><div class=\"cvw-hero-card\">",
                 "<div class=\"cvw-hero-main\">",
                 "<p class=\"cvw-role\">%s</p>",
                 "<h1 class=\"cvw-name\"><span>%s</span> <strong>%s</strong></h1>",
                 "<p class=\"cvw-tagline\">%s</p>",
                 "<div class=\"cvw-contacts\">%s</div>",
                 "<div class=\"cvw-actions\">%s<span class=\"cvw-updated\">Updated %s</span></div>",
                 "</div>%s</div></header>"),
          esc(profile$role), esc(profile$name$first), esc(profile$name$last),
          paste(vapply(profile$tagline, esc, ""), collapse = "<br>"), contacts, buttons,
          format(updated, "%B %Y"),
          if (nzchar(stats)) sprintf("<div class=\"cvw-stats\">%s</div>", stats) else "")
}

ICON_DOWNLOAD <- "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"
ICON_SEARCH <- "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"m15.5 15.5 5 5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>"

# Pestaña CV de la web (se llama desde cv.qmd)
cv_web <- function(root = CV_ROOT) {
  data <- cv_load(root)
  cv$img <- paste0(root, "/assets/img/")
  sections <- Filter(function(s) !isTRUE(s$hide), data$sections)
  nav <- paste(vapply(sections, function(s) {
    sprintf("<a href=\"#cv-%s\"><span>%s</span><span class=\"cvw-nav-n\"></span></a>", s$id, esc(strip_md(s$title)))
  }, ""), collapse = "")
  side <- sprintf(paste0("<div class=\"cvw-side\"><div class=\"cvw-side-inner\">",
                         "<label class=\"cvw-search\">%s<input type=\"search\" placeholder=\"Search the CV…\" aria-label=\"Search the CV\" autocomplete=\"off\"><kbd>/</kbd></label>",
                         "<p class=\"cvw-search-status\" aria-live=\"polite\"></p>",
                         "<nav class=\"cvw-nav\" aria-label=\"CV sections\">%s</nav>",
                         "</div></div>"), ICON_SEARCH, nav)
  html <- sprintf(paste0("<div class=\"cvw\">%s<div class=\"cvw-layout\">%s<div class=\"cvw-main\">%s",
                         "<p class=\"cvw-empty\" hidden>Nothing found. Try another word.</p></div></div></div>",
                         "<script src=\"%s/assets/cv-web.js\" defer></script>"),
                  hero_html(data$profile, sections, root), side,
                  paste(vapply(sections, section_html_web, ""), collapse = ""), root)
  cat("```{=html}\n", html, "\n```\n", sep = "")
}

# Documento independiente para el PDF (Paged.js lo pagina y Chrome lo imprime)
cv_print_html <- function(root = CV_ROOT) {
  data <- cv_load(root)
  cv$img <- "assets/img/"
  css <- function(f) paste(readLines(file.path(root, "assets", f), encoding = "UTF-8", warn = FALSE), collapse = "\n")
  name <- paste(data$profile$name$first, data$profile$name$last)
  paste0(
    "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n",
    sprintf("<title>CV · %s</title>\n", esc(name)),
    sprintf("<link rel=\"stylesheet\" href=\"%s\">\n", esc(CV_FONTS)),
    "<style>\n", css("cv.css"), "\n", css("cv-print.css"), "\n",
    sprintf("@page { @bottom-center { content: \"%s\"; } }\n", cv_date(data$profile)),
    "</style>\n",
    # En Chrome sin interfaz (al generar el PDF) requestAnimationFrame/requestIdleCallback no avanzan
    # con el tiempo virtual: se sustituyen por setTimeout para que Paged.js termine antes de imprimir.
    "<script>if (/HeadlessChrome/.test(navigator.userAgent)) {",
    " window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);",
    " window.requestIdleCallback = (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);",
    "}</script>\n",
    "<script src=\"https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js\"></script>\n",
    "<script>\n", css("cv-paged.js"), "\n</script>\n",
    "</head>\n<body>\n",
    sprintf("<div class=\"cv-running-header\">%s <strong>%s</strong> - CV</div>\n", esc(data$profile$name$first), esc(data$profile$name$last)),
    cv_body(data, "print"),
    "\n</body>\n</html>\n"
  )
}

# ── CV corto (una página) ────────────────────────────────────────────────────
# Usa los méritos marcados con `short:` en cada sección:
#   short: true            → formato automático (publicaciones, skills, congresos)
#   short: "texto"         → una línea con ese texto
#   short: ["texto", …]    → línea principal + sublíneas
# El estilo está en CV/assets/cv-short.css. Si el contenido no cabe en la página,
# cv-short.js reduce un poco el tamaño de letra (hasta un 20 %).

short_item <- function(v) {
  v <- unlist(v)
  list(main = md(v[1]), subs = if (length(v) > 1) vapply(v[-1], md, "", USE.NAMES = FALSE) else character())
}

short_pub <- function(e) {
  year <- if (grepl("^[0-9]{4}$", e$date %||% "")) e$date else tolower(e$date %||% "n.d.")
  venue <- e$venue %||% ""
  journal <- regmatches(venue, regexpr("\\*[^*]+\\*", venue))
  journal <- if (length(journal)) sub("[.,:;]\\*$", "*", journal) else ""
  doi <- if (length(e$doi)) sprintf(" <a class=\"cvs-doi\" href=\"https://doi.org/%s\">%s</a>", esc(e$doi), esc(e$doi)) else ""
  list(main = paste0(highlight(md(e$authors)), sprintf(" (%s). ", esc(year)), md(sub("[.]?$", ".", e$title)),
                     if (nzchar(journal)) paste0(" ", md(journal), ".") else "", doi),
       subs = character())
}

short_skill <- function(e) list(main = sprintf("<strong>%s</strong>", md(e$title)), subs = vapply(unlist(e$text %||% list()), md, "", USE.NAMES = FALSE))

# Recorre una sección y devuelve sus elementos `short` en orden
short_items <- function(s, auto = NULL) {
  if (is.null(s)) return(list())
  items <- list()
  add <- function(sh, e = NULL) {
    if (isTRUE(sh)) {
      if (!is.null(auto) && !is.null(e)) items[[length(items) + 1]] <<- auto(e)
    } else if (is.character(sh) || is.list(sh)) {
      items[[length(items) + 1]] <<- short_item(sh)
    }
  }
  # ([["short"]] y no $short: en R, $short también encontraría "short_note")
  if (!is.null(s[["short"]])) add(s[["short"]])
  if (!is.null(s$groups)) {
    for (g in visible(s$groups)) {
      if (!is.null(g[["short"]])) add(g[["short"]])
      for (e in visible(g$entries %||% g$items)) if (is.list(e) && !is.null(e[["short"]])) add(e[["short"]], e)
    }
  } else {
    for (e in visible(s$entries)) if (is.list(e) && !is.null(e[["short"]])) add(e[["short"]], e)
  }
  items
}

# Congresos marcados con short: true, agrupados por `series`
short_conferences <- function(s) {
  if (is.null(s)) return(list())
  es <- Filter(function(e) isTRUE(e[["short"]]), section_entries(s))
  key <- function(e) as.character(e$series %||% strip_md(e$event))
  lapply(unique(vapply(es, key, "")), function(k) {
    parts <- vapply(Filter(function(e) key(e) == k, es), function(e) {
      city <- e$city %||% sub(",.*$", "", strip_md(e$place))
      year <- sub(".*([0-9]{4}).*", "\\1", paste(e$date, collapse = " "))
      paste0(esc(city), " ", year, if (length(e$short_note)) sprintf(" [%s]", md(e$short_note)) else "")
    }, "")
    list(main = paste0(esc(k), " - ", paste(parts, collapse = "; ")), subs = character())
  })
}

short_list_html <- function(items, cls = "", ordered = FALSE) {
  if (!length(items)) return("")
  lis <- vapply(items, function(it) {
    sprintf("<li><span class=\"cvs-main-line\">%s</span>%s</li>", it$main,
            paste(sprintf("<span class=\"cvs-sub\">%s</span>", it$subs), collapse = ""))
  }, "")
  tag <- if (ordered) "ol" else "ul"
  sprintf("<%s class=\"cvs-list %s\">%s</%s>", tag, cls, paste(lis, collapse = ""), tag)
}

cv_short_html <- function(root = CV_ROOT) {
  data <- cv_load(root)
  cv$img <- "assets/img/"
  all_ids <- sub("\\.yml$", "", list.files(file.path(root, "data"), pattern = "\\.yml$"))
  sec <- function(id) {
    if (!(id %in% all_ids)) return(NULL)
    s <- read_yaml(file.path(root, "data", paste0(id, ".yml"))); s$id <- id; s
  }
  p_ <- data$profile
  css <- function(f) paste(readLines(file.path(root, "assets", f), encoding = "UTF-8", warn = FALSE), collapse = "\n")
  block <- function(title, body, level = "h3") if (nzchar(body)) sprintf("<%s class=\"cvs-h\">%s</%s>%s", level, title, level, body) else ""
  note <- function(s) if (!is.null(s) && length(s$short_note)) sprintf("<p class=\"cvs-note\">%s</p>", md(s$short_note)) else ""

  contacts <- paste(vapply(p_$contacts, function(c) {
    sprintf("<li>%s<a href=\"%s\">%s</a></li>", img(c$icon, c$label), esc(c$url), esc(c$handle %||% c$label))
  }, ""), collapse = "")

  teaching <- sec("teaching")
  teach_items <- if (!is.null(teaching)) short_items(list(groups = teaching$groups[1])) else list()

  side <- paste0(
    if (length(p_$photo)) img(p_$photo, paste(p_$name$first, p_$name$last), "cvs-photo") else "",
    "<div class=\"cvs-side-body\"><div class=\"cvs-fit\">",
    sprintf("<div class=\"cvs-bio\">%s</div>", paste(sprintf("<p>%s</p>", vapply(p_$bio %||% list(), md, "")), collapse = "")),
    block("Contact", sprintf("<ul class=\"cvs-contacts\">%s</ul>", contacts)),
    block("Skills", short_list_html(short_items(sec("skills"), short_skill), "cvs-skills")),
    block("Teaching", paste0(short_list_html(teach_items, "cvs-star"), note(teaching))),
    "</div></div>")

  education <- sec("education")
  main <- paste0(
    "<div class=\"cvs-fit\">",
    sprintf("<h2 class=\"cvs-bar\">%s</h2>", caps("Education")),
    short_list_html(short_items(education), "cvs-edu"), note(education),
    sprintf("<h2 class=\"cvs-bar\">%s</h2>", caps("Experience")),
    block("Research", short_list_html(c(short_items(sec("experience")), short_items(sec("projects"))), "cvs-research")),
    block("Publications", short_list_html(short_items(sec("publications"), short_pub), "cvs-pubs")),
    block("Conferences", short_list_html(short_conferences(sec("conferences")), "cvs-confs", ordered = TRUE)),
    block("Dissemination &amp; community", short_list_html(short_items(sec("dissemination")), "cvs-dissem")),
    "</div>")

  name <- paste(p_$name$first, p_$name$last)
  paste0(
    "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n",
    sprintf("<title>CV · %s (short)</title>\n", esc(name)),
    sprintf("<link rel=\"stylesheet\" href=\"%s\">\n", esc(CV_FONTS)),
    "<style>\n", css("cv.css"), "\n", css("cv-short.css"), "\n</style>\n",
    "</head>\n<body>\n<div class=\"cvs-page\">\n",
    "<div class=\"cvs-deco cvs-slate\"></div><div class=\"cvs-deco cvs-namebox\"></div><div class=\"cvs-deco cvs-terracotta\"></div><div class=\"cvs-deco cvs-line\"></div>\n",
    sprintf("<aside class=\"cvs-side\">%s</aside>\n", side),
    sprintf("<header class=\"cvs-head\"><h1><span class=\"cvs-first\">%s</span><span class=\"cvs-last\">%s</span></h1><p class=\"cvs-tagline\">%s</p></header>\n",
            esc(p_$name$first), esc(p_$name$last), paste(vapply(p_$tagline, esc, ""), collapse = "<br>")),
    sprintf("<main class=\"cvs-main\">%s</main>\n", main),
    "</div>\n<script>\n", css("cv-short.js"), "\n</script>\n</body>\n</html>\n"
  )
}
