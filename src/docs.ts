/** Entry point for the documentation page; pulls in its stylesheet as an ES module import Vite can hash and inline. */

import "./styles/index.css";

import { labelModifierKeys } from "./ui/shortcuts.ts";

labelModifierKeys(document, navigator.userAgent);
