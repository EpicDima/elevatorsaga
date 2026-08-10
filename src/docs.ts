/**
 * Entry point for the documentation page.
 *
 * The page is otherwise static, so this mostly pulls in the styles and the
 * self-hosted font. It exists because those are ES module imports that Vite
 * resolves, hashes and inlines; the page used to link a Google Fonts
 * stylesheet, the Font Awesome webfont, two highlight.js themes and
 * highlight.js itself.
 */

import "@fontsource/oswald/latin-400.css";
import "@fontsource/oswald/latin-700.css";
import "./styles/style.css";

import { labelModifierKeys } from "./ui/shortcuts.ts";

labelModifierKeys(document, navigator.userAgent);
