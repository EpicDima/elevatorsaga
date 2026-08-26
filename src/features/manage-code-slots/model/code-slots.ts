/**
 * The three code slots every level offers, numbered rather than named:
 * they are fully interchangeable storage locations, not tied to a goal or
 * difficulty, so a number is the honest representation.
 */
export type CodeSlot = 1 | 2 | 3;

/** Every code slot, in the order the switcher shows them. */
export const CODE_SLOTS: readonly CodeSlot[] = [1, 2, 3];

/**
 * The slot a level opens on when nothing else has chosen one; also the one
 * {@link "../../../ui/editor.ts"!CodeEditor} falls back to the legacy
 * single-buffer key for, so upgrading players keep their saved program.
 */
export const DEFAULT_CODE_SLOT: CodeSlot = 1;
