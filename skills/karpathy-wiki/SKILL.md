---
name: karpathy-wiki
description: How to set up and operate a twillm wiki — an incremental knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. Use this skill when building wikis from sources, ingesting documents into a twillm vault, maintaining linked tiddlers, querying wiki knowledge, running lint passes, setting up twillm with Docker or npx, or organizing research notes with wikilinks.
---

# LLM wiki for twillm

How to set up and operate a twillm wiki — an incremental, compounding knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. When you add a new article, paper, or note, the LLM extracts key information, writes focused tiddlers, cross-references existing pages, updates summaries, and flags contradictions. Knowledge accumulates over time — each source makes the wiki richer.

Use this skill whenever the user wants to build a wiki from sources, ingest documents into a twillm vault, maintain linked tiddlers, query wiki knowledge, run lint passes, set up twillm with Docker or npx, organize research notes with wikilinks, or has raw sources they want filed into an organized system.

## Project Structure

A project has two or three directories depending on setup:

```
project-root/
  CLAUDE.md              ← Agent instructions for this vault (not served as a wiki page)
  vault/                 ← The twillm vault — flat directory of tiddler files
    index.md             ← Content catalog (optional; live views can replace this)
    log.md               ← Append-only log (optional — personal preference)
    *.md                 ← Markdown tiddlers
    *.tid                ← TiddlyWiki wikitext UI tiddlers
  docs/wiki/             ← Alternative vault name (see Vault Directory below)
  docker-compose.yml     ← Optional Docker setup (uses published ghcr.io/berney/twillm:latest by default)
```

**Critical paths:**
- `CLAUDE.md` at the **project root**, outside any vault directory. twillm renders every `.md` inside the vault as a wiki page.
- Vault tiddlers are in `vault/` by default (see Vault Directory below). The LLM writes both `.md` and `.tid` files there.
- `twillm-wiki/` is where twillm persists generated and derived content from ingestion — when you ingest a source, the auto-generated tiddlers live here. Both directories need persistence (bind-mounted in Docker, or locally with npx).

**Vault vs twillm-wiki:** Your hand-written tiddlers go in `vault/`. Twillm's auto-generated output from ingest goes in `twillm-wiki/`. For project setup, version control, and compose configuration, see the Setup Guide (in this skill's references/ directory).

**Core wiki files:** In a minimal vault, just `.md` and `.tid` tiddlers. `index.md` and `log.md` are optional helpers — TiddlyWiki's live views (`.tid` with wikitext filters) can replace the index entirely.

## Vault Directory Discovery

twillm auto-detects vault directories by name: **vault/**, **notes/**, or **content/**. It also treats the current directory as a vault if `.obsidian/` is present. For any other path (e.g. `docs/wiki/`), an explicit argument must be passed to twillm.

When the user mentions a vault that isn't one of the auto-detected names, use twillm with an explicit path argument: `twillm docs/wiki`.

For Docker setups, mount the chosen directory to `/app/vault` in the container — twillm always looks for `./vault` from its working directory. The user can customize this mapping (e.g. `./docs:/app/vault`).

## Tiddler Conventions

### Markdown tiddlers (.md) — the primary format

```markdown
---
title: Transformer
tags: [Concept, Architecture]
rating: 9
created: "2026-04-01T12:00:00Z"
modified: "2026-05-21T10:30:00Z"
aliases: []
---

The Transformer is an architecture...
```

**Frontmatter fields:**
- `title` (required): Must match the filename exactly. Use Title Case with spaces. **Important: only one `title:` line should exist.** YAML uses the last value, so duplicate `title:` lines silently overwrite earlier ones and can cause mismatched title-to-filename mappings.
- `tags` (required): YAML array of classification tags. See Tagging Taxonomy below.
- `rating` (optional): Integer 1–9 reflecting confidence or importance.
- `created` / `modified` (required): ISO-8601 timestamps. Update `modified` on every edit.
- `aliases` (optional): Alternate names that should resolve to this tiddler, e.g. `[Rotary Positional Encoding]`.

### Wikilinks — how tiddlers connect

Use double-bracket syntax for all inter-tiddler links:

- Simple: `[[Transformer]]` — renders as the tiddler title
- With display text: `[[Displayed Link Text|Tiddler Title]]` — renders "Displayed Link Text" as clickable, but links to the tiddler named "Tiddler Title". The display text is BEFORE the pipe, the target title is AFTER.

Always link to existing tiddlers when referencing concepts they cover. Create a new tiddler for a concept if one doesn't exist and it's likely to be referenced again.

**Never rely on CamelCase linking.** Always use explicit `[[wikilinks]]`. Writing bare `ThemeMechanism` instead of `[[ThemeMechanism]]` is fragile: TiddlyWiki may or may not auto-convert it depending on configuration and installed plugins. Explicit brackets are always a link — unambiguous in every context.

#### Disabling auto-links with `~` prefix

TiddlyWiki auto-converts CamelCase words into wikilinks inside tables, code blocks, and other contexts. If you don't want a word to become a link, prefix the wikilink with `~`:

```
~ThemeMechanism    — displays "ThemeMechanism" as plain text, no link created
```

#### Table headers and CamelCase auto-linking

Table column headers like `| SystemTag |` are treated as CamelCase and become auto-links. To prevent this, use spaces: `| System Tag |`.

#### Auto-linking system tiddlers

TiddlyWiki system tiddlers like `$:/ControlPanel`, `$:/theme`, and `$:/language` are valid tiddler titles that TiddlyWiki auto-links (no brackets needed). Write them directly in prose — they become working links.

### Shadow Tiddlers

**Use `xh` not `curl`:** Always use `xh` for HTTP requests when making API calls. If `xh` is not installed, ask the user rather than falling back to `curl` — `xh`'s syntax differs and a direct replacement can introduce subtle bugs (e.g., header quoting, JSON encoding).

**Shadow tiddlers** are built-in defaults from TW5 core and plugins (e.g., `tw5.com-docs` plugin). They are fully retrievable and viewable through the WebServer API at all times — they are not hidden. What changes is which version TW5 renders:

- **When masked:** An ordinary tiddler with the same title wins over the shadow in rendering. `GET /recipes/default/tiddlers/{title}` returns the ordinary version.
- **When unmasked:** The shadow tiddler is returned by `GET /recipes/default/tiddlers/{title}` — full content, just like any other tiddler.

**WebServer API endpoints for individual tiddlers:**

```bash
# Get JSON of a specific tiddler (returns ordinary if masked, shadow if unmasked)
xh get http://localhost:$PORT/recipes/default/tiddlers/{title}

# Get rendered HTML of a tiddler
xh get http://localhost:$PORT/{title}
```

**Filter operators for shadow status:**

| Filter | Meaning |
|---|---|
| `[all[shadows]]` | All shadow tiddlers from plugins (large, requires `$:/config/Server/AllowAllExternalFilters=yes`). **Selection constructor** — generates new input rather than filtering the existing one. |
| `[is[tiddler]is[shadow]]` | Ordinary tiddlers that mask a shadow. `is[tiddler]` selects stored items; `is[shadow]` narrows to those also in the shadows set. **Preferred for detection.** |
| `[[Foo]is[shadow]]` | Title "Foo" has a corresponding shadow tiddler. If an ordinary tiddler "Foo" exists, it returns that (not the shadow). |
| `[[Foo]is[shadow]!is[tiddler]]` | "Foo" is purely a shadow, no ordinary tiddler masks it. |
| `[[Foo]!is[shadow]is[tiddler]]` | "Foo" is purely ordinary — no shadow exists with that title. |
| `[prefix[X]]` | Tiddlers whose title starts with X (C — selection constructor) |
| `[suffix[X]]` | Tiddlers whose title ends with X (C — selection constructor) |

**Before creating a tiddler, check if the title shadows an existing tiddler.** Use `[[{Title}]is[shadow]]`. Replace `$PORT` with whatever port twillm is running on:

```bash
# Spot-check a single title before creating (just count)
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[[MyNewTitle]is[shadow]]' | jq length
# > 0 → a shadow exists; reconsider the title or ask the user
# == 0 → no shadow, safe to create

# Check all shadows starting with a prefix (two-step: count first, then titles if needed)
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[WebServer]]' | jq length
# > 0 → show which ones match:
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[WebServer]]' | jq 'map(.title)'
```

**Rules:**
- Use `jq length` for existence checks; use `jq 'map(.title)'` when you need the actual titles. Each avoids parsing large JSON bodies and saves context tokens.
- Never fetch `[all[shadows]]` (TW5) just for a dry-run — it's large and unnecessary. Use `[all[shadows]prefix[X]]` TW5 filters with `jq length` instead.
- When adding multiple related tiddlers, use `[all[shadows]prefix[X]]` TW5 filter and pipe to `jq length` to count results first; pipe to `jq 'map(.title)'` only if the count is > 0 to see which shadows you might be masking.
- If the user explicitly says to create/override a shadow, proceed and note it.

### Detecting & Resolving Shadow Masks

Shadow tiddlers are TiddlyWiki's built-in defaults from TW5 core and plugins — they're always present but only render when no ordinary tiddler shares their title. This section covers detection and resolution; the actual retitling steps are in the **Retitling Tiddlers** operation below.

**Before creating a new tiddler**, check if the chosen title already shadows something:

```bash
# Does this title shadow anything? (count only)
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[[MyNewTitle]is[shadow]]' | jq length
# > 0 → shadow exists; reconsider or ask if user wants to override

# List all matching shadows before creating
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[WebServer]]' | jq 'map(.title)'
```

**When an unintentional mask is detected** (a vault tiddler accidentally overriding a shadow):
1. **Detect:** Use `[is[tiddler]is[shadow]]` filter to find existing masks.
2. **Ask the user** — don't assume all masks need renaming; some intentional overrides (e.g., custom sidebar content) are deliberate.
3. **Retitle** each confirmed unintentional mask using the steps in **Retitling Tiddlers** below — update the frontmatter title, rename the file. Do **not** add an `aliases:` field for the old shadow title.

Never fetch `[all[shadows]]` just for a dry-run — it's large. Use `[all[shadows]prefix[X]]` with `jq length` instead (see Shadow Tiddlers above).

### Tagging Taxonomy

Use these classification tags consistently:

| Tag | Use for |
|---|---|
| `Topic` | Broad subject area, the "root" category for a topic cluster |
| `Concept` | Specific ideas, methods, algorithms, techniques |
| `Architecture` | Model/system architectures and components |
| `Paper` | Academic papers (author-year named) |
| `Entity` | People, organizations, datasets, tools |
| `Source` | The source document itself (auto-generated from ingest) |

**Rules:**
- Every tiddler must have tags. Minimum one tag.
- `Topic` is the broadest level — use it sparingly, usually one per subject area.
- `Source` tiddlers are created automatically during ingestion (one per source document).
- Add personal tags freely (e.g. user's name) for personal filing.

## Operations

### Setup

**Read `references/setup.md` first** — it has the full procedures for Docker compose configuration, gitignore, tiddlywiki.info management, system tiddler fixtures, upgrade paths, and setup repair. Use it for all setup-related operations below.

- **New wiki:** Create CLAUDE.md (tag taxonomy customized to user's domain), vault/, and twillm-wiki/ (copy from `scripts/twillm-wiki/`). Ask the user about their primary domain.
- **Check or upgrade existing setup:** Verify mounts, gitignore, compose validity, and required system tiddlers exist in `twillm-wiki/`. Restore any missing files from this skill's `scripts/twillm-wiki/` fixture.
- **Repair broken setup:** Diagnose with the reference — empty-template integrity, bind mount presence (`:ro,Z` on template-wiki only), compose validity, and system tiddler restoration.

Ask the user about their primary domain (research topic, personal interest, business area) and customize CLAUDE.md accordingly.

### Ingest

When the user provides a new source (a file in a directory, pasted text, or a URL to fetch):

1. **Read and discuss.** Read the source, summarize key takeaways, agree on what's most important.
2. **Create/update tiddlers.** Write focused tiddlers for each distinct concept, entity, or finding. Keep them small and atomic — one concept per file. Link generously to existing tiddlers using wikilinks.
3. **Update index.md.** Add entries under the appropriate category headings with link + one-line summary.
4. **Update log.md.** Append a timestamped entry: `## [YYYY-MM-DD] ingest | Source Title`.
5. **Create Source tiddler.** Create a `[[Source Name]]` tiddler of type `Source` that summarizes the document, lists key findings, and links to the concept tiddlers it touched.

A single source may create 3–10 new tiddlers and update 5–15 existing ones. Always update — don't duplicate. If a newer source refines or contradicts an older tiddler, revise the old one and note the change in the body (e.g., "Updated 2026-05-21 per [[New Paper Title]]").

### Query

When the user asks a question about the wiki:

1. **Read index.md** to find relevant categories, then scan tiddlers for the most relevant content.
2. **Read connected tiddlers** — follow wikilinks from the first page to find deeper connections.
3. **Synthesize an answer** citing specific tiddlers (use `[[Tiddler Name]]` links so the user can click through).
4. **File useful discoveries.** If the query reveals a new insight, comparison, or connection worth keeping, create a new tiddler for it and update the index.

### Retitling Tiddlers

When you need to rename a tiddler (e.g., fixing a shadow conflict, improving naming consistency):

1. **Change the `title:` field in the frontmatter** to the new name (must exactly match the new filename).
2. **Rename the file** on disk to match the new title.
3. **Fix broken wikilinks:** find all references to the old title and update them:

   ```bash
   xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[backlinks[{OldTitle}]]' | jq 'map(.title)'
   ```

   Update every `[[OldTitle]]` in those files to point to the new title.

**Before retitling,** check that no tiddler already has the target name:

```bash
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[[{NewTitle}]]' | jq length
# == 0 → safe, no conflict
```

**When retitling a shadow-masked tiddler,** only change the title and filename. Do **not** add an `aliases:` field for the old name — aliasing masks to their former shadow titles is unnecessary complexity and can cause confusion.

### Lint

Periodically, health-check the wiki:

1. **Broken links:** Use the `[all[missing]!is[shadow]!is[system]]` filter via `filter-titles.json`, not a grep scan. The Missing Links Linting section covers the full workflow below.
2. **Orphan pages:** Tiddlers with no inbound wikilinks are not necessarily a problem — they may be useful reference pages that simply aren't cross-referenced yet. Only flag them if it makes sense for navigation.
3. **Missing concepts:** Identify important topics mentioned in multiple tiddlers but lacking their own page.
4. **Stale claims:** Newer sources may have superseded older claims — flag contradictions between pages.
5. **Tag hygiene:** Check for inconsistent tags (e.g., `concepts` vs `Concept`, or tags that should be `Topic` vs `Concept`).

Report findings to the user and propose fixes. Don't silently change things — let the user decide.

#### Missing Links Linting

**Missing links** are tiddler titles referenced by hard wikilinks (`[[Title]]`) but don't exist in the store (not even as shadows). The workflow for finding and fixing them:

**Check whether CamelCase auto-linking is enabled.** TiddlyWiki's `$:/config/WikiParserRules/Inline/wikilink` controls this — its value is either `enable` or `disable`. Default since TW5 v5.3.0 is `disable`, but a plugin shadow can override it to `enable`. Check first:

```bash
# Is CamelCase auto-linking enabled?
xh get http://localhost:$PORT/recipes/default/tiddlers/$:/config/WikiParserRules/Inline/wikilink | jq -r '.text'
# → "enable" or "disable"
```

This determines what counts as a link:
- **If `disable`:** Bare `FooBar` is plain text — it is never a link and will not appear in `[all[missing]]`.
- **If `enable`:** Bare `FooBar` (CamelCase) is auto-converted to a wikilink. It must exist as a tiddler or appear as broken. Treat it the same as `[[FooBar]]`.

**Use the custom `filter-titles.json` endpoint** instead of `tiddlers.json`. The TiddlyWeb API restricts filter input to existing non-system ordinary tiddlers, so `[all[missing]]` and `[links[]]` miss references from system tiddlers and plugins. The custom route has no such restriction and catches all missing titles.

```bash
# Find ALL broken link source tiddlers (one pass)
xh get http://localhost:$PORT/recipes/default/filter-titles.json filter=='[all[missing]!is[shadow]!is[system]backlinks[]]' | jq -r '.[]'

# For each source, find which titles are missing:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[[Source Tiddler Title]links[]is[missing]!is[shadow]!is[system]]' | jq -r '.[]'

# Count a specific tiddler's missing links:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[[Source Tiddler Title]links[]is[missing]!is[shadow]!is[system]count[]]'
```

The filter chain works as:
1. `[all[missing]]` — get all missing titles
2. `!is[shadow]` — remove ones that have a matching shadow (title mismatch, not truly broken)
3. `!is[system]` — remove system tiddlers
4. `backlinks[]` — resolve to the source tiddlers pointing at each missing title

#### Fixing "Missing" Links — Title Mismatches & Hallucinations

When a wikilink shows up as missing, don't immediately create a new tiddler. Three common cases:

**A) Title mismatch (CamelCase/casing difference):** Only relevant if CamelCase auto-linking is `enable`. The tiddler exists but under a different title than the wikilink uses. Split CamelCase into spaced words and search shadows:

```bash
# "ThemeMechanism" is missing — Check all (ordinary) tiddlers:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[all[tiddlers]search:title[Theme Mechanism]]' | jq -r '.[:3]'

# Check if there's any "Theme Mechanism" shadow tiddlers:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[all[shadows]search:title[Theme Mechanism]]' | jq -r '.[:3]'

# Check if there's any "Theme Mechanism" oridinary or shadow tiddlers:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[all[tiddlers+shadows]search:title[Theme Mechanism]]' | jq -r '.[:3]'
```

If found, update the wikilink to match the actual title.

**B) CamelCase auto-link in table headers:** Only relevant if CamelCase auto-linking is `enable`. A word like `| SystemTag |` in a Markdown table header gets auto-linked because TiddlyWiki treats CamelCase as a wikilink. If this isn't meant to be a link, fix by using spaces: `| System Tag |`.

**C) Hallucinated link:** The wikilink references a concept that doesn't actually exist in the wiki (no ordinary tiddler, no shadow match). Verify by checking if the search returns anything — if nothing matches even with CamelCase splitting, the wikilink is likely hallucinated. Or perhaps the missing content hasn't been added yet. Generally, you should create the target tiddler before other tiddlers link to it. If the concept doesn't belong in the wiki at all, remove the reference from the source tiddler.

#### Counting with `count[]` (no pipe to jq)

The TW5 `[count[]]` filter operator replaces `| jq length`:

```bash
# Instead of: xh get ... | jq length
xh get http://localhost:$PORT/recipes/default/filter-titles.json filter=='[all[shadows]count[]]'
# → ["1768"]

# Works with any filter:
xh get ... filter=='[tag[Concept]count[]]'
xh get ... filter=='[[Source Tiddler]links[]is[missing]count[]]'
```

### Computed Views (.tid)

For interactive views, create TiddlyWiki wikitext tiddlers with `.tid` extension, placed side by side with `.md` files in the vault directory (e.g., `vault/Dashboard.tid`). They use the same location — twillm serves them both.

```yaml
title: Topic Index
type: text/vnd.tiddlywiki
tags: []
---

<<list-links filter:"[tag[Topic]]">>
```

Useful computed views include tag listings (`<<list-links filter:"[tag[X]]">>`), recent updates, or custom dashboards. These are optional but powerful for navigation.

## Running twillm

Quick start via npx (no dependencies): `npx github:Jermolene/twillm` — auto-detects `vault/`, `notes/`, `content/`, or `.obsidian/` cwd, starts on port 8080. For non-standard vault paths: `npx github:Jermolene/twillm docs/wiki`.

For Docker setup (isolated, reproducible) — compose detection, vault mounting, tiddlywiki.info persistence, plugin management, or checking an existing deployment — consult the Setup Guide (this skill's references/setup.md).

### Discovering twillm's Port

Never hard-code a port. Before making any API call (`xh get`, `xh post`), discover which port twillm is actually listening on:

1. **Check for `docker-compose.yml`** in the project root. If it exists, find the service running twillm and extract its published host port (left side of the `<host>:<container>` mapping):

   ```bash
   # List compose services — look for the one that runs twillm
   docker compose config --services
   ```

   Once you know the service name, use `yq` if available:

   ```bash
   yq '.services.<service>.ports[] | select(.published != null) | .published' docker-compose.yml
   ```

   Otherwise parse the JSON config output:

   ```bash
   docker compose config --format json <service> | jq -r '[.Ports[]? | select(has("Published")) | .Published] | first'
   ```

   Confirm it's running:

   ```bash
   docker compose ps <service>
   ```

2. **If no `docker-compose.yml`** (e.g. npx or other setup), ask the user what port twillm is running on rather than guessing.

Once discovered, use that port for all subsequent API calls rather than re-checking each time. Store it as `$PORT` in your working context for the session.

## Intent Detection

The skill detects intent from the user's request:
- **Init a new wiki** ("set up", "initialize", "create", "start") → see [Setup](#setup). Only skip the compose file if the user explicitly mentions npx (in which case still configure gitignore unless they decline version control).
- **Check existing setup** ("check my docker", "verify", "upgrade") → see [Setup](#setup). Report what's present and what needs updating.
- **Wiki operations** → see [Ingest](#ingest), [Query](#query), [Lint](#lint), [Computed Views](#computed-tid). Primary mode, focus on wiki work. If no running instance is detected, briefly mention at the end that they might want to set up twillm.
- **Setup/Run twillm** ("run twillm", "setup docker") → see [Setup](#setup). Only use npx if the user explicitly mentions it.

## Tips

- **Atomic tiddlers > monolithic pages.** One concept per file. It's better to have 20 short tiddlers with links than one long document with sections. A human reader should be able to open just the pieces relevant to them.
- **Link generously.** The value of a wiki is in the connections. When writing a tiddler, ask: "What other tiddlers does this reference?" and link to them.
- **The index is your GPS.** Updating index.md on every ingest is what makes navigation possible without embedding infrastructure. Never skip it.
- **Rating matters.** Use `rating` to signal confidence (low = speculative) or importance (high = foundational). This helps users triage.
- **Aliases help discoverability.** If a concept has common alternate names (e.g., "RoPE" for "Rotary Position Embedding"), add them as aliases so links from other tiddlers resolve correctly.
- **No title-to-filename API.** TiddlyWiki internally maps tiddler titles to filenames (`:` → `_`, spaces → `_`, etc.) but this logic is not exposed as a filter operator or HTTP endpoint. Do not search for or assume such an API exists.
