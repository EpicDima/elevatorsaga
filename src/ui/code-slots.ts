/**
 * The three code slots every challenge offers.
 *
 * Plain numbers, not string ids like `"solve"` or `"optimizeA"` — the slots
 * are fully symmetric and interchangeable, so a number is the honest
 * representation. Nothing distinguishes slot 2 from slot 3 except that they
 * are different storage locations; neither is tied to a goal, a difficulty or
 * an "attempt". A player free to use them however they like, or not at all.
 */
export type CodeSlot = 1 | 2 | 3;

/** Every code slot, in the order the switcher shows them. */
export const CODE_SLOTS: readonly CodeSlot[] = [1, 2, 3];

/**
 * The slot a challenge opens on when nothing else has chosen one.
 *
 * The one slot with a special role: it is what {@link "./editor.ts"!CodeEditor}
 * falls back to the legacy single-buffer key for, so a player upgrading from
 * before slots existed finds their saved program exactly where they left it.
 */
export const DEFAULT_CODE_SLOT: CodeSlot = 1;
