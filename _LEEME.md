# La web en dos idiomas

- **Inglés** (idioma por defecto): las páginas de siempre, en la raíz (`index.qmd`, `Researcher/`, `Visitor/`, `cv.qmd`).
- **Español**: la carpeta `es/`, con las **mismas rutas** (`es/index.qmd`, `es/Researcher/Researcher.qmd`…).
  `es/_metadata.yml` hace que todas sus páginas sean `lang: es`.
- El botón **EN / ES** del menú (`_includes/lang-switch.html`) lleva a la misma página en el otro idioma, conservando la
  sección (`#community`, `#cv-publications`…). En las páginas de `es/` también traduce el menú. Nunca redirige solo:
  quien entra siempre ve el inglés.

## Al cambiar algo

- **Textos de una página**: cambia la versión inglesa y su gemela en `es/` (cada página española lo recuerda en un
  comentario al principio).
- **CV**: solo se editan los datos de `CV/data/` (traducciones en los campos `*_es` y en `CV/data/es.yml`).
  Instrucciones en `CV/data/_LEEME.md`.
- **Mi archivador** (*My file drawer*): cada proyecto de `Researcher/assets/my-drawer.js` lleva su traducción en el campo `es`.
  Los proyectos de la comunidad se muestran tal como los escribe cada persona.
- **Scripts y estilos**: son los mismos para los dos idiomas (`assets/home.js`, `Researcher/assets/timeline.js`,
  `Researcher/assets/drawer.js`, `Visitor/assets/map.js` y las hojas `.css`), así que se cambian una sola vez.

## Página nueva

1. Crea la página en inglés y añádela al menú en `_quarto.yml`.
2. Crea su versión en español con la misma ruta dentro de `es/`.
3. Añade su nombre en español a `MENU_ES` en `_includes/lang-switch.html`.
