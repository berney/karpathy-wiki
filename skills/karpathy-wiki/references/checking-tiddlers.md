# Checking Tiddler Titles Before Creating

Practical commands for checking whether a tiddler exists, whether a shadow is present, and what filename a title maps to — before creating new tiddlers. This file is referenced from the main SKILL.md Ingest section. For the concept of how shadow overriding works, see `shadow-tiddlers.md`. See `lint-workflows.md` for missing link analysis that accounts for shadows.

## Primary Flow: Canonical Lookup Endpoint

The canonical-filenames plugin provides a single REST endpoint that answers everything you need before creating a tiddler: **existence**, **shadow status**, and **filename mapping**. Always use this first.

```bash
# Single call — tells you existence, shadow, system status, and filename
xh get http://localhost:$PORT/bdawg/canonical title==MyNewTitle
```

### Field semantics (what the JSON means)

| Field | `true` means |
|---|---|
| `exists` | An ordinary tiddler file is on disk with this title. |
| `isShadow` | A shadow definition exists for this title (from a plugin or bundled in twillm). If `exists: true` **and** `isShadow: true`, the ordinary tiddler is overriding the shadow. |
| `isSystem` | This is a system tiddler (`$:/...`). |
| `isCanonical` | The filename matches the canonical mapping **exactly** (case-sensitive). |
| `isLooselyCanonical` | The filename matches the canonical name case-insensitively. A canonical file is always loosely canonical — this is a superset. This is what you care about for deciding whether to fix a filename. |

A filename only needs fixing when `isLooselyCanonical: false`. If it's `true`, the name is acceptable as-is (e.g., `log.md` for title "Log" is fine).

### Response shapes

**Ordinary tiddler, no shadow (pure ordinary):**

```json
{
  "exists": true,
  "title": "My Tiddler",
  "filepath": "twillm-wiki/tiddlers/My_Tiddler.md",
  "canonical": "twillm-wiki/tiddlers/My_Tiddler.md",
  "isCanonical": true,
  "isLooselyCanonical": true,
  "isShadow": false,
  "isSystem": false
}
```

**Ordinary tiddler overriding a shadow:**

```json
{
  "exists": true,
  "title": "HelloThere",
  "filepath": "twillm-wiki/tiddlers/HelloThere.md",
  "canonical": "twillm-wiki/tiddlers/HelloThere.md",
  "isCanonical": true,
  "isLooselyCanonical": true,
  "isShadow": true,
  "isSystem": false
}
```

**A shadow tiddler exists with this title, no ordinary override:**

```json
{
  "exists": false,
  "isShadow": true,
  "isSystem": false,
  "title": "TiddlyWiki",
  "fileInfo": null,
  "filepath": null,
  "canonical": "TiddlyWiki.md"
}
```

If the title is requested through the API, the shadow's content is returned. Creating an ordinary tiddler with this title would override it.

**No ordinary tiddler and no shadow — safe to create:**

```json
{
  "exists": false,
  "isShadow": false,
  "isSystem": false,
  "title": "My Page",
  "fileInfo": null,
  "filepath": null,
  "canonical": "My Page.md"
}
```

### Decision logic when creating a tiddler

The skill has two concerns: **does this title collide** (another tiddler already exists here) and **is there a shadow** (a plugin definition would be overridden). The `exists` field answers the first; the `isShadow` field answers the second.

1. **`exists: true`** → an ordinary tiddler with this exact title already exists on disk. Before creating, decide: should you update the existing tiddler or create something new?
   - If the content overlaps (same concept, more details, newer findings) — **update the existing tiddler**. Read it first, revise in place, and note the change. Don't duplicate.
   - If the content is genuinely distinct but related — **pick a new title** that distinguishes itself (add a qualifier, sub-topic, or different angle). Check the new title with another `GET /bdawg/canonical` call to make sure it doesn't collide too.
2. **`exists: false, isSystem: true`** → system tiddler (`$:/...`); do not create.
3. **`exists: false, isShadow: true`** → a shadow tiddler with this title exists in a plugin but no ordinary tiddler overrides it. Overriding it is a **"No No"** — always pick a different title. The only exception: if the user explicitly and unambiguously instructs you to override a specific shadow, proceed as instructed without trying to find a different name.
4. Otherwise (`exists: false, isShadow: false`) → safe to create. Use `canonical` as the filename for the new file.

**Practical tips:**
- The `canonical` field is always present and gives you the exact filename to use — no need to manually map titles to filenames yourself.
- When checking multiple related titles, make one call per title; the endpoint is fast.
- If the user explicitly says to create/override a shadow, proceed and note it.

## Fallback: Shadow Detection Without Canonical Plugin

If the canonical-filenames plugin is not available, fall back to TiddlyWiki's built-in filter operators:

```bash
# Does this title have a shadow? (count only — never fetch [all[shadows]] for a dry-run)
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[[MyNewTitle]is[shadow]count[]]'
# > 0 → shadow exists; reconsider the title or ask the user
# == 0 → no shadow, safe to create

# Check all shadows starting with a prefix
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[X]count[]]'
# > 0 → see which ones match:
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[X]]' | jq 'map(.title)'
```

## Fixing Non-Canonical Filenames

For the full workflow on fixing non-canonical filenames using `POST /bdawg/canonical`, see `lint-workflows.md`.

To find existing ordinary tiddlers that override a (shadow) tiddler:

```bash
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[is[tiddler]is[shadow]]' | jq -r '.[].title'
```

### Resolution

1. **Ask the user** — don't assume all overrides need renaming; some intentional ones (e.g., custom sidebar content) are deliberate.
2. **Retitle each confirmed unintentional override:** Change the `title:` frontmatter to the new name, rename the file on disk, and update wikilinks pointing to it. See the retitling workflow in `lint-workflows.md` for details. Do **not** add an `aliases:` field for the old shadow title — just omit it.
