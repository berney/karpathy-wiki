---
name: work
description: Daily twillm wiki operations — ingest sources, curate tiddlers, and query wiki knowledge. Writes focused markdown tiddlers, links them together, updates existing tiddlers as needed. Use this whenever the user says "ingest this paper", "ingest these docs", "what does the wiki say about X", "query the wiki", "rename a tiddler", "curate titles", or has raw sources they want filed into an organized system.
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          if: "Bash(curl *)"
          command: |
            COMMAND=$(jq -r '.tool_input.command' < /dev/stdin)
            jq -n \
              --arg cmd "$COMMAND" \
              '{
                hookSpecificOutput: {
                  hookEventName: "PreToolUse",
                  permissionDecision: "deny",
                  permissionDecisionReason: ("curl is banned — use xh or a bundled script instead. Command: " + $cmd)
                }
              }'
---

# LLM wiki for twillm — Daily Operations

How to operate a twillm wiki during day-to-day use — ingesting sources, curating tiddlers, and querying knowledge. The LLM reads raw documents, writes focused tiddlers, and cross-references existing tiddlers. Knowledge accumulates over time; each source makes the wiki richer.

Use this whenever the user says "ingest this paper", "ingest these docs", "what does the wiki say about X", "query the wiki", "rename a tiddler", "curate titles", or has raw sources they want filed into an organized system. For project setup and Docker Compose configuration, use `setup`.

## Key TiddlyWiki Concepts

| Term | Definition |
|---|---|
| Tiddler | A `.md` file in `vault/`. Equivalent to a "page" in other wikis — tiddlers are files on disk, not stored in any database. Small, one concept per file. |
| **Shadow Tiddler** | A tiddler bundled inside a plugin — always present in every wiki. See `references/shadow-tiddlers.md` for details. |
| **(Shadow) Override** | When an ordinary tiddler shares a title with a shadow, overriding it in rendering. |
| **Ordinary Tiddler** | A tiddler stored in the vault, created or edited by the user. Wins over shadows. |

## Project Structure

```
${CLAUDE_PROJECT_DIR}/
  CLAUDE.md              ← Agent instructions for this vault
  vault/                 ← Hand-written tiddlers — what you create and edit
    *.md                 ← Markdown tiddlers
  twillm-wiki/           ← Auto-generated output from ingestion
```

**Critical paths:**
- `CLAUDE.md` at the **project root**, outside any vault directory. twillm renders every `.md` inside the vault as a wiki page.
- Vault tiddlers are in `vault/` by default — alternative names need an explicit compose mount change.
- `twillm-wiki/` is where twillm persists generated and derived content from ingestion.

## Tiddler Conventions

### Tiddler files (`.md`)

```markdown
---
title: Transformer
description: A family of architectures using self-attention mechanisms
tags: [Concept, Architecture]
rating: 9
created: "2026-04-01T12:00:00Z"
modified: "2026-05-21T10:30:00Z"
aliases: []
---

The Transformer is an architecture...
```

**Frontmatter fields:**
- `title` (required): The tiddler's logical title — the original, unmapped name. Use Title Case with spaces. **Only one `title:` line should exist.** YAML uses the last value, so duplicate `title:` lines silently overwrite earlier ones and can cause mismatched title-to-filename mappings. The file itself must be named using the canonical mapping below.
- `description` (optional): A one-line description of the tiddler's content — additional context that supplements the title with new information, not redundant phrasing. Used by computed index views to surface tiddler meaning at a glance.
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

## Docker Port

The service is always named `twillm`. The host port is injected below:

Twillm port: !`docker-port.sh`

Use this number as the host port for all `xh` API calls (replace the port in URLs below), e.g.:
```bash
xh get http://localhost:TWILLM_PORT/bdawg/canonical title==MyTitle
```
If blank, the container isn't running or there's a compose issue — run `docker compose up -d` and retry the skill.

## Operations

### Ingest

When the user provides a new source (a file in a directory, pasted text, or a URL to fetch):

1. **Read and discuss.** Read the source, summarize key takeaways, agree on what's most important.
2. **Create/update tiddlers.** Write focused tiddlers for each distinct concept, entity, or finding. Keep them small and atomic — one concept per tiddler. Before creating a new tiddler, call `GET /bdawg/canonical` (see `references/checking-tiddlers.md`) to check existence, shadow status, and get the canonical filename in one call. Link generously to existing tiddlers using wikilinks.
3. **Create Source tiddler (documents only).** For discrete documents (papers, articles, specs, blog posts), create a `[[Source Name]]` tiddler tagged `Source` that summarizes the document, lists key findings, and links to the concept tiddlers it touched. **Skip this step for git repos.** A repo is not a single document — the concept/Entity tiddler created in step 2 already captures its essence, and a separate Source wrapper is redundant.

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
That's it — just rename the file, update frontmatter, and update wikilinks in other files. No index or log to maintain.

Curation improves over time — a wiki that started as "Foo" can, after several rounds of ingestion and curation, become "Foo Legacy", "Foo Current Version", and a newly ingested "Foo". This is deliberate: better titles make the wiki more useful even if it requires extra work to maintain them.

**Fixing filenames without changing titles:** If a tiddler's title is correct but its filename doesn't match the canonical mapping (e.g., titled "Foo: Widgets" but stored as `foo-widgets.md`), call `POST /bdawg/canonical` — it renames the file to the canonical name without touching the title. For a full cleanup pass, use `POST /bdawg/canonical/rename-all`. See `references/checking-tiddlers.md#fixing-non-canonical-filenames`.

### Edit Tiddler Title

When a user says "rename Foo to Bar", "retitle Foo as Bar", "change the title of Foo to Bar", "move Foo to Bar", or "mv Foo Bar" — all synonymous. See `references/lint-workflows.md#Retitling Tiddlers` for the complete workflow.

### Query

When the user asks a question about the wiki:

1. **Search and scan.** Use TiddlyWiki's search and tag-based filtering to find relevant tiddlers. Look at titles and `description` fields for quick context. Scan content of the most relevant matches.
2. **Read connected tiddlers** — follow wikilinks from the first page to find deeper connections.
3. **Synthesize an answer** citing specific tiddlers (use `[[Tiddler Name]]` links so the user can click through).
4. **File useful discoveries.** If the query reveals a new insight, comparison, or connection worth keeping, create a new tiddler for it.

## Tips

- **Atomic tiddlers > monolithic pages.** One concept per file. It's better to have 20 short tiddlers with links than one long document with sections. A human reader should be able to open just the pieces relevant to them.
- **Link generously.** The value of a wiki is in the connections. When writing a tiddler, ask: "What other tiddlers does this reference?" and link to them.
- **Descriptions add discoverability.** A good `description` field gives context at a glance — titles are short, descriptions carry the nuance. Computed views (Concepts.md, Papers.md, etc.) surface title+description for quick scanning.
- **Rating matters.** Use `rating` to signal confidence (low = speculative) or importance (high = foundational). This helps users triage.
- **Aliases help discoverability.** If a concept has common alternate names (e.g., "RoPE" for "Rotary Position Embedding"), add them as aliases so links from other tiddlers resolve correctly.
- **Use `xh` not `curl`.** Always use `xh` for HTTP requests when making API calls. If `xh` is not installed, ask the user rather than falling back to `curl` — `xh`'s syntax differs and a direct replacement can introduce subtle bugs (e.g., header quoting, JSON encoding).
