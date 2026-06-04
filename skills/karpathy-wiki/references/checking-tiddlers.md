# Checking Tiddler Titles Before Creating

Practical commands for checking shadow status before creating new tiddlers. This is the file referenced from the main SKILL.md Ingest section — it contains only the pre-create check workflow. For the concept of how shadow overriding works, see `shadow-tiddlers.md`.

## Check Before Creating New Tiddlers

**Every time before you create a new tiddler**, check that its title will not override an existing (shadow) tiddler:

```bash
# Does this title override a shadow? (count only)
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[[MyNewTitle]is[shadow]count[]]'
# > 0 → shadow exists; reconsider the title or ask the user
# == 0 → no shadow, safe to create

# Check all shadows starting with a prefix (two-step: count first, then titles if needed)
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[WebServer]count[]]'
# > 0 → show which ones match:
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[all[shadows]prefix[WebServer]]' | jq 'map(.title)'
```

**Practical tips:**
- Never fetch `[all[shadows]]` just for a dry-run — it's large and unnecessary. Use `[all[shadows]prefix[X]count[]]` instead.
- When adding multiple related tiddlers, use `[all[shadows]prefix[X]count[]]` filter to count results first; pipe to `jq 'map(.title)'` only if the count is > 0 to see which shadows you might be overriding.
- If the user explicitly says to create/override a shadow, proceed and note it.

## Detecting Existing Overrides

To find existing ordinary tiddlers that override a (shadow) tiddler:

```bash
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[is[tiddler]is[shadow]]' | jq -r '.[].title'
```

### Resolution

1. **Ask the user** — don't assume all overrides need renaming; some intentional ones (e.g., custom sidebar content) are deliberate.
2. **Retitle each confirmed unintentional override:** Change the `title:` frontmatter to the new name, rename the file on disk, and update wikilinks pointing to it. See the retitling workflow in `lint-workflows.md` for details. Do **not** add an `aliases:` field for the old shadow title — just omit it.
