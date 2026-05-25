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

**Vault vs twillm-wiki:** Your hand-written tiddlers go in `vault/`. Twillm's auto-generated output from ingest goes in `twillm-wiki/`. For project setup, version control, and compose configuration, see [Setup Guide](references/setup.md).

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
- `title` (required): Must match the filename exactly. Use Title Case with spaces.
- `tags` (required): YAML array of classification tags. See Tagging Taxonomy below.
- `rating` (optional): Integer 1–9 reflecting confidence or importance.
- `created` / `modified` (required): ISO-8601 timestamps. Update `modified` on every edit.
- `aliases` (optional): Alternate names that should resolve to this tiddler, e.g. `[Rotary Positional Encoding]`.

### Wikilinks — how tiddlers connect

Use double-bracket syntax for all inter-tiddler links:

- Simple: `[[Transformer]]` — renders as the tiddler title
- With display text: `[[Displayed Link Text|Tiddler Title]]` — renders "Displayed Link Text" as clickable, but links to the tiddler named "Tiddler Title". The display text is BEFORE the pipe, the target title is AFTER.

Always link to existing tiddlers when referencing concepts they cover. Create a new tiddler for a concept if one doesn't exist and it's likely to be referenced again.

### Shadow Tiddlers

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
3. **Retitle** each confirmed unintentional mask using the steps in **Retitling Tiddlers** below.

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

When initializing a new project:

1. **CLAUDE.md** — The schema, at the project root. Define the tag taxonomy (customized to the user's domain), page conventions, and workflow preferences.
2. **vault/** — Create the vault directory with initial tiddlers. `index.md` and `log.md` are optional — TiddlyWiki's live wikitext views can replace an index entirely.

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

1. **Change the frontmatter** `title:` field to the new name.
2. **Rename the filename** on disk to match.
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

### Lint

Periodically, health-check the wiki:

1. **Broken links:** Scan all tiddlers for `[[...]]` links pointing to non-existent tiddlers. Flag them.
2. **Orphan pages:** Tiddlers with no inbound wikilinks from other content tiddlers (excluding index.md, log.md). Suggest whether they should be merged, linked, or removed.
3. **Missing concepts:** Identify important topics mentioned in multiple tiddlers but lacking their own page.
4. **Stale claims:** Newer sources may have superseded older claims — flag contradictions between pages.
5. **Tag hygiene:** Check for inconsistent tags (e.g., `concepts` vs `Concept`, or tags that should be `Topic` vs `Concept`).

Report findings to the user and propose fixes. Don't silently change things — let the user decide.

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

For Docker setup (isolated, reproducible) — compose detection, vault mounting, tiddlywiki.info persistence, plugin management, or checking an existing deployment — see [Setup Guide](references/setup.md).

## Intent Detection

The skill detects intent from the user's request:
- **Init a new wiki** ("set up", "initialize", "create", "start") → do BOTH Docker compose setup AND `.gitignore` configuration. Only skip the compose file if the user explicitly mentions npx (in which case still configure gitignore unless they decline version control).
- **Check existing setup** ("check my docker", "verify", "upgrade") → check BOTH Docker compose AND `.gitignore` configuration. Report what's present and what's missing.
- **Wiki operations** (ingest, query, lint, computed views) → primary mode, focus on wiki work. If no running instance is detected, briefly mention at the end that they might want to set up twillm.
- **Setup/Run twillm** ("run twillm", "setup docker") → trigger Docker compose flow; only use npx if the user explicitly mentions it.

If the user has no twillm setup but starts asking about ingestion, briefly remind them at the end: "You might also want to ask me to set up twillm so you can browse the wiki live in a browser."

## Tips

- **Atomic tiddlers > monolithic pages.** One concept per file. It's better to have 20 short tiddlers with links than one long document with sections. A human reader should be able to open just the pieces relevant to them.
- **Link generously.** The value of a wiki is in the connections. When writing a tiddler, ask: "What other tiddlers does this reference?" and link to them.
- **The index is your GPS.** Updating index.md on every ingest is what makes navigation possible without embedding infrastructure. Never skip it.
- **Rating matters.** Use `rating` to signal confidence (low = speculative) or importance (high = foundational). This helps users triage.
- **Aliases help discoverability.** If a concept has common alternate names (e.g., "RoPE" for "Rotary Position Embedding"), add them as aliases so links from other tiddlers resolve correctly.
