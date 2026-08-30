---
name: lint
description: Periodic health-check of a twillm wiki — broken links, orphans, tag hygiene, non-canonical filenames, and computed views. Use this whenever the user says "lint my wiki", "check for broken links", "find orphan pages", "fix non-canonical filenames", "tag hygiene check", "health check the wiki", or "computed views".
---

# LLM wiki for twillm — Health Checks

Periodic maintenance to keep a twillm wiki clean, connected, and findable. Scans for broken links, tag inconsistencies, non-canonical filenames, and stale claims. Reports findings to the user — never silently changes anything.

Use this whenever the user says "lint my wiki", "check for broken links", "find orphan pages", "fix non-canonical filenames", "tag hygiene check", "health check the wiki", or "computed views". For daily wiki operations (ingestion, querying), use `work`.

## Key TiddlyWiki Concepts

| Term | Definition |
|---|---|
| Tiddler | The fundamental unit of information — equivalent to a page in other wikis, but tend to be small. |
| **Shadow Tiddler** | A tiddler bundled inside a plugin — always present in every wiki. See `references/shadow-tiddlers.md` for filtering operators and shadow-aware workflows. |
| **(Shadow) Override** | When an ordinary tiddler shares a title with a shadow, overriding it in rendering. |

## Project Structure

```
${CLAUDE_PROJECT_DIR}/
  vault/                 ← Hand-written tiddlers — where lint scans live
    *.md                 ← Markdown tiddlers
    *.tid                ← TiddlyWiki wikitext UI tiddlers (computed views)
  twillm-wiki/           ← Auto-generated output from ingestion
```

**Critical paths:**
- `CLAUDE.md` at the **project root**, outside any vault directory.
- Vault tiddlers are in `vault/` by default — alternative names need an explicit compose mount change.
- `twillm-wiki/` is where twillm persists generated and derived content from ingestion.

## Tiddler Conventions

### Markdown tiddlers (.md) — the primary format

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
- `title` (required): The tiddler's logical title — the original, unmapped name. Use Title Case with spaces. **Only one `title:` line should exist.** YAML uses the last value, so duplicate `title:` lines silently overwrite earlier ones and can cause mismatched title-to-filename mappings.
- `description` (optional): A one-line description of the tiddler's content — additional context that supplements the title with new information, not redundant phrasing. Used by computed index views to surface tiddler meaning at a glance.
- `tags` (required): YAML array of classification tags. See Tagging Taxonomy below.
- `rating` (optional): Integer 1–9 reflecting confidence or importance.
- `created` / `modified` (required): ISO-8601 timestamps — both millisecond UTC (`2026-06-04T10:21:47.840Z`) and timezone offsets (`2026-06-04T12:00:00+10:00`) are fine. Update `modified` on every edit.
- `aliases` (optional): Alternate names that should resolve to this tiddler.

### Title-to-Filename Mapping

The canonical-filenames plugin (exposing `GET /bdawg/canonical`) handles title-to-filename mapping automatically. For non-canonical filename detection and fixes, see `references/lint-workflows.md#Fixing-Non-Canonical-Filenames`.

### Wikilinks — how tiddlers connect

Use double-bracket syntax for all inter-tiddler links:

- Simple: `[[Transformer]]` — renders as the tiddler title
- With display text: `[[Displayed Link Text|Tiddler Title]]` — renders "Displayed Link Text" as clickable, but links to the tiddler named "Tiddler Title". The display text is BEFORE the pipe, the target title is AFTER.

**Never rely on CamelCase linking.** Always use explicit `[[wikilinks]]`. See `references/lint-workflows.md` for CamelCase auto-link behavior and suppression techniques.

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
- `Source` tiddlers are created automatically during ingestion.

## Docker Port

The service is always named `twillm`. The host port is injected below:

Twillm port: !`docker-port.sh`

Use this number as the host port for all `xh` API calls (replace the port in URLs below), e.g.:
```bash
xh get http://localhost:TWILLM_PORT/bdawg/filter-titles filter=='[all[missing]!is[shadow]]'
```
If blank, the container isn't running or there's a compose issue — run `docker compose up -d` and retry the skill.

## Lint Checks

Periodically health-check the wiki:

### 1. Broken Links

Use the `[all[missing]!is[shadow]!is[system]]` filter via `GET /bdawg/filter-titles` — always read `references/lint-workflows.md` for the full workflow before linting (Step 1–3 cover auto-link config, broken link detection, and fix strategies).

### 2. Orphan Pages

Tiddlers with no inbound wikilinks are not necessarily a problem — they may be useful reference pages that simply aren't cross-referenced yet. Only flag them if it makes sense for navigation. This requires manual review since there's no single filter that reliably finds orphans without also catching intentionally standalone pages (like "Getting Started").

### 3. Missing Concepts

Identify important topics mentioned in multiple tiddlers but lacking their own page. Look for recurring phrases, repeated concepts across tiddlers that are referenced only by prose, not by wikilinks. This is partly judgment — use domain knowledge from the CLAUDE.md tag taxonomy and the computed views (Concepts.md, Papers.md, etc.) to guide what might be missing.

### 4. Stale Claims

Newer sources may have superseded older claims — flag contradictions between pages. Compare timestamps (`modified` field) across related tiddlers and look for claims that newer sources contradict. Note them as findings but don't auto-revise.

### 5. Tag Hygiene

Check for inconsistent tags:
- Plural vs singular (e.g., `concepts` vs `Concept`)
- Tags that should be `Topic` vs `Concept` (check tag taxonomy)
- Inconsistent casing (e.g., `Concept` vs `concept`)
- Orphan tags — tags used by only one tiddler might have been misclassified

### 6. Non-Canonical Filenames

Scan tiddlers where `GET /bdawg/canonical` reports `isLooselyCanonical: false` — the file exists but its name doesn't match the canonical mapping (e.g., stored as `foo-widgets.md` instead of `Foo_ Widgets.md`). Case-only mismatches (`log.md` for title "Log", where `isCanonical: false` but `isLooselyCanonical: true`) are fine and don't need fixing.

Propose running `POST /bdawg/canonical/rename-all` to fix all actual non-canonical names at once. See `references/lint-workflows.md#Fixing-Non-Canonical-Filenames` for the full workflow.

## Reporting Findings

Report findings to the user and propose fixes. Don't silently change things — let the user decide. Organize findings by severity (broken links = critical, tag hygiene = minor). Group related issues together.

## Computed Views (.tid)

For interactive views, create TiddlyWiki wikitext tiddlers with `.tid` extension, placed side by side with `.md` files in the vault directory. Use `references/lint-workflows.md#Computed-Views` for syntax and examples. Useful computed views include tag listings (`<<list-links filter:"[tag[X]]">>`), recent updates, or custom dashboards.

## Tips

- **Broken links are critical.** They break navigation and confuse users. Fix them first in every lint pass.
- **Don't over-flag orphans.** Many reference pages (e.g., a "Getting Started" tiddler) are useful even if nothing links to them.
- **Tag hygiene is low effort, high reward.** A quick pass catches typos and inconsistencies that compound over time.
- **Use `xh` not `curl`.** Always use `xh` for HTTP requests when making API calls. If `xh` is not installed, ask the user rather than falling back to `curl` — `xh`'s syntax differs and a direct replacement can introduce subtle bugs (e.g., header quoting, JSON encoding).
