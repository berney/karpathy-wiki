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

```text
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

### Block-Level Markdown Syntax

- A stray `~` before `[[...]]` style links will cause a parsing error within the same block.
  A block can be a single line or a multi-line (e.g. a bullet point) — the parser sees the whole block as one unit.
  For example the markdown: `It cost ~$5 to buy [[cookies]]`, will cause parsing errors.
- This can be avoided by escaping the tilde like this `\~`, e.g. `It cost \~$5 to buy [[cookies]]` parses no errors.
- Multi-line bullet points count as one block:

  ```markdown
  * ~$10 for a
    [[Cookie]]
  ```

  This also triggers the error.

### Title-to-Filename Mapping

The canonical-filenames plugin (exposing `GET /bdawg/canonical`) handles title-to-filename mapping automatically. Before creating any tiddler, call this endpoint to get the correct `canonical` filename — never guess from the title yourself. The `title:` frontmatter value always uses the original, human-readable title; the filename uses the plugin's sanitised mapping.

The same endpoint also supports reverse lookup via `filename==` (e.g., `filename==hello-world.md`) to look up a tiddler by its on-disk filename. This returns the full metadata including `tags` as a JSON array — see `references/checking-tiddlers.md#Reverse-Lookup-by-Filename`.

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
| `Index` | Computed views — dynamic index tiddlers that list other tiddlers by tag |

**Rules:**

- Every tiddler must have tags. Minimum one tag.
- `Topic` is the broadest level — use it sparingly, usually one per subject area.
- `Source` tiddlers are created automatically during ingestion (one per source document).
- Add personal tags freely (e.g. user's name) for personal filing.

## Docker Port

The service is always named `twillm`. The output below is either a host port number (e.g. `8051`) or a base URL (e.g. `http://twillm:8080`):

Twillm port: !`scripts/docker-port.sh`
If you see a literal `scriptsdocker-port.sh` on the preceding line, dynamic context injection isn't supported.
In that case, follow these instructions carefully, do not deviate on your own.
IMPORTANT: the script's location is relative to the skill's directory, NOT to the current working directory (CWD).
For example if you are in `/foo/bar/` (CWD), and the skill is probably `/some/where/else/SKILL.md` (a hypothetical `$SKILL_DIR`) - a completely different directory tree.
Do NOT try to run the script from CWD!
Do NOT look for the script inside the CWD tree.
Where is the skill's directory? What is `scripts/` relative to that (`$SKILL_DIR/scripts/`)? Run `scripts/docker-port.sh` (`$SKILL_DIR/scripts/docker-port.sh`)
RUN the script! Do NOT read it without first RUNNING it!
If you get the script wasn't found error, try harder to workout where the skill's directory is and thus where the script is. Remember your current working directory could be anywhere and is unreleated to where the script is.
Before you move on to trying your own thing make sure you can answer these question:

1. What is the absolute directory path of the skill?
2. What is the absolute directory path `$SKILL_DIR/scripts/docker-port.sh`?
3. Did you run `$SKILL_DIR/scripts/docker-port.sh` (run it, NOT read it)?

Use the output as the host for all `xh` API calls (replace the port or URL in URLs below). If it's a port number, use `http://localhost:<PORT>`. If it's already a URL, use it directly:

```bash
xh get http://localhost:TWILLM_PORT/bdawg/canonical title==MyTitle
```

If the output is `UNKNOWN`, neither docker/podman nor a container runtime is available and the container is not reachable — ensure `docker compose up -d` or equivalent is running.

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

### Query Tags

Use the `/bdawg/filter-titles` endpoint with TiddlyWiki filter syntax to query tiddlers by tag:

```bash
# List all unique tags, sorted alphabetically
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tags[]sort[]]'
# → ["Architecture","Concept","Entity","Paper",...]

# Without sort[] — unsorted list of all unique tags
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tags[]]'

# Count tiddlers with a specific tag
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tag[Concept]count[]]'
# → ["42"]

# List all tiddlers with a specific tag
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tag[Paper]]'

# List tags with their counts (useful for spotting orphan tags)
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tags[]sort[]] :map[all[tiddlers]tag<currentTiddler>count[]addprefix[:]addprefix<currentTiddler>]'
```

### Create Index

To create a computed view that lists all tiddlers matching a tag, use the **Index Template** pattern. This creates a lightweight `.tid` file that renders dynamically — no manual maintenance needed.

1. **Decide the tag and name.** E.g., tag `MCP`, index title "MCP Index".
2. **Create a `.tid` file** in `vault/` (or wherever your vault tiddlers live):

   ```text
   created: 20260813000000000
   modified: 20260813000000000
   tags: MCP Index
   title: MCP Index

   {{||Index Template|MCP}}
   ```

   The syntax is `{{|Index Template|<TAG>}}` — this is transclusion the current tiddler through the `Index Template` template tiddler and passing the `<TAG>` as a parameter. This is substituted using `$(tag)$` in the template's filter, so `[tag[$(tag)$]]` resolves to `[tag[MCP]]`.
   The template tiddler filters `<currentTiddler>` from the result - so this excludes the tiddler `MCP Index` even though it is tagged `MCP`.
3. **The rendered output** is a bullet list: each matching tiddler appears as `<title> --- <description>`, using the `description` frontmatter field from each tiddler.

**Where to put it:**

- Vault-side computed views go in `vault/` as `.tid` files (side by side with `.md` tiddlers).
- System-level dashboards go in `twillm-wiki/tiddlers/`.

**Example:** To create an index of all `Paper`-tagged tiddlers:

```text
created: 20260813000000000
modified: 20260813000000000
tags: Paper Index
title: Paper Index

{{||Index Template|Paper}}
```

Because the transclusion passes a parameter, a single tiddler can use it multiple times. For example:

```text
created: 20260813000000000
modified: 20260813000000000
tags: Index
title: Index

! Topics
{{||Index Template|Topic}}

! Concepts
{{||Index Template|Concept}}

! Papers
{{||Index Template|Paper}}
```

### Index Filter Template

When you need a computed view that filters by an arbitrary TiddlyWiki filter expression (not just a single tag), use the **Index Filter Template**. It works exactly like Index Template but accepts a full filter as the parameter instead of a single tag. Like Index Template, it excludes `<currentTiddler>` so the index tiddler won't list itself.

```text
created: 20260813000000000
modified: 20260813000000000
tags: Index
title: Compose Index

! Sub-Indexes
{{||Index Filter Template|[tag[Compose]tag[Index]]}}

! Other Compose Tiddlers
{{||Index Filter Template|[tag[Compose]!tag[Index]!tag[Instruction]]}}
```

The syntax is `{{||Index Filter Template|<FILTER>}}` — transclusion through the template with a full TiddlyWiki filter as the parameter. The template renders the same `<title> --- <description>` bullet list as Index Template.

Use this for complex queries: intersection (`[tag[A]tag[B]]`), exclusion (`[tag[A]!tag[B]]`), or any filter expression.

**Where to put it:** Same rules as Index Template — vault-side computed views go in `vault/` as `.tid` files.

This creates a tiddler titled `Index` tagged `Index` that has 3 headings (`Topics`, `Concepts`, `Papers`) that each contain bulletpoint `<title> --- <description>` entries based on the corresponding tag.

## Markdown Writing Conventions

- **One sentence per line.** Write each sentence on its own line, even when sentences belong to the same paragraph. This avoids MD013 (line-length) warnings and matches your preferred style.

  Good:

  ```markdown
  This is a sentence.
  This is another sentence, same paragraph.
  ```

  Bad:

  ```markdown
  This is a sentence. And this is another sentence on the same line. And yet another one making the file have really long lines. Because, there's more and more sentences all on the one line with now carriage returns. This will trigger MD013 errors of lines exceeding 80 characters.
  ```

- **Lint with `rumdl`.** After creating or editing any `.md` file, run `rumdl` on it. MD013 (line-length) warnings are acceptable when the line cannot naturally be broken with a newline after a period. If a line can easily be split by inserting a newline after a `.`, do so — it avoids the warning and matches the one-sentence-per-line convention.

## Tips

- **Atomic tiddlers > monolithic pages.** One concept per file. It's better to have 20 short tiddlers with links than one long document with sections. A human reader should be able to open just the pieces relevant to them.
- **Link generously.** The value of a wiki is in the connections. When writing a tiddler, ask: "What other tiddlers does this reference?" and link to them.
- **Descriptions add discoverability.** A good `description` field gives context at a glance — titles are short, descriptions carry the nuance. Computed views (Concepts.md, Papers.md, etc.) surface title+description for quick scanning.
- **Rating matters.** Use `rating` to signal confidence (low = speculative) or importance (high = foundational). This helps users triage.
- **Aliases help discoverability.** If a concept has common alternate names (e.g., "RoPE" for "Rotary Position Embedding"), add them as aliases so links from other tiddlers resolve correctly.
- **Use `xh` not `curl`.** Always use `xh` for HTTP requests when making API calls. If `xh` is not installed, ask the user rather than falling back to `curl` — `xh`'s syntax differs and a direct replacement can introduce subtle bugs (e.g., header quoting, JSON encoding).
