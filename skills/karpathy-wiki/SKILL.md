---
name: karpathy-wiki
description: How to set up and operate a twillm wiki — an incremental knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. Use this skill when building wikis from sources, ingesting documents into a twillm vault, maintaining linked tiddlers, querying wiki knowledge, running lint passes, setting up twillm with Docker or npx, or organizing research notes with wikilinks.
---

# LLM wiki for twillm

How to set up and operate a twillm wiki — an incremental, compounding knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. When you add a new article, paper, or note, the LLM extracts key information, writes focused tiddlers, cross-references existing pages, updates summaries, and flags contradictions. Knowledge accumulates over time — each source makes the wiki richer.

Use this skill whenever the user wants to build a wiki from sources, ingest documents into a twillm vault, maintain linked tiddlers, query wiki knowledge, run lint passes, set up twillm with Docker or npx, organize research notes with wikilinks, or has raw sources they want filed into an organized system.

## Intent Detection

The skill detects intent from the user's request:
- **Wiki operations** (ingest, query, lint, computed views) → primary mode, focus on wiki work
- **Setup/Run twillm** ("run twillm", "setup docker") → trigger Docker or npx setup flow
- **No running instance detected** while user asks wiki work → offer to help with setup after completing their request
- **User explicitly asks** → show both npx and Docker options

If the user has no twillm setup but starts asking about ingestion, briefly remind them at the end: "You might also want to ask me to set up twillm so you can browse the wiki live in a browser."

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
- `twillm-wiki/` is where twillm persists generated and derived content from ingestion — when you ingest a source, the auto-generated tiddlers live here. **Must be bind-mounted in Docker or content is lost on container restart.**

**Vault vs twillm-wiki:** Your hand-written tiddlers go in `vault/`. Twillm's auto-generated output from ingest goes in `twillm-wiki/`. Both need persistence.

**Version control:** Three things inside `twillm-wiki/` are transient and must be gitignored — check if a `.gitignore` exists and add these lines if missing:
```
twillm-wiki/output/
twillm-wiki/tiddlywiki.info
twillm-wiki/tiddlers/$__StoryList.tid
```
If no `.gitignore` exists, create one at the project root with these three entries. Explain what each entry is for so the user understands why they're ignoring parts of `twillm-wiki/`.

`twillm-wiki/tiddlywiki.info` gets overwritten every time twillm starts (by `materialiseWiki()` copying from the template directory), whether or not you use the bind-mount trick to persist plugin edits. Always gitignore it.

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
- With display text: `[[Bahdanau Attention|Bahdanau et al.]]` — renders "Bahdanau et al." but links to the tiddler named "Bahdanau Attention"

Always link to existing tiddlers when referencing concepts they cover. Create a new tiddler for a concept if one doesn't exist and it's likely to be referenced again.

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

twillm can be run directly via `npx` (quick, no dependencies) or via Docker (isolated, reproducible).

### npx (quick start)

```bash
cd /path/to/project
npx github:Jermolene/twillm
```

This auto-detects a vault directory (`vault/`, `notes/`, `content/`, or `.obsidian/` cwd), materialises the twillm working directory, and starts the server on http://localhost:8080. For non-standard paths, pass an argument: `npx github:Jermolene/twillm docs/wiki`.

### Docker Setup

If the user asks to set up twillm with Docker, create a compose configuration that runs the twillm container and mounts their vault directory. This section activates **only when explicitly asked** — it is not part of the core wiki workflow.

#### Compose detection strategy

When setting up Docker:

1. **Check for existing compose files:** Read `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml` if they exist.
2. **For small files (< 100 lines):** Read the file directly, look for conflicts (existing service named `twillm`/`wiki`/`docs`, port conflicts).
3. **For large files:** Use `docker compose config --services` and `docker compose config --profiles` to list services without loading the full file into context. Ask the user if they want you to modify this file or create a separate one.
4. **No existing compose or user prefers fresh setup:** Create a new `docker-compose.yml`.

#### Port detection strategy

When choosing a port for the twillm container:

1. Check common ports (8080, 8082, 9090, 3000).
2. Check existing compose files for exposed ports.
3. If still unclear, ask the user or offer 8082 as default and note it's configurable.

#### Service naming

The twillm service can be named `twillm`, `wiki`, or `docs` — use a name that fits the project context. Check for conflicts with existing services using the detection strategy above.

#### Image vs build

Use the published image (`image: ghcr.io/berney/twillm:latest`). For custom builds (e.g., testing a fork), uncomment `build:` in the compose file and point it at the twillm/ context.

#### Vault mounting

Mount both directories required by twillm. The vault holds your hand-written tiddlers; `twillm-wiki` holds generated content from ingest — both persist across restarts:

```yaml
volumes:
  - ./vault:/app/vault:Z          # hand-written tiddlers
  - ./twillm-wiki:/app/twillm-wiki:Z   # generated/derived content from ingest
```

For non-standard vault names:

```yaml
volumes:
  - ./docs/wiki:/app/vault:Z           # SELinux relabel for Linux hosts
  - ./docs/twillm-wiki:/app/twillm-wiki:Z
```

The user can customize the host mount to map any directory. Document this in the compose file comments.

#### Persisting tiddlywiki.info edits

`tiddlywiki.info` is the TiddlyWiki configuration file loaded on startup — it controls which plugins and themes are active. The `tiddlywiki.info` inside `twillm-wiki/` gets overwritten every time twillm starts because `materialiseWiki()` in twillm's cli.js unconditionally copies all files from `template-wiki/` into `twillm-wiki/`. There is no existence guard.

This means any plugin additions to `twillm-wiki/tiddlywiki.info` are lost on container restart. To persist edits, bind-mount a custom `tiddlywiki.info` over the template path:

```yaml
services:
  twillm:
    volumes:
      - ./vault:/app/vault:Z
      - ./twillm-wiki:/app/twillm-wiki:Z
      - ./template-wiki/tiddlywiki.info:/app/template-wiki/tiddlywiki.info:Z
```

The user creates a `template-wiki/` directory alongside their compose file and puts their customized `tiddlywiki.info` there. The bind mount shadows the template file inside the container so materialiseWiki has nothing to overwrite.

**Default tiddlywiki.info:** Use `scripts/template-wiki/tiddlywiki.info` from this skill as the starting point when helping users set up a new project. Copy it into the user's `template-wiki/` directory.

**Editing tiddlywiki.info:** Always Read the file first, then detect its existing indentation style (tabs or spaces) from the read output and match it when adding new entries. The skill's default fixture uses tabs, but users may have edited it with spaces — always follow whatever convention is already in their file. For example, to add `"tiddlywiki/katex"`:
```
# If the existing lines use tabs (look for ^I or actual tab characters):
-	"tiddlywiki/dynannotate",
+	"tiddlywiki/dynannotate",
+	"tiddlywiki/katex",

# If the existing lines use spaces:
-    "tiddlywiki/dynannotate",
+    "tiddlywiki/dynannotate",
+    "tiddlywiki/katex",
```
After editing, validate with `jq . < template-wiki/tiddlywiki.info`. If jq fails, report the error to the user — TiddlyWiki may tolerate non-standard JSON (comments, trailing commas, etc.) that jq rejects, so don't assume it's broken. Ask the user if they want you to fix the formatting or leave it as-is.

**Popular TiddlyWiki plugins** (add to `"plugins"` array):
| Plugin | Use for |
|---|---|
| `tiddlywiki/highlight` | Syntax highlighting for code blocks via highlight.js |
| `tiddlywiki/katex` | Mathematical typesetting with KaTeX |
| `tiddlywiki/railroad` | Railroad diagrams for grammar/IR visualizations |
| `tiddlywiki/tw5.com-docs` | Official TiddlyWiki 5 documentation as a reference wiki |
| `orange/mermaid-tw5` | Mermaid diagrams (flowcharts, sequence diagrams, etc.) |

**Themes** can also be added to the `"themes"` array. Default: `[vanilla, snowwhite]`.

#### Validate syntax

Always run `docker compose config` **before** making changes to verify the existing file is valid. If it fails, tell the user and ask what to do rather than guessing fixes.

After making changes, run `docker compose config` again before telling the user they're done. A broken compose file can silently break other services in the project — don't risk leaving it in a bad state.

#### Upgrade existing setup

When the user asks to "check" or "upgrade" their docker-compose (e.g., "check my docker setup", "upgrade my docker setup"), check each item independently by pattern-matching against the user's compose file — do NOT try to diff line-by-line against the fixture. The fixture (`scripts/docker-compose.example.yml`) is for reference only; use its volume mount strings as the known-good values when a mount is missing:

1. **Find the compose file:** Check for `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`.
2. **Read it** (small files directly; large files use `docker compose config --services`).
3. **Check each item independently** by looking for specific volume mount patterns in the user's file:
   - **Vault mount present** — grep for a line matching `./vault:/app/vault:Z` or a non-standard path (e.g. `./docs/wiki:/app/vault:Z`)
   - **twillm-wiki mount present** — grep for `./twillm-wiki:/app/twillm-wiki:Z`. If missing, this is critical: generated content from ingest is lost on container restart.
   - **tiddlywiki.info bind mount** (optional but recommended) — if the user wants to add TiddlyWiki plugins, they need `./template-wiki/tiddlywiki.info:/app/template-wiki/tiddlywiki.info:Z`. Suggest this proactively if not present.
   - **Port binding** — confirm the host port matches what's already in use (don't "fix" a deliberate port change)
   - **:Z SELinux label** — present for Linux hosts; note if absent on systems where it's needed
4. **Propose changes.** Show the user exactly what's missing and ask before modifying. For example: "Your compose file is missing the `twillm-wiki` volume mount — without it, all generated content from ingestion will be lost when the container restarts. Want me to add it?" Do not try to copy lines from the fixture into the user's file; always write complete, valid volume mount entries.
5. **Validate after changes:** Run `docker compose config` to confirm validity.

If the user's setup has other services or a custom structure, preserve their configuration and only add what's missing. Do not suggest removing or modifying existing services or volumes that aren't part of twillm.

## Tips

- **Atomic tiddlers > monolithic pages.** One concept per file. It's better to have 20 short tiddlers with links than one long document with sections. A human reader should be able to open just the pieces relevant to them.
- **Link generously.** The value of a wiki is in the connections. When writing a tiddler, ask: "What other tiddlers does this reference?" and link to them.
- **The index is your GPS.** Updating index.md on every ingest is what makes navigation possible without embedding infrastructure. Never skip it.
- **Rating matters.** Use `rating` to signal confidence (low = speculative) or importance (high = foundational). This helps users triage.
- **Aliases help discoverability.** If a concept has common alternate names (e.g., "RoPE" for "Rotary Position Embedding"), add them as aliases so links from other tiddlers resolve correctly.
