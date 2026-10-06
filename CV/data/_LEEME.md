# Cómo actualizar el CV

Todo el contenido del CV vive en esta carpeta, un archivo `.yml` por sección.
La pestaña **CV** de la web y el **PDF** se generan a partir de estos archivos con la misma estética,
así que solo hay que tocar los datos. Con los mismos archivos se genera también la versión en **español**
(web `es/cv.html` y PDF `_ES`): mira [Versión en español](#versión-en-español).

| Archivo             | Sección                         |
|---------------------|---------------------------------|
| `profile.yml`       | nombre, contacto, orden de las secciones, fecha del PDF |
| `education.yml`     | Education                       |
| `experience.yml`    | Research Experience & Visits    |
| `publications.yml`  | Publications                    |
| `awards.yml`        | Grants & Awards                 |
| `conferences.yml`   | Conferences                     |
| `talks.yml`         | Invited Talks & Workshops       |
| `teaching.yml`      | Teaching & Supervising          |
| `dissemination.yml` | Dissemination & Community       |
| `training.yml`      | Training & Courses              |
| `skills.yml`        | Skills, Languages & Other       |
| `es.yml`            | traducciones al español que se repiten (lugares, tipos de comunicación…) |

Al principio de cada archivo hay un comentario con los campos que admite.

## Añadir un mérito

1. Abre el `.yml` de la sección.
2. Copia una entrada parecida (desde el guion `-` hasta antes del siguiente guion) y pégala **arriba**:
   el orden del archivo es el orden del CV.
3. Cambia los textos.
4. Ejecuta en la terminal, desde la carpeta de la web:

   ```bash
   quarto render
   ```

   Esto regenera la web **y** el PDF (`CV/CV_AliciaFranco-Martinez.pdf`). Con `quarto preview` lo ves en directo.

Ejemplo: un premio nuevo en `awards.yml`:

```yaml
entries:
  - date: "2026"
    title: "Best Talk Award, EAM"
    org: "European Association of Methodology"
    project: "Título de la charla"
    amount: "Award: €300"

  - date: "2025"          # ← la entrada que ya estaba
    ...
```

Ejemplo: una publicación nueva en `publications.yml` (dentro del grupo que toque):

```yaml
      - date: "2026"
        authors: "Franco-Martínez, A., & Vadillo, M. A."
        title: "Título del artículo"
        venue: "*Nombre de la Revista*, *12*(3), 45–67."
        doi: "10.xxxx/xxxxx"
        open_access: true
        badges: { prereg: yes, data: yes, materials: yes, code: no }
```

Tu nombre se pone en negrita solo (lo controla `highlight` en `profile.yml`).

## Versión en español

Cada campo admite su traducción con el sufijo `_es` justo al lado del original:

```yaml
  - date: "2026"
    title: "Best Talk Award, EAM"
    title_es: "Premio a la mejor charla, EAM"
    org: "European Association of Methodology"
    project: "Título de la charla"
    amount: "Award: €300"
    amount_es: "Dotación: 300 €"
```

- Si un campo **no** tiene `_es`, en la versión en español sale tal cual (en inglés). Así nunca se rompe nada:
  si un día no te apetece traducir, el mérito aparece igualmente.
- Vale para cualquier campo: `title_es`, `lines_es`, `org_es`, `detail_es`, `short_es` (CV corto), `chip_es` (botón
  de filtro), `label_es` (contadores de `profile.yml`), `pdf_es` (nombre del PDF en español)…
  En los campos que son listas (`lines`, `places`, `short`…) la versión `_es` sustituye a la lista entera.
- Los títulos de publicaciones y comunicaciones se dejan en su idioma original; solo llevan `title_es` las que
  se presentaron en español.
- Lo que se repite mucho se traduce una sola vez en **`es.yml`**:
  - `textos`: textos completos (p. ej. `"Poster": "Póster"`, `"Doctoral School": "Escuela de Doctorado"`).
  - `fechas`: palabras sueltas dentro de las fechas (`Jan` → `Ene`, `since` → `desde`).
  - `lugares`: palabras sueltas dentro de lugares y textos libres (`Spain` → `España`).
- Los textos fijos de la plantilla (botones, rótulos del CV corto…) están en la lista `UI` al principio de
  `CV/_scripts/cv.R`.

`quarto render` genera los cuatro PDF: `CV_AliciaFranco-Martinez.pdf` y `…_short.pdf` (inglés), y
`…_ES.pdf` y `…_short_ES.pdf` (español). La vista previa del CV en español está en `CV/cv-print-es.html`
y `CV/cv-short-es.html`.

## Reglas de YAML que conviene recordar

- **Pon los textos entre comillas** `"..."`. Es obligatorio si el texto contiene `: ` (dos puntos y espacio) o empieza por `[`, `*`, `&`, `#`…
  Si el texto lleva comillas dobles dentro, usa las tipográficas “así”.
- La **sangría** (espacios a la izquierda) importa: copia la de las entradas vecinas. Nunca uses tabuladores.
- Lo que va detrás de `#` es un comentario y no sale en el CV.
- Para **ocultar** una entrada sin borrarla, añade `hide: true`.

## Formato dentro de los textos

- `*cursiva*`, `**negrita**`, `[texto del enlace](https://...)`
- Emojis tal cual: `📍 Madrid, Spain`, `🔗`, `🎙️`…
- Una fecha en dos líneas (en *talks*): `date: ["Feb 2025", "& Mar 2024"]`

## Imágenes (logos y miniaturas)

Guarda la imagen en `CV/assets/img/` y pon solo el nombre del archivo, por ejemplo
`logos: ["logo-ucl.png"]` en *experience* o `image: "dis-paciencia.jpg"` en *dissemination*.
Mejor en PNG/JPG de unos 500 px de ancho como máximo.

## Opciones de la versión web

La pestaña CV de la web usa los mismos datos que el PDF, con algunas opciones solo para la web:

- **Contadores de la cabecera** (`stats` en `profile.yml`): se recalculan solos al añadir méritos.
- **Filtros** (`web_filter` al principio de una sección):
  - `web_filter: groups` crea un botón por grupo. El texto del botón sale del campo `chip:` del grupo o, si no lo tiene, de su título.
  - `web_filter: types` (en *conferences*) crea un botón por tipo de comunicación: Oral, Poster…
- **Listas largas** (`web_limit: 6`): enseña solo las 6 primeras entradas y un botón "Show all".
- El **buscador** y el **índice lateral** funcionan solos con cualquier sección.

Los estilos de la web están en `CV/assets/cv-web.css` y su comportamiento en `CV/assets/cv-web.js`.

## CV corto (una página)

Se genera solo (`CV/CV_AliciaFranco-Martinez_short.pdf`) con los mismos datos que el largo.
Qué aparece se decide con el campo `short:` de cada mérito:

| Valor | Resultado |
|-------|-----------|
| `short: true` | formato automático: cita compacta en *publications*, título + texto en *skills*, y en *conferences* se agrupan por `series` |
| `short: "texto"` | una línea con ese texto (admite *cursiva*, **negrita** y enlaces) |
| `short: ["texto", "sublínea", …]` | línea principal y sublíneas en cursiva |

Dónde va cada cosa:
- **Columna lateral**: la presentación (`bio` en `profile.yml`), los contactos (`handle` = texto junto al icono), *skills* y las asignaturas del grupo *Teaching* (más `short_note`).
- **Columna principal**:
  - **Education** (más `short_note`).
  - **Experience**: *Research* (experience + projects), *Publications*, *Conferences* y *Dissemination & community*.

En *conferences*, el campo `series` agrupa los congresos (p. ej. "ASSC Annual Meetings") y `short_note` añade un premio entre corchetes.

Si el contenido no cabe, la letra se reduce sola (hasta un 20 %). Si aun así no cabe, `quarto render` avisa: entonces quita algún `short:`.
Para verlo en el navegador, abre `CV/cv-short.html`.

## Añadir una sección nueva

1. Crea `CV/data/<nombre>.yml` con `title:` y `entries:` (o `groups:`).
2. Añade `<nombre>` a la lista `sections` de `profile.yml`, en la posición que quieras.

Si la sección no tiene una plantilla propia, usa la genérica: `date`, `title`, `org`, `project` (cursiva), `amount` y `lines` (texto libre).

## Si algo no sale

- **El PDF no se actualiza:** `Rscript CV/_scripts/build-pdf.R --force` lo regenera siempre (necesita Google Chrome instalado).
- **Vista previa paginada:** abre `CV/cv-print.html` en Chrome para ver las páginas tal como saldrán en el PDF.
- **Error de YAML:** casi siempre son unas comillas que faltan o una sangría desplazada en la línea que indica el error.
- Los **estilos** del PDF están en `CV/assets/cv.css` y `CV/assets/cv-print.css`; los de la web, en `CV/assets/cv-web.css`. La plantilla que convierte los datos en HTML está en `CV/_scripts/cv.R`.
