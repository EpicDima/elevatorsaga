/**
 * The docs dialog: `design/ui-mockup.html`'s own `<dialog class="docs">` — the
 * chrome around a guide, a code skeleton, a lead paragraph and the API
 * reference table (`#entities/api-reference`), plus the search box that
 * filters all three.
 *
 * The mockup builds `.docs-body`'s contents once, at load, with a single
 * `docsBody.innerHTML =` assignment run from its own `<script>`. This module
 * draws the same markup up front instead, inside {@link docsModalTemplate}'s
 * own `markup` tagged template, the same "build inert first" every widget in
 * this migration has followed — there is no runtime assembly step left for
 * {@link presentDocsModal} to redo.
 *
 * ## Search
 *
 * `presentDocsModal` ports the mockup's own `filterDocs()`/`searchDocs()`
 * closures near verbatim: a query hides every `.api` row whose own text
 * (summary and expanded detail alike) does not contain it, opens a row that
 * matched only in its own hidden detail — marking it `data-by-search` so a
 * search that moves on can fold it back up — and hides a group's own `<h3>`
 * once none of its rows survive. The guide, the intro code and the lead
 * paragraph are not filtered; they are hidden outright while a query is live,
 * the same as the mockup's own three `.hidden = query !== ""` lines. Clearing
 * the dialog's own scroll position is likewise ported: a search jumps the
 * body to its top and a cleared one returns it to whatever a player scrolled
 * to before searching, tracked by a `scroll` listener the same way the
 * mockup's own `docsScroll` is.
 *
 * ## Departures from the mockup
 *
 * - `#docsClear`'s glyph is `spriteIconMarkup("x")` rather than the mockup's
 *   own `#i-x` sprite reference — the two are the same outline, ported once
 *   already for the tier popover's own "requirement missed" mark.
 * - Every `<details class="api">` row's own `<summary>` chevron is
 *   `spriteIconMarkup("right", "chev")`, `settings-menu.ts`'s own `keysopen`
 *   row's convention, rather than the mockup's raw `<svg class="icon chev">`.
 * - Every code example — the intro skeleton and each API row's own — goes
 *   through `highlightJavaScript` and is wrapped in `<pre><code>`,
 *   `src/ui/templates.ts`'s own `tutorialAnswerTemplate` convention, rather
 *   than the mockup's bare `<pre>` (intro) or its own separate `highlight()`
 *   helper (API rows).
 * - `#docsFind`, `#docsClear` and `#docsClose` are ids in the mockup, one
 *   static page's worth; this module is a widget a caller can build more than
 *   once, so `#docsClear`/`#docsClose` become classes instead (`.docsclear`,
 *   `.docsclose`), the same substitution `settings-menu.ts` already makes for
 *   `#docsOpen`/`#setOpen`/`#keysOpen`. `#docsFind` needed none: the mockup
 *   already gives it the class `docs-find` alongside its id. `#docsBody` and
 *   `#docsEmpty` likewise already carry `docs-body`/`docs-empty`.
 *
 * Built and unit-tested against a jsdom `<dialog>` — `polyfillDialogElement`
 * (`#shared/ui/test-helpers.ts`) — but not wired into `src/app/app.ts` or
 * `settings-menu.ts`'s `docsopen` opener yet, matching every widget staged so
 * far in this migration.
 */

import { API_REFERENCE, type ApiReferenceEntry } from "#entities/api-reference/index.ts";
import { t } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { createModal, type Modal } from "#shared/ui/modal.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { highlightJavaScript } from "../../../ui/code-highlight.ts";
import { markup, raw } from "../../../ui/templates.ts";

/** Counter for {@link docsModalTemplate}'s own title id, unique per call. */
let nextTitleId = 0;

/**
 * Markup for one `<details class="api">` row.
 *
 * @param entry - The row's own signature and catalogue keys.
 * @returns The row's markup.
 */
function apiEntryMarkup(entry: ApiReferenceEntry): string {
  const short = t(entry.shortKey);
  const more = t(entry.moreKey);
  const code = highlightJavaScript(t(entry.codeKey));
  return markup`<details class="api"><summary>${raw(spriteIconMarkup("right", "chev"))}<code>${entry.sig}</code><span>${short}</span></summary><div class="api-more"><p>${more}</p><pre><code>${raw(code)}</code></pre></div></details>`;
}

/**
 * Markup for {@link API_REFERENCE}'s own groups, one heading per group
 * followed by its rows, in the table's own order.
 *
 * @returns The reference table's markup.
 */
function apiReferenceMarkup(): string {
  return API_REFERENCE.map(
    (group) => markup`<h3>${t(group.labelKey)}</h3>` + group.entries.map(apiEntryMarkup).join(""),
  ).join("");
}

/**
 * Markup for the guide: `design/ui-mockup.html`'s own `GUIDE` template
 * literal, ported section by section.
 *
 * @returns The guide's markup, one `<section class="docs-guide">`.
 */
function guideMarkup(): string {
  return markup`<section class="docs-guide"><h3>${t("game.docs.guide.whatGame.heading")}</h3><p>${t("game.docs.guide.whatGame.body")}</p><h3>${t("game.docs.guide.whatToDo.heading")}</h3><ol class="docs-steps"><li>${t("game.docs.guide.whatToDo.step1")}</li><li>${t("game.docs.guide.whatToDo.step2")}</li><li>${raw(t("game.docs.guide.whatToDo.step3.html"))}</li><li>${t("game.docs.guide.whatToDo.step4")}</li></ol><h3>${t("game.docs.guide.carArrows.heading")}</h3><p>${raw(t("game.docs.guide.carArrows.html"))}</p><h3>${t("game.docs.guide.readingResults.heading")}</h3><p>${t("game.docs.guide.readingResults.body")}</p><h3>${t("game.docs.guide.threeStars.heading")}</h3><p>${raw(t("game.docs.guide.threeStars.html"))}</p><h3>${t("game.docs.guide.tutorialLevels.heading")}</h3><p>${t("game.docs.guide.tutorialLevels.body")}</p></section>`;
}

/**
 * The dialog's inert markup, ready for {@link presentDocsModal}.
 *
 * @returns The dialog's markup, describing exactly one `<dialog class="docs">`.
 */
export function docsModalTemplate(): string {
  const titleId = `docs-modal-title-${String(nextTitleId)}`;
  nextTitleId += 1;

  const title = t("game.docs.title");
  const searchPlaceholder = t("game.docs.searchPlaceholder");
  const clearSearch = t("game.docs.clearSearch");
  const closeTitle = t("game.docs.closeTitle");
  const close = t("game.docs.close");
  const introHeading = t("game.docs.intro.heading");
  const introCode = highlightJavaScript(t("game.docs.intro.example.code"));
  const lead = t("game.docs.lead.html");
  const empty = t("game.docs.empty");

  return markup`<dialog class="docs" aria-labelledby="${titleId}"><div class="docs-head"><h2 id="${titleId}">${title}</h2><div class="docs-search"><input class="docs-find" type="search" placeholder="${searchPlaceholder}" spellcheck="false" autocomplete="off" /><button type="button" class="docsclear" title="${clearSearch}" aria-label="${clearSearch}" hidden>${raw(spriteIconMarkup("x"))}</button></div><button type="button" class="btn docsclose" title="${closeTitle}">${close}</button></div><div class="docs-body">${raw(guideMarkup())}<h3>${introHeading}</h3><pre class="docs-intro"><code>${raw(introCode)}</code></pre><p class="docs-lead">${raw(lead)}</p>${raw(apiReferenceMarkup())}<div class="docs-empty" hidden>${empty}</div></div></dialog>`;
}

/**
 * Wires the dialog's search box, its close button and its own backdrop click
 * into an open/close pair — {@link createModal}'s pair for the close button
 * and the backdrop, plus the search-clearing and scroll-restoring behaviour
 * this module's own doc comment describes.
 *
 * @param dialog - The `<dialog class="docs">` built from
 * {@link docsModalTemplate}'s markup.
 * @returns The modal, closed to start.
 */
export function presentDocsModal(dialog: HTMLDialogElement): Modal {
  const closeButton = requireElement(".docsclose", dialog);
  const modal = createModal(dialog, closeButton);

  const docsBody = requireElement(".docs-body", dialog);
  const docsClear = requireElement(".docsclear", dialog);
  const docsEmpty = requireElement(".docs-empty", dialog);
  const guide = requireElement(".docs-guide", dialog);
  const intro = requireElement(".docs-intro", dialog);
  const lead = requireElement(".docs-lead", dialog);

  const docsFindElement = requireElement(".docs-find", dialog);
  if (!(docsFindElement instanceof HTMLInputElement)) {
    throw new TypeError("Expected .docs-find to be an <input>");
  }
  const docsFind = docsFindElement;

  const apiRows = queryAll(".api", dialog).map((row) => {
    if (!(row instanceof HTMLDetailsElement)) {
      throw new TypeError("Expected .api to be a <details>");
    }
    return row;
  });

  // Distinguishes a row a search opened -- which folds back up once the
  // search that opened it moves on -- from one a player opened by hand,
  // which does not. The same distinction design/ui-mockup.html's own
  // `applyingSearch` flag and `dataset.bySearch` marker draw: a `toggle`
  // fired while this is true is the filter's own doing, not a click.
  let applyingSearch = false;
  for (const row of apiRows) {
    row.addEventListener("toggle", () => {
      if (!applyingSearch) {
        delete row.dataset["bySearch"];
      }
    });
  }

  function filterDocs(): void {
    const query = docsFind.value.trim().toLowerCase();
    docsClear.hidden = docsFind.value === "";
    let found = 0;
    applyingSearch = true;
    for (const row of apiRows) {
      // The previous search's own finds fold shut wholesale: otherwise a
      // dozen rows opened on the way to one word stay open forever.
      if (row.dataset["bySearch"] !== undefined) {
        row.open = false;
        delete row.dataset["bySearch"];
      }
      // The row's detail is searched too -- textContent sees it even
      // closed -- but a match found only inside means the row has to open,
      // or nothing on screen explains why it's in the results.
      const match = row.textContent.toLowerCase().includes(query);
      row.hidden = !match;
      if (!match) {
        continue;
      }
      found += 1;
      const summaryText = (row.querySelector("summary")?.textContent ?? "").toLowerCase();
      if (query !== "" && !row.open && !summaryText.includes(query)) {
        row.open = true;
        row.dataset["bySearch"] = "1";
      }
    }
    applyingSearch = false;

    // A group's own heading hides with its last surviving row; the intro
    // heading, which has no `.api` rows of its own, hides outright once a
    // query is live, the same as the guide and the lead below.
    for (const head of queryAll(":scope > h3", docsBody)) {
      let node: Element | null = head.nextElementSibling;
      let siblingRowCount = 0;
      let alive = false;
      while (node instanceof HTMLElement && node.classList.contains("api")) {
        siblingRowCount += 1;
        alive = alive || !node.hidden;
        node = node.nextElementSibling;
      }
      head.hidden = siblingRowCount === 0 ? query !== "" : !alive;
    }

    // The "how to play" guide never takes part in a search: what's looked
    // for there is always a specific call, never a paragraph about the
    // game's own point.
    guide.hidden = query !== "";
    intro.hidden = query !== "";
    lead.hidden = query !== "";
    docsEmpty.hidden = found > 0;
  }

  // Where the dialog was scrolled to when it was closed, remembered across
  // the page's own session: read to onIdle, closed to look at the building,
  // reopened, and still on onIdle. Search doesn't count towards it: a
  // search's own results start at the top, and clearing one returns the body
  // to wherever it was scrolled before.
  let docsScroll = 0;
  let docsSearching = false;

  docsBody.addEventListener("scroll", () => {
    if (!docsSearching) {
      docsScroll = docsBody.scrollTop;
    }
  });

  function searchDocs(): void {
    const searching = docsFind.value.trim() !== "";
    filterDocs();
    if (searching !== docsSearching) {
      docsBody.scrollTop = searching ? 0 : docsScroll;
    }
    docsSearching = searching;
  }

  docsFind.addEventListener("input", searchDocs);
  docsClear.addEventListener("click", () => {
    docsFind.value = "";
    searchDocs();
    docsFind.focus();
  });

  // The dialog's own close, however it happens -- the close button, the
  // backdrop, Escape -- clears the search: the dialog reopens on the guide,
  // not partway through whatever was typed last time.
  dialog.addEventListener("close", () => {
    if (docsFind.value === "") {
      return;
    }
    docsFind.value = "";
    searchDocs();
  });

  return {
    open(): void {
      if (dialog.open) {
        return;
      }
      modal.open();
      docsBody.scrollTop = docsScroll;
      docsFind.focus();
    },
    close(): void {
      modal.close();
    },
  };
}
