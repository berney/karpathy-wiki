# Lint Workflows

Comprehensive procedures for wiki health-checking. See the main SKILL.md for the high-level lint overview and intent detection. See `shadow-tiddlers.md` for shadow-aware filtering in all workflows below.

## Missing Links Linting

**Missing links** are tiddler titles referenced by hard wikilinks (`[[Title]]`) but don't exist in the store (not even as shadows). The workflow for finding and fixing them:

### Step 1: Check Auto-Link Config

TiddlyWiki's `$:/config/WikiParserRules/Inline/wikilink` controls whether bare CamelCase words become links. Its value is either `enable` or `disable`. Default since TW5 v5.3.0 is `disable`, but a plugin shadow can override it to `enable`. Check first:

```bash
# Is CamelCase auto-linking enabled?
xh get http://localhost:$PORT/recipes/default/tiddlers/$:/config/WikiParserRules/Inline/wikilink | jq -r '.text'
# → "enable" or "disable"
```

This determines what counts as a link:
- **If `disable`:** Bare `FooBar` is plain text — it is never a link and will not appear in `[all[missing]]`.
- **If `enable`:** Bare `FooBar` (CamelCase) is auto-converted to a wikilink. It must exist as a tiddler or appear as broken. Treat it the same as `[[FooBar]]`.

TiddlyWiki auto-converts CamelCase words into wikilinks inside prose, table headings and cells, (but never inside code blocks), when this setting is `enable`.

**Two ways to suppress CamelCase auto-links (when enabled):**

1. **Use spaces to break the pattern.** `System Tag` instead of `SystemTag`. Works anywhere CamelCase appears — prose, tables, headings. Not a table-specific quirk.
2. **Prefix with `~`.** `~ThemeMechanism` renders as "ThemeMechanism" without a link. Only works when auto-linking is enabled; if it's disabled, `~` renders literally and looks ugly.

When camel case linking is **disabled**, CamelCase words are already plain text by default — no suppression needed, and the `~` prefix should be avoided since it appears as a visible character in the rendered output.

**System tiddlers:** TiddlyWiki system tiddlers like `$:/ControlPanel`, `$:/theme`, and `$:/language` are valid titles that TiddlyWiki auto-links (no brackets needed). Write them directly in prose — they become working links.

### Step 2: Find Broken Links

**Use the custom `filter-titles.json` endpoint** instead of `tiddlers.json`. The TiddlyWeb API restricts filter input to existing non-system ordinary tiddlers, so `[all[missing]]` and `[links[]]` miss references from system tiddlers and plugins. The custom route has no such restriction and catches all missing titles.

```bash
# Find ALL broken link source tiddlers (one pass)
xh get http://localhost:$PORT/recipes/default/filter-titles.json filter=='[all[missing]!is[shadow]!is[system]backlinks[]]' | jq -r '.[]'

# For each source, find which titles are missing:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[[Source Tiddler Title]links[]is[missing]!is[shadow]!is[system]]' | jq -r '.[]'

# Count a specific tiddler's missing links:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[[Source Tiddler Title]links[]is[missing]!is[shadow]!is[system]count[]]'
```

**Filter chain breakdown:**
1. `[all[missing]]` — get all missing titles
2. `!is[shadow]` — remove ones that have a matching shadow (title mismatch, not truly broken)
3. `!is[system]` — remove system tiddlers
4. `backlinks[]` — resolve to the source tiddlers pointing at each missing title

### Step 3: Fix Broken Links

When a wikilink shows up as missing, don't immediately create a new tiddler. Three common cases:

**A) Title mismatch (CamelCase/casing difference):** Only relevant if CamelCase auto-linking is `enable`. The tiddler exists but under a different title than the wikilink uses. Split CamelCase into spaced words and search shadows:

```bash
# "ThemeMechanism" is missing — Check all (ordinary) tiddlers:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[all[tiddlers]search:title[Theme Mechanism]]' | jq -r '.[:3]'

# Check if there's any "Theme Mechanism" shadow tiddlers:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[all[shadows]search:title[Theme Mechanism]]' | jq -r '.[:3]'

# Check all (ordinary + shadow) tiddlers:
xh get http://localhost:$PORT/recipes/default/filter-titles.json 'filter==[all[tiddlers+shadows]search:title[Theme Mechanism]]' | jq -r '.[:3]'
```

If found, update the wikilink to match the actual title.

**B) Hallucinated link:** The wikilink references a concept that doesn't actually exist in the wiki (no ordinary tiddler, no shadow match). If nothing matches even with CamelCase splitting, the wikilink is likely hallucinated — or perhaps the content hasn't been added yet. Generally, you should create the target tiddler before other tiddlers link to it. If the concept doesn't belong in the wiki at all, remove the reference from the source tiddler.

## Counting with `count[]` (no pipe to jq)

The TW5 `[count[]]` filter operator replaces `| jq length`:

```bash
# Instead of: xh get ... | jq length
xh get http://localhost:$PORT/recipes/default/filter-titles.json filter=='[all[shadows]count[]]'
# → ["1768"]

# Works with any filter:
xh get ... filter=='[tag[Concept]count[]]'
xh get ... filter=='[[Source Tiddler]links[]is[missing]count[]]'
```

## Retitling Tiddlers

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
xh get http://localhost:$PORT/recipes/default/tiddlers.json 'filter==[[{NewTitle}]count[]]'
# == 0 → safe, no conflict
```

**When retitling a tiddler that overrides a (shadow) tiddler,** only change the title and filename. Do **not** add an `aliases:` field for the old name — just omit it. See `shadow-tiddlers.md` for shadow detection and resolution details.

## Computed Views (.tid)

For interactive views, create TiddlyWiki wikitext tiddlers with `.tid` extension, placed side by side with `.md` files in the vault directory (e.g., `vault/Dashboard.tid`). They use the same location — twillm serves them both.

```yaml
title: Topic Index
type: text/vnd.tiddlywiki
tags: []
---

<<list-links filter:"[tag[Topic]]">>
```

Useful computed views include tag listings (`<<list-links filter:"[tag[X]]">>`), recent updates, or custom dashboards. These are optional but powerful for navigation.
