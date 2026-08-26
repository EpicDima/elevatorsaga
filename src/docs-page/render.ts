/**
 * The reference page, rendered from the catalogs, one file per locale.
 *
 * The prose is `#i18n/docs-en.ts` and its translations and the shape is
 * `./structure.ts`, so this is the only copy of either: a language costs a
 * catalog and an entry in `CATALOGS`, not another page to keep in step.
 *
 * Build-time only. `vite.config.ts` calls this and emits the result, so nothing
 * here is imported by anything the browser runs.
 */

import { EN_DOCS_MESSAGES, type DocsCatalog, type DocsMessageKey } from "#i18n/docs-en.ts";
import { RU_DOCS_MESSAGES } from "#i18n/docs-ru.ts";
import { EN_MESSAGES } from "#i18n/en.ts";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, type Locale } from "#i18n/locale.ts";
import { RU_MESSAGES } from "#i18n/ru.ts";
import { iconMarkup } from "#shared/ui/icon.ts";

import { DOCS_PAGE, type ApiTable, type Block } from "./structure.ts";

/** The reference page's own text, in every language it is written in. */
const CATALOGS: Readonly<Record<Locale, DocsCatalog>> = {
  en: EN_DOCS_MESSAGES,
  ru: RU_DOCS_MESSAGES,
};

/**
 * The skeleton the "Basics" section walks through.
 *
 * The one message the page takes from the game's own catalog rather than the
 * reference one: the completion popup inserts the same text, so it ships with
 * the game and `src/page.test.ts` holds the two to each other.
 */
const BASICS_EXAMPLE: Readonly<Record<Locale, string>> = {
  en: EN_MESSAGES["docs.basics.example.code"],
  ru: RU_MESSAGES["docs.basics.example.code"],
};

/** The colors the page paints before its stylesheet arrives: `--ds-bg`, `--ds-text`. */
const FIRST_PAINT = { background: "#131519", text: "#e7e9ec" } as const;

/**
 * The two glyphs `docs.play.start.html` names in place of the speed buttons.
 *
 * The message says `{increase}` and `{decrease}` rather than carrying the
 * markup, so a translator never sees a path full of coordinates.
 */
const SPEED_ICONS: Readonly<Record<string, string>> = {
  increase: iconMarkup("plus", "emphasis-color"),
  decrease: iconMarkup("minus", "emphasis-color"),
};

/**
 * Text made safe to put in an HTML document.
 *
 * @param value - The text.
 * @returns It, with the three characters that would otherwise be markup escaped.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

/**
 * The file a locale's page is served from.
 *
 * The default locale keeps the bare name, so the address the game has always
 * linked to stays what it was; every other locale is suffixed with its own tag.
 *
 * @param locale - Which language.
 * @returns The file name, relative to the site root.
 */
export function docsPageFile(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "documentation.html" : `documentation.${locale}.html`;
}

/**
 * One message, in one language.
 *
 * @param locale - Which language.
 * @param key - Which message.
 * @returns Its text, as the catalog holds it.
 */
function message(locale: Locale, key: DocsMessageKey): string {
  return CATALOGS[locale][key];
}

/**
 * A passage of prose, ready to print.
 *
 * A key suffixed `.html` is trusted markup and goes out as it is; anything else
 * is plain text and is escaped. The suffix rules are the catalogs' own, and
 * `src/i18n/catalog.test.ts` enforces them there.
 *
 * @param locale - Which language.
 * @param key - Which message.
 * @returns The passage as markup.
 */
function prose(locale: Locale, key: DocsMessageKey): string {
  const text = message(locale, key);
  const markup = key.endsWith(".html") ? text : escapeHtml(text);
  return markup.replace(/\{(increase|decrease)\}/gu, (whole, name: string) => {
    return SPEED_ICONS[name] ?? whole;
  });
}

/**
 * An example, in a block a reader can copy from.
 *
 * @param code - The example.
 * @returns A `<pre><code>` block holding it.
 */
function codeBlock(code: string): string {
  return `<pre><code>${escapeHtml(code)}</code></pre>`;
}

/**
 * The example a table row shows, which some rows do not have.
 *
 * @param locale - Which language.
 * @param row - The row.
 * @returns Its example as markup, or an empty string where it has none.
 */
function rowExample(locale: Locale, row: ApiTable["rows"][number]): string {
  if (row.exampleKey !== undefined) {
    return codeBlock(message(locale, row.exampleKey));
  }
  return row.example === undefined ? "" : codeBlock(row.example);
}

/**
 * One API table.
 *
 * The column widths are set by a `<colgroup>` rather than by the cells, so the
 * explanation column keeps its width whether or not the table carries types.
 *
 * @param locale - Which language.
 * @param table - The table.
 * @returns Its markup.
 */
function renderTable(locale: Locale, table: ApiTable): string {
  const typed = table.rows.some((row) => row.type !== undefined);
  const columns = typed
    ? `<col class="doccol-name" /><col class="doccol-type" /><col class="doccol-explanation" /><col />`
    : `<col class="doccol-name" /><col class="doccol-explanation-wide" /><col />`;
  const headings = [
    message(locale, `docs.table.${table.column}`),
    ...(typed ? [message(locale, "docs.table.type")] : []),
    message(locale, "docs.table.explanation"),
    message(locale, "docs.table.example"),
  ];
  const head = headings
    .map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`)
    .join("\n              ");
  const rows = table.rows
    .map((row) => {
      const cells = [
        `<td>${escapeHtml(row.name)}</td>`,
        ...(typed
          ? [
              `<td>${row.type === undefined ? "" : escapeHtml(message(locale, `docs.type.${row.type}`))}</td>`,
            ]
          : []),
        `<td><small>${prose(locale, row.key)}</small></td>`,
        `<td>${rowExample(locale, row)}</td>`,
      ];
      return `            <tr>\n              ${cells.join("\n              ")}\n            </tr>`;
    })
    .join("\n");
  return `        <table class="doctable">
          <colgroup>${columns}</colgroup>
          <thead>
            <tr>
              ${head}
            </tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>`;
}

/**
 * One piece of the page.
 *
 * @param locale - Which language.
 * @param block - The piece.
 * @returns Its markup.
 */
function renderBlock(locale: Locale, block: Block): string {
  switch (block.block) {
    case "heading": {
      const id = block.id === undefined ? "" : ` id="${block.id}"`;
      const tag = `h${String(block.level)}`;
      return `        <${tag}${id}>${prose(locale, block.key)}</${tag}>`;
    }
    case "prose":
      return `        <p>${prose(locale, block.key)}</p>`;
    case "code":
      return `        ${codeBlock(BASICS_EXAMPLE[locale])}`;
    case "examples": {
      const entries = block.entries
        .map(
          (entry) =>
            `          <dt>${codeBlock(entry.code)}</dt>\n` +
            `          <dd>${prose(locale, entry.key)}</dd>`,
        )
        .join("\n");
      return `        <dl>\n${entries}\n        </dl>`;
    }
    case "table":
      return renderTable(locale, block.table);
  }
}

/**
 * The links that name every language this page exists in.
 *
 * Each version lists them all, itself included, so the set is visible whichever
 * one a reader arrives at first.
 *
 * @returns The `<link rel="alternate">` tags, one per locale.
 */
function alternateLinks(): string {
  // `vite-ignore` because Vite treats every `<link href>` as an asset to resolve
  // without looking at `rel`. Without it the build copies each page into
  // `dist/assets/` under a hashed name and points these links at the copies,
  // which is a second, unlinked site.
  return LOCALES.map(
    (locale) =>
      `    <link rel="alternate" hreflang="${locale}" href="${docsPageFile(locale)}" vite-ignore />`,
  ).join("\n");
}

/**
 * The reference page, in one language.
 *
 * @param locale - Which language.
 * @returns The page's full HTML.
 */
export function renderDocsPage(locale: Locale): string {
  const t = (key: DocsMessageKey): string => escapeHtml(message(locale, key));
  const others = LOCALES.filter((candidate) => candidate !== locale).map(
    // Named in the language it leads to, which is how a reader who needs it
    // recognizes it while the page around them is still in another language.
    (candidate) =>
      `          <a href="${docsPageFile(candidate)}" lang="${candidate}" hreflang="${candidate}">` +
      `${escapeHtml(LOCALE_NAMES[candidate])}</a>`,
  );
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html {
        background: ${FIRST_PAINT.background};
        color: ${FIRST_PAINT.text};
        color-scheme: dark;
      }

      body {
        visibility: hidden;
      }
    </style>
    <title>${t("docs.page.title")}</title>
    <meta name="description" content="${t("docs.page.description")}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
${alternateLinks()}
    <script type="module" src="/src/docs.ts"></script>
  </head>
  <body>
    <div class="container narrow">
      <header class="header">
        <h1>Elevator Saga <em class="emphasis-color">${t("docs.page.tagline")}</em></h1>
        <nav aria-label="${t("docs.nav.label")}">
          <a href="index.html">${t("docs.nav.back")}</a>
${others.join("\n")}
        </nav>
      </header>

      <main class="help">
${DOCS_PAGE.map((block) => renderBlock(locale, block)).join("\n")}
      </main>

      <footer class="footer">
        <p>${t("docs.footer.made")}</p>
        <p>${prose(locale, "docs.footer.source.html")}</p>
        <p>${prose(locale, "docs.footer.licenses.html")}</p>
      </footer>
    </div>
  </body>
</html>
`;
}
