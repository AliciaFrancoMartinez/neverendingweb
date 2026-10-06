# ─────────────────────────────────────────────────────────────────────────────
#  build-pdf.R — genera los PDF del CV a partir de CV/data, en inglés y en español:
#    · CV largo  → CV/cv-print.html → CV/<pdf de profile.yml>        (español: pdf_es)
#    · CV corto  → CV/cv-short.html → CV/<short_pdf de profile.yml>  (español: short_pdf_es)
#
#  Se ejecuta solo antes de cada `quarto render` (pre-render en _quarto.yml) y
#  únicamente rehace cada PDF si has cambiado algún dato o estilo.
#  A mano, desde la carpeta de la web:
#      Rscript CV/_scripts/build-pdf.R           # solo si hay cambios
#      Rscript CV/_scripts/build-pdf.R --force   # siempre
#
#  Necesita Google Chrome (o Chromium). Si está en otro sitio, define la variable
#  de entorno CHROME_PATH con su ruta.
# ─────────────────────────────────────────────────────────────────────────────

source("CV/_scripts/cv.R")

find_chrome <- function() {
  candidates <- c(
    Sys.getenv("CHROME_PATH"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    Sys.which(c("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"))
  )
  candidates <- candidates[nzchar(candidates) & file.exists(candidates)]
  if (length(candidates)) candidates[[1]] else NA_character_
}

chrome_args <- function(html_file) {
  c("--headless", "--disable-gpu", "--no-pdf-header-footer", "--hide-scrollbars",
    "--allow-file-access-from-files", "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=30000", shQuote(paste0("file://", normalizePath(html_file))))
}

# Genera un PDF a partir de un HTML (si sus datos o estilos han cambiado)
build_pdf <- function(label, html_fn, html_file, pdf, exclude, force = FALSE, check_fit = FALSE) {
  inputs <- list.files(file.path(CV_ROOT, c("data", "assets", "_scripts")), recursive = TRUE, full.names = TRUE)
  inputs <- inputs[!grepl(exclude, inputs)]
  if (!force && file.exists(pdf) && max(file.mtime(inputs)) < file.mtime(pdf)) {
    message("CV: el PDF ", label, " ya está al día (", pdf, ")")
    return(invisible(pdf))
  }

  writeLines(enc2utf8(html_fn()), html_file, useBytes = TRUE)
  chrome <- find_chrome()
  if (is.na(chrome)) {
    warning("CV: no encuentro Google Chrome; no se ha podido generar el PDF ", label, ". Define CHROME_PATH.", call. = FALSE)
    return(invisible(NULL))
  }

  tmp_pdf <- tempfile(fileext = ".pdf")
  status <- system2(chrome, c(paste0("--print-to-pdf=", shQuote(tmp_pdf)), chrome_args(html_file)),
                    stdout = FALSE, stderr = FALSE)
  if (status != 0 || !file.exists(tmp_pdf) || file.size(tmp_pdf) < 10000) {
    warning("CV: Chrome no ha podido generar el PDF ", label, " (código ", status, ").", call. = FALSE)
    return(invisible(NULL))
  }
  file.copy(tmp_pdf, pdf, overwrite = TRUE)
  message("CV: PDF ", label, " generado → ", pdf)

  # CV corto: comprueba que todo ha cabido en la página
  if (check_fit) {
    dom <- suppressWarnings(system2(chrome, c("--dump-dom", chrome_args(html_file)), stdout = TRUE, stderr = FALSE))
    over <- regmatches(dom, regexpr("data-overflow=\"[a-z]+\"", dom))
    if (length(over)) {
      col <- if (grepl("side", over[1])) "la columna lateral" else "la columna principal"
      warning("CV: el CV corto no cabe en una página (", col, "). Quita algún `short:` en los YAML.", call. = FALSE)
    }
  }
  invisible(pdf)
}

build_all <- function(force = FALSE) {
  profile <- read_yaml(file.path(CV_ROOT, "data", "profile.yml"))
  # Un juego de PDF por idioma: inglés (pdf, short_pdf) y español (pdf_es, short_pdf_es)
  for (lang in c("en", "es")) {
    field <- function(f) profile[[if (lang == "en") f else paste0(f, "_", lang)]]
    sfx <- if (lang == "en") "" else paste0("-", lang)
    # el diccionario es.yml solo afecta al CV en español
    other_dict <- if (lang == "en") "|data/es\\.yml" else ""
    # los estilos y el JS de la web no afectan a los PDF
    if (length(field("pdf"))) {
      build_pdf(paste("largo", lang), function() cv_print_html(lang = lang), file.path(CV_ROOT, paste0("cv-print", sfx, ".html")),
                file.path(CV_ROOT, field("pdf")),
                exclude = paste0("cv-web\\.|cv-short\\.|_LEEME|photo\\.", other_dict), force = force)
    }
    if (length(field("short_pdf"))) {
      build_pdf(paste("corto", lang), function() cv_short_html(lang = lang), file.path(CV_ROOT, paste0("cv-short", sfx, ".html")),
                file.path(CV_ROOT, field("short_pdf")),
                exclude = paste0("cv-web\\.|cv-print\\.|cv-paged\\.|_LEEME", other_dict), force = force, check_fit = TRUE)
    }
  }
}

# Nunca debe romper el render de la web: si algo falla, solo avisa.
tryCatch(
  build_all(force = "--force" %in% commandArgs(trailingOnly = TRUE)),
  error = function(e) warning("CV: error al generar el PDF: ", conditionMessage(e), call. = FALSE)
)
