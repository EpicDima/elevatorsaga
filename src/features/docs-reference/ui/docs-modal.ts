/**
 * The docs dialog: chrome around a guide, a code skeleton, a lead paragraph, an
 * API reference table, and the search box that filters all three. Everything
 * is addressed by class rather than id, since a caller can build this widget
 * more than once.
 */

import { API_REFERENCE, type ApiReferenceEntry } from "#entities/api-reference/index.ts";
import { t } from "#i18n/index.ts";
import { queryAll, requireElement } from "#shared/lib/dom.ts";
import { createModal, type Modal } from "#shared/ui/modal.ts";
import { spriteIconMarkup } from "#shared/ui/icon.ts";
import { markup, raw } from "#shared/ui/markup.ts";
import { highlightJavaScript } from "../../../ui/code-highlight.ts";

/** Counter for a unique title id per modal instance. */
let nextTitleId = 0;

/** Markup for one `<details class="api">` row. */
function apiEntryMarkup(entry: ApiReferenceEntry): string {
  const short = t(entry.shortKey);
  const more = t(entry.moreKey);
  const code = highlightJavaScript(t(entry.codeKey));
  return markup`<details class="api"><summary>${raw(spriteIconMarkup("right", "chev"))}<code>${entry.sig}</code><span>${short}</span></summary><div class="api-more"><p>${more}</p><pre><code>${raw(code)}</code></pre></div></details>`;
}

/** Markup for {@link API_REFERENCE}'s groups, one heading per group followed by its rows. */
function apiReferenceMarkup(): string {
  return API_REFERENCE.map(
    (group) => markup`<h3>${t(group.labelKey)}</h3>` + group.entries.map(apiEntryMarkup).join(""),
  ).join("");
}

/** Markup for the guide: one heading-and-body section per topic. */
function guideMarkup(): string {
  return markup`<section class="docs-guide"><h3>${t("game.docs.guide.whatGame.heading")}</h3><p>${t("game.docs.guide.whatGame.body")}</p><h3>${t("game.docs.guide.whatToDo.heading")}</h3><ol class="docs-steps"><li>${t("game.docs.guide.whatToDo.step1")}</li><li>${t("game.docs.guide.whatToDo.step2")}</li><li>${raw(t("game.docs.guide.whatToDo.step3.html"))}</li><li>${t("game.docs.guide.whatToDo.step4")}</li></ol><h3>${t("game.docs.guide.carArrows.heading")}</h3><p>${raw(t("game.docs.guide.carArrows.html"))}</p><h3>${t("game.docs.guide.readingResults.heading")}</h3><p>${t("game.docs.guide.readingResults.body")}</p><h3>${t("game.docs.guide.threeStars.heading")}</h3><p>${raw(t("game.docs.guide.threeStars.html"))}</p><h3>${t("game.docs.guide.tutorialLevels.heading")}</h3><p>${t("game.docs.guide.tutorialLevels.body")}</p></section>`;
}

/**
 * Markup for `.docs-body`: guide, intro skeleton, lead paragraph, API
 * reference table, and the "nothing found" panel. Shared between the initial
 * build and {@link presentDocsModal}'s `update` so the two never drift apart.
 */
function docsBodyMarkup(): string {
  const introHeading = t("game.docs.intro.heading");
  const introCode = highlightJavaScript(t("game.docs.intro.example.code"));
  const lead = t("game.docs.lead.html");
  const empty = t("game.docs.empty");

  return markup`${raw(guideMarkup())}<h3>${introHeading}</h3><pre class="docs-intro"><code>${raw(introCode)}</code></pre><p class="docs-lead">${raw(lead)}</p>${raw(apiReferenceMarkup())}<div class="docs-empty" hidden>${empty}</div>`;
}

/** The dialog's inert markup, ready for {@link presentDocsModal}. */
export function docsModalTemplate(): string {
  const titleId = `docs-modal-title-${String(nextTitleId)}`;
  nextTitleId += 1;

  const title = t("game.docs.title");
  const searchPlaceholder = t("game.docs.searchPlaceholder");
  const clearSearch = t("game.docs.clearSearch");
  const closeTitle = t("game.docs.closeTitle");
  const close = t("game.docs.close");

  return markup`<dialog class="docs" aria-labelledby="${titleId}"><div class="docs-head"><h2 id="${titleId}">${title}</h2><div class="docs-search"><input class="docs-find" type="search" placeholder="${searchPlaceholder}" spellcheck="false" autocomplete="off" /><button type="button" class="docsclear" title="${clearSearch}" aria-label="${clearSearch}" hidden>${raw(spriteIconMarkup("x"))}</button></div><button type="button" class="btn docsclose" title="${closeTitle}">${close}</button></div><div class="docs-body">${raw(docsBodyMarkup())}</div></dialog>`;
}

/** What a mounted docs modal hands back — a {@link Modal}, plus a way to keep its labels current. */
export interface DocsModalController extends Modal {
  /**
   * Re-derives every `t()`-sourced label after a language change, including a
   * full `.docs-body` rebuild. Clears an in-progress search, since a query
   * typed in one language is not a query in the next.
   */
  update(): void;
}

/** Reads `.api` rows out of a root, insisting every one is a `<details>`. */
function collectApiRows(root: ParentNode): HTMLDetailsElement[] {
  return queryAll(".api", root).map((row) => {
    if (!(row instanceof HTMLDetailsElement)) {
      throw new TypeError("Expected .api to be a <details>");
    }
    return row;
  });
}

/** Wires the dialog's search box, close button, and backdrop click; returns the modal, closed to start. */
export function presentDocsModal(dialog: HTMLDialogElement): DocsModalController {
  const closeButton = requireElement(".docsclose", dialog);
  const modal = createModal(dialog, closeButton);

  const titleEl = requireElement("h2", dialog);
  const docsBody = requireElement(".docs-body", dialog);
  const docsClear = requireElement(".docsclear", dialog);
  let docsEmpty = requireElement(".docs-empty", dialog);
  let guide = requireElement(".docs-guide", dialog);
  let intro = requireElement(".docs-intro", dialog);
  let lead = requireElement(".docs-lead", dialog);

  const docsFindElement = requireElement(".docs-find", dialog);
  if (!(docsFindElement instanceof HTMLInputElement)) {
    throw new TypeError("Expected .docs-find to be an <input>");
  }
  const docsFind = docsFindElement;

  let apiRows = collectApiRows(dialog);

  // The rows the filter itself opened or folded. `toggle` is queued rather than
  // raised on assignment, so which rows they are outlives any flag around the loop.
  const toggledByFilter = new WeakSet<HTMLDetailsElement>();
  function wireApiRows(): void {
    for (const row of apiRows) {
      row.addEventListener("toggle", () => {
        if (!toggledByFilter.delete(row)) {
          delete row.dataset["bySearch"];
        }
      });
    }
  }
  wireApiRows();

  /** Opens or folds a row as the filter, so its queued `toggle` isn't read as the reader's. */
  function setRowOpen(row: HTMLDetailsElement, open: boolean): void {
    if (row.open === open) {
      return;
    }
    toggledByFilter.add(row);
    row.open = open;
  }

  function filterDocs(): void {
    const query = docsFind.value.trim().toLowerCase();
    docsClear.hidden = docsFind.value === "";
    let found = 0;
    for (const row of apiRows) {
      // Fold shut the previous search's own finds first, or they'd stay open forever.
      if (row.dataset["bySearch"] !== undefined) {
        setRowOpen(row, false);
        delete row.dataset["bySearch"];
      }
      // textContent sees the closed detail too; a match found only there still has to open.
      const match = row.textContent.toLowerCase().includes(query);
      row.hidden = !match;
      if (!match) {
        continue;
      }
      found += 1;
      const summaryText = (row.querySelector("summary")?.textContent ?? "").toLowerCase();
      if (query !== "" && !row.open && !summaryText.includes(query)) {
        setRowOpen(row, true);
        row.dataset["bySearch"] = "1";
      }
    }

    // A heading hides with its last surviving row; the intro heading, with no rows, hides outright once a query is live.
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

    // The guide never takes part in a search.
    guide.hidden = query !== "";
    intro.hidden = query !== "";
    lead.hidden = query !== "";
    docsEmpty.hidden = found > 0;
  }

  // Scroll position outside of search, restored on reopen; a search itself always starts at the top.
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

  // Clear the search on any close, so the dialog reopens on the guide.
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
    update(): void {
      titleEl.textContent = t("game.docs.title");
      docsFind.placeholder = t("game.docs.searchPlaceholder");
      const clearSearch = t("game.docs.clearSearch");
      docsClear.title = clearSearch;
      docsClear.setAttribute("aria-label", clearSearch);
      closeButton.title = t("game.docs.closeTitle");
      closeButton.textContent = t("game.docs.close");

      docsBody.innerHTML = docsBodyMarkup();
      docsEmpty = requireElement(".docs-empty", docsBody);
      guide = requireElement(".docs-guide", docsBody);
      intro = requireElement(".docs-intro", docsBody);
      lead = requireElement(".docs-lead", docsBody);
      apiRows = collectApiRows(docsBody);
      wireApiRows();

      docsFind.value = "";
      docsSearching = false;
      docsScroll = 0;
      docsBody.scrollTop = 0;
      filterDocs();
    },
  };
}
