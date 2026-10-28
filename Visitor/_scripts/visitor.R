# ─────────────────────────────────────────────────────────────────────────────
#  visitor.R — prepara la pestaña Visitor: el mapa de los sitios a los que me ha
#  llevado la investigación (congresos, estancias y charlas) y el diario de viaje.
#  Lo usan Visitor/Visitor.qmd y es/Visitor/Visitor.qmd, después de cargar
#  CV/_scripts/cv.R (de ahí salen la lectura de los YAML y las traducciones).
#  Los méritos salen de CV/data; las coordenadas de cada ciudad, de Visitor/places.yml.
#  El mapa lo dibuja Visitor/assets/visitor.js con estos datos.
# ─────────────────────────────────────────────────────────────────────────────

VISITOR_UI <- list(
  en = list(
    title = "Visitor", sub = "Where science has taken me…",
    stats = "{cities} cities · {countries} countries · {km} km travelled", laps = "{n} laps around the Earth",
    filters = "Show on the map",
    congress = "Congresses", visit = "Research stays", talk = "Talks",
    kind_congress = "Congress", kind_visit = "Research stay", kind_talk = "Invited talk",
    journey = "Journey", play = "Play the journey", pause = "Pause", until = "Up to {y}",
    zoom = "Zoom", drag = "Grab and drag map", drag_globe = "Grab and spin the globe",
    view = "View", view_map = "Map", view_globe = "Globe",
    map = "Interactive map of the places I have visited",
    wheel_hint = "Use Ctrl + scroll to zoom the map",
    map_error = "The map could not be loaded. The full list is below.",
    home = "home", n_one = "{n} visit", n_many = "{n} visits", cluster = "{name} and {n} more",
    close = "Close", online = "Online",
    log = "Travel log", log_lead = "Every trip, from the most recent. Pick one to find it on the map.",
    to_log = "Travel log", see_map = "See on the map"
  ),
  es = list(
    title = "Visitante", sub = "A dónde me ha llevado la ciencia…",
    stats = "{cities} ciudades · {countries} países · {km} km recorridos", laps = "{n} vueltas a la Tierra",
    filters = "Mostrar en el mapa",
    congress = "Congresos", visit = "Estancias", talk = "Charlas",
    kind_congress = "Congreso", kind_visit = "Estancia", kind_talk = "Charla invitada",
    journey = "Viaje", play = "Reproducir el viaje", pause = "Pausa", until = "Hasta {y}",
    zoom = "Zoom", drag = "Arrastra el mapa", drag_globe = "Arrastra para girar el globo",
    view = "Vista", view_map = "Mapa", view_globe = "Globo",
    map = "Mapa interactivo de los lugares que he visitado",
    wheel_hint = "Usa Ctrl + rueda para hacer zoom",
    map_error = "No se ha podido cargar el mapa. Tienes la lista completa más abajo.",
    home = "casa", n_one = "{n} visita", n_many = "{n} visitas", cluster = "{name} y {n} más",
    close = "Cerrar", online = "En línea",
    log = "Diario de viaje", log_lead = "Todos los viajes, del más reciente al más antiguo. Elige uno para verlo en el mapa.",
    to_log = "Diario de viaje", see_map = "Ver en el mapa"
  )
)

ICON_DRAG <- paste0(
  "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 2l2.3 2.3L13 5.6V8h2.4l1.3-1.3L19 9l-2.3 2.3L15.4 10H13v4h2.4l1.3-1.3L19 15l-2.3 2.3-1.3-1.3H13v2.4",
  "l1.3 1.3L12 22l-2.3-2.3 1.3-1.3V16H8.6l-1.3 1.3L5 15l2.3-2.3L8.6 14H11v-4H8.6l-1.3 1.3L5 9l2.3-2.3L8.6 8H11V5.6L9.7 4.3 12 2z\"/></svg>"
)

MONTH_NUM <- c(jan = 1, feb = 2, mar = 3, apr = 4, may = 5, jun = 6, jul = 7, aug = 8,
               sep = 9, sept = 9, oct = 10, nov = 11, dec = 12)

# Fecha de un mérito ("Sept 2026", "2024–2026", ["Feb 2025", "& Mar 2024"]) → años y orden
visitor_when <- function(d) {
  s <- paste(unlist(d), collapse = " ")
  years <- as.integer(regmatches(s, gregexpr("(19|20)[0-9]{2}", s))[[1]])
  if (!length(years)) return(NULL)
  m <- regmatches(s, regexpr("\\b[A-Za-z]{3,4}\\b", s, perl = TRUE))
  month <- if (length(m)) unname(MONTH_NUM[tolower(m)]) else NA
  list(years = I(sort(unique(years))), sort = years[1] * 100 + if (is.na(month)) 0 else month)
}

# Ciudad de un texto de lugar ("Valencia, Spain", "📍 ILLC, Universiteit van Amsterdam (…)")
visitor_place <- function(text, places) {
  for (p in places) {
    for (m in unlist(p$match %||% p$name)) if (grepl(m, text, fixed = TRUE)) return(p$id)
  }
  NA_character_
}

visitor_events <- function(cvroot, lang, cfg, dict) {
  raw <- function(id) read_yaml(file.path(cvroot, "data", paste0(id, ".yml")))
  loc <- function(x) localize(x, lang, dict)
  online <- function(text) any(vapply(unlist(cfg$online), function(m) grepl(m, text, fixed = TRUE), TRUE))
  events <- list()

  add <- function(kind, e, l, where, ...) {
    when <- visitor_when(e$date)
    if (is.null(when)) return(invisible())
    place <- visitor_place(where, cfg$places)
    is_online <- online(where)
    if (is.na(place) && !is_online) {
      warning("Visitor: no sé dónde está «", where, "». Añádelo a Visitor/places.yml.", call. = FALSE)
    }
    events[[length(events) + 1]] <<- c(list(
      kind = kind, date = paste(unlist(l$date), collapse = " "), years = when$years, sort = when$sort,
      place = if (is.na(place)) NULL else place, online = is_online,
      where = gsub("^📍\\s*", "", paste(unlist(l$where %||% where), collapse = " "))
    ), list(...))
  }

  # Congresos
  for (e in visible(raw("conferences")$entries)) {
    l <- loc(e)
    contribs <- visible(l$contributions)
    notes <- unlist(lapply(contribs, function(c) c$note))
    award <- c(l$short_note, gsub("^\\[|\\]$", "", notes))
    logo <- Filter(function(k) grepl(k, e$event, fixed = TRUE), names(cfg$logos))
    add("congress", e, list(date = l$date, where = l$place), e$place,
        title = md(l$event),
        items = lapply(contribs, function(c) list(type = c$type, text = md(c$title))),
        tag = if (length(l$tag)) l$tag else NULL,
        role = if (length(l$role)) md(l$role) else NULL,
        award = if (length(award)) md(award[1]) else NULL,
        logo = if (length(logo)) file.path(cfg$assets, cfg$logos[[logo[1]]]) else NULL)
  }

  # Charlas y talleres
  for (e in visible(raw("talks")$entries)) {
    l <- loc(e)
    detail <- paste0(if (length(l$detail)) sprintf("<em>%s</em>", md(l$detail)) else "",
                     if (length(l$duration)) sprintf(" <span class=\"vz-duration\">(%s)</span>", esc(decimal(l$duration))) else "")
    add("talk", e, list(date = l$date, where = l$place), e$place,
        title = md(l$title), org = md(l$org),
        items = if (nzchar(detail)) list(list(text = detail)) else list())
  }

  # Estancias de investigación (grupo "visits" de experience.yml)
  for (g in raw("experience")$groups) {
    if (!identical(g$title, cfg$visits)) next
    for (e in visible(g$entries)) {
      l <- loc(e)
      pin <- grep("📍", unlist(e$lines), value = TRUE)
      pin_l <- grep("📍", unlist(l$lines), value = TRUE)
      rest <- setdiff(unlist(l$lines), pin_l)
      add("visit", e, list(date = l$date, where = pin_l), paste(pin, collapse = " "),
          title = md(l$title), org = md(gsub("^📍\\s*", "", pin_l[1] %||% "")),
          items = lapply(rest, function(x) list(text = md(x))),
          logo = if (length(e$logos)) file.path(cfg$img, e$logos[[1]]) else NULL)
    }
  }

  events[order(-vapply(events, `[[`, 0, "sort"))]
}

# Página Visitor completa (se llama desde Visitor.qmd con site = "..", y desde la
# versión española con site = "../.." y lang = "es")
visitor_page <- function(site = "..", lang = "en") {
  cvroot <- file.path(site, "CV")
  cv$lang <- lang
  dict <- cv_dict(cvroot, lang)
  cfg <- read_yaml(file.path(site, "Visitor", "places.yml"))
  cfg$assets <- file.path(site, "Visitor", "assets")
  cfg$img <- file.path(cvroot, "assets", "img")
  places <- lapply(cfg$places, function(p) {
    p <- localize(p, lang)
    p$match <- NULL
    p
  })
  t <- VISITOR_UI[[lang]]
  data <- list(lang = lang, ui = t, places = places, events = visitor_events(cvroot, lang, cfg, dict))
  json <- jsonlite::toJSON(data, auto_unbox = TRUE, null = "null")
  json <- gsub("</", "<\\/", json, fixed = TRUE)

  key <- function(kind) {
    sprintf("<button type=\"button\" class=\"vz-key\" data-kind=\"%s\" aria-pressed=\"true\"><i class=\"vz-dot vz-dot--%s\" aria-hidden=\"true\"></i>%s</button>",
            kind, kind, esc(t[[kind]]))
  }
  stats <- esc(t$stats)
  for (k in c("cities", "countries", "km")) {
    stats <- sub(sprintf("{%s}", k), sprintf("<span class=\"vz-n\" data-stat=\"%s\">0</span>", k), stats, fixed = TRUE)
  }

  html <- paste0(
    "<div class=\"vz\">",
    "<section class=\"vz-stage\">",
    sprintf("<div class=\"vz-map\" role=\"region\" aria-label=\"%s\"><p class=\"vz-hint\" aria-hidden=\"true\"></p></div>", esc(t$map)),
    sprintf("<header class=\"vz-hero\"><h1>%s</h1><p class=\"vz-hero-sub\">%s</p><p class=\"vz-hero-stats\">%s</p></header>",
            esc(t$title), esc(t$sub), stats),
    "<div class=\"vz-controls\">",
    sprintf("<div class=\"vz-views\" role=\"group\" aria-label=\"%s\"><button type=\"button\" data-view=\"map\" aria-pressed=\"false\">%s</button><button type=\"button\" data-view=\"globe\" aria-pressed=\"false\">%s</button></div>",
            esc(t$view), esc(t$view_map), esc(t$view_globe)),
    sprintf("<div class=\"vz-keys\" role=\"group\" aria-label=\"%s\">%s</div>", esc(t$filters),
            paste0(key("congress"), key("visit"), key("talk"))),
    sprintf("<div class=\"vz-ctl\"><div class=\"vz-ctl-head\"><span class=\"vz-ctl-label\">%s</span><output class=\"vz-year-out\"></output></div>", esc(t$journey)),
    sprintf("<div class=\"vz-ctl-row\"><button type=\"button\" class=\"vz-play\" aria-label=\"%s\" title=\"%s\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5.5v13l10.5-6.5z\"/></svg></button>",
            esc(t$play), esc(t$play)),
    sprintf("<input type=\"range\" class=\"vz-year\" step=\"1\" aria-label=\"%s\"></div></div>", esc(t$journey)),
    sprintf("<div class=\"vz-ctl\"><label class=\"vz-ctl-label\" for=\"vz-zoom-%s\">%s</label>", lang, esc(t$zoom)),
    sprintf("<input id=\"vz-zoom-%s\" class=\"vz-zoom\" type=\"range\" min=\"0\" max=\"1\" step=\"0.001\" value=\"0\"></div>", lang),
    sprintf("<div class=\"vz-ctl-foot\"><span class=\"vz-drag\">%s<span class=\"vz-drag-text\">%s</span></span><a class=\"vz-to-log\" href=\"#vz-log\">%s <span aria-hidden=\"true\">↓</span></a></div>",
            ICON_DRAG, esc(t$drag), esc(t$to_log)),
    "</div>",
    "<aside class=\"vz-panel\" aria-live=\"polite\" hidden></aside>",
    "</section>",
    sprintf("<section class=\"vz-log\" id=\"vz-log\"><div class=\"vz-log-card\"><h2>%s</h2><p class=\"vz-log-lead\">%s</p><div class=\"vz-log-list\"></div></div></section>",
            esc(t$log), esc(t$log_lead)),
    "</div>",
    sprintf("<script type=\"application/json\" id=\"visitor-data\">%s</script>", json),
    "<script src=\"https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js\"></script>",
    "<script src=\"https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js\"></script>",
    sprintf("<script src=\"%s/Visitor/assets/visitor.js\"></script>", site)
  )
  cat("```{=html}\n", html, "\n```\n", sep = "")
}
