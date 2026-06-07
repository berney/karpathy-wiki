---
name: karpathy-wiki
description: How to set up and operate a twillm wiki — an incremental knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. Use this skill when building wikis from sources, ingesting documents into a twillm vault, maintaining linked tiddlers, querying wiki knowledge, running lint passes, setting up twillm with Docker or npx, or organizing research notes with wikilinks.
---

# LLM wiki for twillm

How to set up and operate a twillm wiki — an incremental, compounding knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. When you add a new article, paper, or note, the LLM extracts key information, writes focused tiddlers, cross-references existing pages, updates summaries, and flags contradictions. Knowledge accumulates over time — each source makes the wiki richer.

Use this skill whenever the user wants to build a wiki from sources, ingest documents into a twillm vault, maintain linked tiddlers, query wiki knowledge, run lint passes, set up twillm with Docker or npx, organize research notes with wikilinks, or has raw sources they want filed into an organized system.

## Key TiddlyWiki Concepts

| Term | Definition | Details |
|---|---|---|
| Tiddler | Tiddlers are the fundamental units of information in TiddlyWiki. The equivalent of a page in other wikis, but tend to be small. | — |
| **Shadow Tiddler** | A tiddler bundled inside a plugin — always present in every wiki. | `references/shadow-tiddlers.md` |
| (Shadow) **Override** | When an ordinary tiddler shares a title with a shadow, overriding it in rendering. | `references/checking-tiddlers.md` |
| **Ordinary Tiddler** | A tiddler stored in the vault, created or edited by the user. Wins over shadows. | — |
| **System Tiddler** | TiddlyWiki internal tiddlers starting with `$:/` (e.g. `$:/theme`). | — |

## Project Structure

A project has two or three directories depending on setup:

```
project-root/
  CLAUDE.md              ← Agent instructions for this vault (not served as a wiki page)
  vault/                 ← The twillm vault — flat directory of tiddler files
    index.md             ← Content catalog (optional; live views can replace this)
    log.md               ← Append-only log (optional)
    *.md                 ← Markdown tiddlers
    *.tid                ← TiddlyWiki wikitext UI tiddlers
  docs/wiki/             ← Alternative vault name
  docker-compose.yml     ← Optional Docker setup (uses ghcr.io/berney/twillm:latest by default)
```

**Critical paths:**
- `CLAUDE.md` at the **project root**, outside any vault directory. twillm renders every `.md` inside the vault as a wiki page.
- Vault tiddlers are in `vault/` by default — alternative names (notes/, content/) or non-standard paths need explicit arguments. See `references/setup.md`.
- `twillm-wiki/` is where twillm persists generated and derived content from ingestion — when you ingest a source, the auto-generated tiddlers live here. Both directories need persistence (bind-mounted in Docker, or locally with npx).

**Vault vs twillm-wiki:** Your hand-written tiddlers go in `vault/`. Twillm's auto-generated output from ingest goes in `twillm-wiki/`. For project setup, version control, compose configuration, and vault directory discovery, see the Setup Guide (`references/setup.md`). For shadow tiddler detection and resolution, see `references/shadow-tiddlers.md`.

**Core wiki files:** In a minimal vault, just `.md` and `.tid` tiddlers. `index.md` and `log.md` are optional helpers — TiddlyWiki's live views (`.tid` with wikitext filters) can replace the index entirely.

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
- `title` (required): The tiddler's logical title — the original, unmapped name. Use Title Case with spaces. **Only one `title:` line should exist.** YAML uses the last value, so duplicate `title:` lines silently overwrite earlier ones and can cause mismatched title-to-filename mappings. The file itself must be named using the mapped version (see Title-to-Filename Mapping below).
- `tags` (required): YAML array of classification tags. See Tagging Taxonomy below.
- `rating` (optional): Integer 1–9 reflecting confidence or importance.
- `created` / `modified` (required): ISO-8601 timestamps — both millisecond UTC (`2026-06-04T10:21:47.840Z`) and timezone offsets (`2026-06-04T12:00:00+10:00`) are fine. Update `modified` on every edit.
- `aliases` (optional): Alternate names that should resolve to this tiddler, e.g. `[Rotary Positional Encoding]`.

### Title-to-Filename Mapping

The canonical-filenames plugin (exposing `GET /bdawg/canonical`) handles title-to-filename mapping automatically. Before creating any tiddler, call this endpoint to get the correct `canonical` filename — never guess from the title yourself. The `title:` frontmatter value always uses the original, human-readable title; the filename uses the plugin's sanitised mapping.

### Wikilinks — how tiddlers connect

Use double-bracket syntax for all inter-tiddler links:

- Simple: `[[Transformer]]` — renders as the tiddler title
- With display text: `[[Displayed Link Text|Tiddler Title]]` — renders "Displayed Link Text" as clickable, but links to the tiddler named "Tiddler Title". The display text is BEFORE the pipe, the target title is AFTER.

Always link to existing tiddlers when referencing concepts they cover. Create a new tiddler for a concept if one doesn't exist and it's likely to be referenced again.

**Never rely on CamelCase linking.** Always use explicit `[[wikilinks]]`. Writing bare `ThemeMechanism` instead of `[[ThemeMechanism]]` is fragile: TiddlyWiki may or may not auto-convert it depending on configuration and installed plugins. Explicit brackets are always a link — unambiguous in every context.

See `references/lint-workflows.md` for CamelCase auto-link behavior and suppression techniques.

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
2. **Create/update tiddlers.** Write focused tiddlers for each distinct concept, entity, or finding. Keep them small and atomic — one concept per file. Before creating a new tiddler, call `GET /bdawg/canonical` (see `references/checking-tiddlers.md`) to check existence, shadow status, and get the canonical filename in one call. Link generously to existing tiddlers using wikilinks.
3. **Update index.md.** Add entries under the appropriate category headings with link + one-line summary.
4. **Update log.md.** Add entries in chronological order — oldest at the top, newest appended to the bottom (end of file). Each entry is a timestamped heading: `## [YYYY-MM-DD] ingest | Source Title`.
5. **Create Source tiddler.** Create a `[[Source Name]]` tiddler tagged `Source` that summarizes the document, lists key findings, and links to the concept tiddlers it touched.

A single source may create 3–10 new tiddlers and update 5–15 existing ones. Always update — don't duplicate. If a newer source refines or contradicts an older tiddler, revise the old one and note the change in the body (e.g., "Updated 2026-05-21 per [[New Paper Title]]").

### Curating Tiddler Titles

After several ingestions, decollisioning may have left suboptimal titles — e.g., the original source got called "Foo", then a newer source was created as "Foo Current Version" to avoid the collision, while "Foo" actually describes an older legacy topic. A curation pass can improve title quality across the wiki.

**How curation works:**

1. **Scan titles and content.** Read tiddler titles alongside their body text. Look for cases where a different title would be a better fit — where the content of one tiddler belongs under the title of another, or where a qualifier is misplaced.
2. **Plan the rename sequence.** Determine which tiddlers to retitle and what their new titles should be. Check that each target title is free (`GET /bdawg/canonical`) before committing — if there's a collision, resolve it first (either by updating the existing tiddler or picking an unambiguous name).
3. **Execute renames.** For each retitled tiddler:
   1. Read the file to identify all wikilinks pointing to the old title.
   2. Rename the file on disk (`mv`).
   3. Update the `title:` frontmatter to the new name.
   4. Update any wikilinks in other files that reference the old title.
4. **Update index.md.** Remove the old entries and add them under their new titles.

Curation improves over time — a wiki that started as "Foo" can, after several rounds of ingestion and curation, become "Foo Legacy", "Foo Current Version", and a newly ingested "Foo". This is deliberate: better titles make the wiki more useful even if it requires extra work to maintain them.

**Fixing filenames without changing titles:** If a tiddler's title is correct but its filename doesn't match the canonical mapping (e.g., titled "Foo: Widgets" but stored as `foo-widgets.md`), call `POST /bdawg/canonical` — it renames the file to the canonical name without touching the title. For a full cleanup pass, use `POST /bdawg/canonical/rename-all`. See `references/checking-tiddlers.md#fixing-non-canonical-filenames`.

### Query

When the user asks a question about the wiki:

1. **Read index.md** to find relevant categories, then scan tiddlers for the most relevant content.
2. **Read connected tiddlers** — follow wikilinks from the first page to find deeper connections.
3. **Synthesize an answer** citing specific tiddlers (use `[[Tiddler Name]]` links so the user can click through).
4. **File useful discoveries.** If the query reveals a new insight, comparison, or connection worth keeping, create a new tiddler for it and update the index.

### Lint

Periodically, health-check the wiki:

1. **Broken links:** Use the `[all[missing]!is[shadow]!is[system]]` filter via `filter-titles.json` — see `references/lint-workflows.md` for the full workflow.
2. **Orphan pages:** Tiddlers with no inbound wikilinks are not necessarily a problem — they may be useful reference pages that simply aren't cross-referenced yet. Only flag them if it makes sense for navigation.
3. **Missing concepts:** Identify important topics mentioned in multiple tiddlers but lacking their own page.
4. **Stale claims:** Newer sources may have superseded older claims — flag contradictions between pages.
5. **Tag hygiene:** Check for inconsistent tags (e.g., `concepts` vs `Concept`, or tags that should be `Topic` vs `Concept`).
6. **Non-canonical filenames:** Scan tiddlers where `GET /bdawg/canonical` reports `isLooselyCanonical: false` — the file exists but its name doesn't match the canonical mapping (e.g., stored as `foo-widgets.md` instead of `Foo_ Widgets.md`). Case-only mismatches (`log.md` for title "Log", where `isCanonical: false` but `isLooselyCanonical: true`) are fine and don't need fixing. Propose running `POST /bdawg/canonical/rename-all` to fix all actual non-canonical names at once.

Report findings to the user and propose fixes. Don't silently change things — let the user decide.

See `references/lint-workflows.md` for the complete missing links detection, fixing, and computed views workflows.

## Running twillm

Quick start via npx (no dependencies): `npx github:Jermolene/twillm` — auto-detects `vault/`, `notes/`, `content/`, or `.obsidian/` cwd, starts on port 8080. For non-standard vault paths: `npx github:Jermolene/twillm docs/wiki`.

For Docker setup (isolated, reproducible) — compose detection, vault mounting, tiddlywiki.info persistence, plugin management, or checking an existing deployment — consult the Setup Guide (`references/setup.md`).

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
- **Wiki operations** → see [Ingest](#ingest), [Query](#query), [Lint](#lint), or `references/lint-workflows.md`. Primary mode, focus on wiki work. If no running instance is detected, briefly mention at the end that they might want to set up twillm.
- **Setup/Run twillm** ("run twillm", "setup docker") → see [Setup](#setup). Only use npx if the user explicitly mentions it.
- **Edit tiddler title** ("rename Foo to Bar", "retitle X as Y", "change the title of Foo to Bar", "move Foo to Bar", "mv Foo Bar") → all synonymous. See `references/lint-workflows.md#Retitling Tiddlers`. The operation: rename the file on disk, update the `title:` frontmatter, fix wikilinks in other files that reference the old title.

## Tips

- **Atomic tiddlers > monolithic pages.** One concept per file. It's better to have 20 short tiddlers with links than one long document with sections. A human reader should be able to open just the pieces relevant to them.
- **Link generously.** The value of a wiki is in the connections. When writing a tiddler, ask: "What other tiddlers does this reference?" and link to them.
- **The index is your GPS.** Updating index.md on every ingest is what makes navigation possible without embedding infrastructure. Never skip it.
- **Rating matters.** Use `rating` to signal confidence (low = speculative) or importance (high = foundational). This helps users triage.
- **Aliases help discoverability.** If a concept has common alternate names (e.g., "RoPE" for "Rotary Position Embedding"), add them as aliases so links from other tiddlers resolve correctly.
- **Use `xh` not `curl`.** Always use `xh` for HTTP requests when making API calls. If `xh` is not installed, ask the user rather than falling back to `curl` — `xh`'s syntax differs and a direct replacement can introduce subtle bugs (e.g., header quoting, JSON encoding).
