/** Entry point for the documentation page; pulls in its stylesheet as an ES module import Vite can hash and inline. */

import "./styles/index.css";

import { bindBackToGame, browserHost } from "./pages/docs/model/back-to-game.ts";
import { requireElement } from "./shared/lib/dom.ts";
import { labelModifierKeys } from "./ui/shortcuts.ts";

labelModifierKeys(document, navigator.userAgent);
bindBackToGame(requireElement('.header nav a[href="./"]'), browserHost(window));
