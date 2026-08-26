# Development

Node 22 or newer, and `npm ci` first.

## Scripts

| Script                  | What it does                                                                     |
| ----------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server with hot module replacement                                      |
| `npm run build`         | Typechecks, then builds the three pages into `dist/`                             |
| `npm run preview`       | Serves the built `dist/` for a final look before deploying                       |
| `npm run typecheck`     | `tsc --noEmit` over the whole project                                            |
| `npm run bench`         | Scores a solution file headlessly; see [writing solutions](writing-solutions.md) |
| `npm test`              | Runs the Vitest suite once                                                       |
| `npm run test:watch`    | Runs the suite in watch mode                                                     |
| `npm run test:coverage` | Runs the suite and writes a V8 coverage report to `coverage/`                    |
| `npm run test:e2e`      | Runs the Playwright smoke tests against the built site                           |
| `npm run screenshot`    | Recaptures `public/images/screenshot.png` from the game                          |
| `npm run lint`          | ESLint over the repository                                                       |
| `npm run lint:fix`      | ESLint with `--fix`                                                              |
| `npm run format`        | Rewrites files with Prettier                                                     |
| `npm run format:check`  | Fails if anything is not Prettier-formatted                                      |

## Project structure

The UI follows [Feature-Sliced Design](https://feature-sliced.design/): six layers, each only
allowed to import from the ones below it. `src/game` and `src/i18n` sit outside that stack as
dependency-free kernel libraries every layer may import — the simulation has no business being
UI-aware, and the message catalog is needed everywhere.

```
src/
  game/       the simulation: elevators, floors, passengers, physics, levels,
              the event emitter, and the facades handed to player code
  i18n/       message catalog, locale detection, plural and number formatting
  shared/     business-agnostic primitives: DOM helpers, markup templating, icons,
              modal/popover/disclosure widgets, geometry math
  entities/   UI-facing concepts: level, level tier, elevator, floor, passenger,
              tutorial level, chapter two level, API reference entry
  features/   one user action each: run the simulation, adjust speed, manage code
              slots/seed, switch language/theme/layout, docs search, hotkeys help
  widgets/    composed regions of the page: app bar, level switcher, goal bar,
              building stage, stats panel, editor pane, tutorial panel,
              level briefing, workspace layout, verdict toast
  pages/game/ the game page: wires most of the widgets above to a running
              level (the app bar, editor pane and workspace layout are
              mounted once from main.ts instead, since they don't change
              when the level does)
  app/        the fitness benchmark and the worker it runs in
  ui/         the CodeMirror integration, which sits outside the layers on
              purpose, plus a few utility modules not yet moved into shared/
  cli/        the benchmark as a terminal command
  docs-page/  the reference page's shape, and the renderer that turns it and
              the docs catalogs into one HTML file per locale; run by the
              build, as cli/ is run by a terminal -- these two are the parts
              of src/ no browser ever loads
  styles/     the single stylesheet
  main.ts     entry point: mounts the game page and starts it
  docs.ts     entry point for the reference pages: the stylesheet, and the
              one script they run
```

Each layer's boundary is enforced by hand-rolled `no-restricted-imports` rules in
`eslint.config.js`, not just convention: `shared` cannot import from `entities` and up, `entities`
cannot import from `features` and up, and so on through `pages`. Path aliases mirror the layers
(`#shared/*`, `#entities/*`, `#features/*`, `#widgets/*`, `#pages/*`, `#app/*`, `#game/*`,
`#i18n/*`, declared in `tsconfig.json` and mirrored in `vite.config.ts` and `package.json`'s
`imports` field) — a `#`-prefix in an import always names a layer, never a relative path.

The one rule that predates FSD and still matters most: **`src/game` never touches the DOM.** Its
production code imports nothing from any UI layer, holds no element references, and has no opinion
about how a lift is drawn (a couple of test files borrow a plain string constant from
`src/ui/default-code.ts` as a reference program — not a DOM dependency, and not part of the shipped
bundle). That is why the simulation runs under Vitest's plain `node` environment with no jsdom and
no rendering setup at all, and why the fitness benchmark can run the whole thing inside a web worker.

## Tests

Tests are co-located with the code they cover: `src/game/elevator.ts` is tested by
`src/game/elevator.test.ts`. Vitest picks up `src/**/*.test.ts`. To run one file:

```sh
npx vitest run src/game/elevator.test.ts
npx vitest src/game/elevator.test.ts   # ...in watch mode
npx vitest run -t "destination queue"  # ...or filter by test name across all files
```

The default test environment is plain `node`, because the simulation core has no DOM dependency and
starting jsdom for it would only make the suite slower. A test that genuinely needs a DOM opts in
per file with a docblock on the very first line:

```ts
// @vitest-environment jsdom
```

Every test that builds an element opts in that way: the `ui/` directory of each entity, feature and
widget, the two page tests, and the DOM helpers under `shared/`. What stays on `node` is everything
that works on plain data — the simulation, the message catalog, the fitness benchmark, and the
modules in `src/ui` that compute a completion table or a stack trace rather than render one.

### End-to-end tests

`e2e/` holds a handful of Playwright smoke tests. They exist to answer one question the unit tests
cannot: does the thing that actually ships come up in a real browser? So they run against the
**production build** — `npm run test:e2e` builds the site and serves `dist/` with `vite preview`
before the first test — and they stay few on purpose. What they cover is everything whose proof is
the browser itself. The game comes up and a level is played through to
"Success!"; a program survives a reload in `localStorage`, a pasted block keeps the indentation it
arrived with, <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd> writes it the moment it is pressed without
the browser's own save dialog opening, and a program that will not compile or throws
mid-simulation raises the error banner instead of failing silently. Then the parts that are only
real once an address bar and a browser are involved: a pinned seed brings the same passengers back
on reload while an unpinned run draws a new building each time, a parameter the router refused
leaves the address bar without breaking the Back button, the page arrives in the language the
browser asks for and follows the picker to the other one, and a tutorial level shows its panel,
keeps its answer folded until asked, and hands its program to the editor. Finally the flat
statements: the help page and the license notices are reachable from the footer, the link preview
points at an image that is really served, both pages reflow onto a 320 px phone, and the keyboard
reaches the editor in one tab stop from the busiest level. Behavior is covered in depth by the
Vitest suite; repeating it through a browser would only buy slower, flakier versions of tests that
already exist.

```sh
npm run test:e2e                       # the whole suite
npx playwright test e2e/game.spec.ts   # ...one file
npx playwright test --ui               # ...interactively
npx playwright show-report             # the report from the last run
```

Chromium has to be present the first time: `npx playwright install chromium`. The two runners cannot
see each other's files — Vitest collects `src/**/*.test.ts`, Playwright collects `e2e/**/*.spec.ts`.

`public/images/screenshot.png` is captured by `e2e/screenshot.spec.ts`, which is deliberately
excluded from the suite and run on its own with `npm run screenshot`; nothing in CI rewrites it. It
lives under `public/` because it is also the site's `og:image`: Vite copies that directory to the
root of `dist/`, so the picture at the top of this file and the one in a link preview are the same
file. The run it captures is drawn from a pinned seed, so recapturing after a change to the look of
the game shows that change rather than a fresh crowd; the spec says which seed and why.

Before opening a pull request, run what CI runs: `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`. CI runs the same five
checks — `npm run test:coverage` in place of `npm test`, which is the same suite plus a coverage
report — on Node 24 for every push to `main` and every pull request, and runs the end-to-end tests
alongside them in a job of their own, so a browser download never holds up the fast checks. One Node
version, and the newer LTS line, because nothing here is version-specific and a second leg only paid
twice for the same answer; `engines` still asks for 22 or newer and the package still runs there, but
CI no longer stands behind it.

## Why TypeScript is held at 6

`package.json` pins `typescript` to `^6.0.3` even though npm's `latest` is 7.x. It is
`typescript-eslint` that decides this: every release so far declares `typescript: ">=4.8.4 <6.1.0"`
as a peer dependency, and the lint configuration here is `strictTypeChecked` plus
`stylisticTypeChecked` —
rules that ask the compiler about types rather than reading the syntax tree, and so run against
whatever compiler API that package was built for. Moving to 7 fails the install outright on npm's
peer resolution, and forcing it past that would leave the type-aware half of `npm run lint`
running against an API its own dependency does not claim to support. The pin comes off when
typescript-eslint ships a release that widens the range.

## The original implementation

Comments throughout `src/` cite the code they were ported from by `file:line` — `libs/riot.js:40-42`,
`world.js:22-23`, `interfaces.js:6`. Those files were deleted in 2.0, so the citations point at the
tag `legacy-1.x` (commit `e0c55bf`), the last revision before the modernization, where the originals
sit unchanged:

```sh
git show legacy-1.x:libs/riot.js
```

## Deploying

Every push to `main` publishes the site to <https://elevatorsaga.epicdima.com> through GitHub Pages.
The `deploy` job in `.github/workflows/ci.yml` rebuilds the bundle and uploads it with the official
Pages actions, and it `needs` both `check` and `e2e`: a commit whose types, lint, formatting, unit
tests or browser tests are red is never published. The same job re-publishes on demand —
**Actions → CI → Run workflow** with `main` selected — which is the way back to a good build if a
deployment itself fails.

The domain is claimed by `public/CNAME`, a single line of text that Vite copies to the root of
`dist/` and that GitHub reads as one hostname — so it holds the domain and nothing else, no comment
and no scheme. `e2e/custom-domain.spec.ts` fetches it from the built site, because a static file
nothing imports and no page links to is one a build can stop copying without anything else going
red, and the cost of that is every link to the game. Serving from a domain rather than
`epicdima.github.io/elevatorsaga/` changes nothing in the bundle: `vite.config.ts` sets
`base: "./"`, so the pages reference their assets relatively and work at either depth.

Two prerequisites are settings rather than files, so they have to be done by hand once:

1. In **Settings → Pages → Build and deployment**, change **Source** from "Deploy from a branch" to
   **GitHub Actions**. While the source is a branch, the deploy step has nothing to publish to and
   fails the run.
2. Point the domain at GitHub: a DNS `CNAME` record for `elevatorsaga` in the `epicdima.com` zone,
   answering with `epicdima.github.io`. Then enter `elevatorsaga.epicdima.com` under
   **Settings → Pages → Custom domain** and, once the certificate has been issued, tick **Enforce
   HTTPS**. A workflow deployment reads the domain from that setting, not from the file it
   publishes; the file is what keeps the claim in the repository, and what would carry it if the
   site were ever published from a branch again.

Deployments never overlap and are never canceled part-way. Runs on `main` queue instead of
superseding each other (`cancel-in-progress` is off for that branch only), and the `deploy` job
takes a `pages` concurrency group on top of that, so a half-uploaded site cannot replace a working
one. Pull requests keep the cheaper behavior, where a new push cancels the run it made irrelevant.
