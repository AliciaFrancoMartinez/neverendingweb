# ─────────────────────────────────────────────────────────────────────────────
#  drawer-snapshot.R — guarda en la web una copia de los proyectos APROBADOS del
#  archivador de la comunidad (Supabase, moderation_status = published).
#
#  Así, lo que apruebas en Supabase queda integrado en la web aunque el proyecto
#  de Supabase se pause. Se ejecuta solo antes de cada `quarto render`
#  (pre-render en _quarto.yml); a mano:  Rscript Researcher/_scripts/drawer-snapshot.R
#
#  · Si Supabase responde, la copia pasa a ser exactamente lo publicado en ese
#    momento (si ocultas un proyecto, desaparece también de la copia).
#  · Si Supabase no responde (p. ej. pausado), se conserva la copia anterior.
# ─────────────────────────────────────────────────────────────────────────────

snapshot_file <- "Researcher/assets/community-drawer.json"
config_file <- "Researcher/assets/drawer-config.js"

take_snapshot <- function() {
  config <- paste(readLines(config_file, warn = FALSE), collapse = "\n")
  base <- regmatches(config, regexpr("https://[a-z0-9]+\\.supabase\\.co", config))
  key <- regmatches(config, regexpr("sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+", config))
  if (!length(base) || !length(key)) stop("no encuentro la URL o la clave en ", config_file)

  query <- paste0(
    "select=id,title,topic,description,stage,abandoned_year,display_name,created_at",
    "&moderation_status=eq.published",
    "&order=abandoned_year.desc.nullslast,created_at.desc&limit=1000")
  tmp <- tempfile(fileext = ".json")
  status <- suppressWarnings(tryCatch(
    download.file(paste0(base, "/rest/v1/drawer_projects?", query), tmp, method = "libcurl", quiet = TRUE,
                  headers = c(apikey = key, Authorization = paste("Bearer", key))),
    error = function(e) 1L))
  if (!identical(as.integer(status), 0L)) {
    message("Drawer: Supabase no responde; se mantiene la copia anterior (", snapshot_file, ")")
    return(invisible(FALSE))
  }
  rows <- jsonlite::fromJSON(tmp, simplifyVector = FALSE)
  if (!is.list(rows)) stop("respuesta inesperada de Supabase")
  json <- jsonlite::toJSON(rows, auto_unbox = TRUE, pretty = TRUE, null = "null")
  old <- if (file.exists(snapshot_file)) paste(readLines(snapshot_file, warn = FALSE, encoding = "UTF-8"), collapse = "\n") else ""
  if (!identical(old, as.character(json))) {
    writeLines(enc2utf8(as.character(json)), snapshot_file, useBytes = TRUE)
    message("Drawer: copia actualizada con ", length(rows), " proyecto(s) publicados")
  } else {
    message("Drawer: la copia ya estaba al día (", length(rows), " proyecto(s))")
  }
  invisible(TRUE)
}

# Nunca debe romper el render de la web
tryCatch(take_snapshot(), error = function(e) message("Drawer: no se pudo actualizar la copia: ", conditionMessage(e)))
