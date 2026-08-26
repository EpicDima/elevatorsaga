/**
 * The hotkeys dialog against the keys it advertises. Only testable here: whether a chord reaches
 * CodeMirror at all is a fact about a real browser, and the dialog's whole claim is which of them
 * survive the editor.
 */

import { expect, test, type Page } from "@playwright/test";

import { editor, openSettingsMenu } from "./game-page.ts";

/** Opens the dialog the settings popover's own row opens. */
async function openHotkeys(page: Page): Promise<void> {
  await openSettingsMenu(page);
  await page.locator(".keysopen").click();
  await expect(page.locator(".keys")).toBeVisible();
}

test("heads its two groups with the scope each one has", async ({ page }) => {
  await page.goto("/");
  await openHotkeys(page);

  await expect(page.locator(".keys .keys-group")).toHaveText([
    "Outside the code editor",
    "In the code editor",
  ]);
});

test("leaves the settings popover open under it, however the dialog is dismissed", async ({
  page,
}) => {
  await page.goto("/");
  const keys = page.locator(".keys");
  const setMenu = page.locator(".setmenu");
  await page.locator(".setopen").click();
  await expect(setMenu).toBeVisible();

  for (const dismiss of [
    async (): Promise<void> => {
      await page.keyboard.press("Escape");
    },
    async (): Promise<void> => {
      await page.locator(".keysclose").click();
    },
    // The backdrop, whose click targets the dialog element rather than anything under it.
    async (): Promise<void> => {
      await page.mouse.click(5, 5);
    },
  ]) {
    await page.locator(".keysopen").click();
    await expect(keys).toBeVisible();

    await dismiss();

    await expect(keys).toBeHidden();
    await expect(setMenu).toBeVisible();
  }
});

test("F1 opens the help it names, and in the editor does nothing, as its heading says", async ({
  page,
}) => {
  await page.goto("/");

  await editor(page).click();
  await page.keyboard.press("F1");
  await expect(page.locator(".docs")).toBeHidden();

  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press("F1");
  await expect(page.locator(".docs")).toBeVisible();
});

test("every editor chord it lists is really bound", async ({ page }) => {
  await page.goto("/");
  await editor(page).click();

  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.locator(".cm-search")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".cm-search")).toBeHidden();

  // Literal Control, not ControlOrMeta: completionKeymap gives Ctrl-Space no Mac spelling,
  // which is why that row alone is drawn without the Mod- marker.
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("el");
  await page.keyboard.press("Control+Space");
  await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible();
  await page.keyboard.press("Escape");

  // Tab indents rather than moving focus, which is why Esc gets a row of its own.
  await page.keyboard.press("Tab");
  await expect(editor(page)).toBeFocused();
  await expect(editor(page)).toContainText("el");
  await page.keyboard.press("Escape");
  await expect(editor(page)).not.toBeFocused();
});
