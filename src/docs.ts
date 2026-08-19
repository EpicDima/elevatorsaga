/**
 * Entry point for the documentation page.
 *
 * The page is otherwise static, so this mostly pulls in the stylesheet. It
 * exists because that is an ES module import Vite resolves, hashes and inlines;
 * the page used to link a Google Fonts stylesheet, the Font Awesome webfont,
 * two highlight.js themes and highlight.js itself. A self-hosted Oswald was
 * imported here too until the interface adopted the platform's own UI face --
 * see the note in src/main.ts.
 */

import "./styles/style.css";

import { labelModifierKeys } from "./ui/shortcuts.ts";

labelModifierKeys(document, navigator.userAgent);
