# Shadow Tiddlers

Shadow tiddlers are built-in defaults from TiddlyWiki 5 core and plugins (e.g. `tw5.com-docs` plugin). They're always present but only render when no ordinary tiddler shares their title. This page covers the concept and filtering operators — the practical "check before creating" workflow is in `checking-tiddlers.md`. See `lint-workflows.md` for missing link analysis that accounts for shadows.

## How Shadow Overriding Works

Shadows are **not hidden** — they're fully retrievable and viewable through the WebServer API. What changes is which version TW5 renders:

- **When overridden:** An ordinary tiddler with the same title wins over the shadow in rendering. `GET /recipes/default/tiddlers/{title}` returns the ordinary version.
- **When not overridden:** The shadow tiddler is returned by `GET /recipes/default/tiddlers/{title}` — full content, just like any other tiddler.

**WebServer API endpoints for individual tiddlers:**

```bash
# Get JSON of a specific tiddler (returns ordinary if overridden, shadow if not)
xh get http://localhost:$PORT/recipes/default/tiddlers/{title}

# Get rendered HTML of a tiddler
xh get http://localhost:$PORT/{title}
```

## Filter Operators for Shadow Status

| Filter | Meaning |
|---|---|
| `[all[shadows]]` | All shadow tiddlers from plugins (large, requires `$:/config/Server/AllowAllExternalFilters=yes`). **Selection constructor** — generates new input rather than filtering the existing one. |
| `[is[tiddler]is[shadow]]` | Ordinary tiddlers that override a shadow. `is[tiddler]` selects stored items; `is[shadow]` narrows to those also in the shadows set. **Preferred for detecting unintentional overrides among existing content.** |
| `[[Foo]is[shadow]]` | Title "Foo" has a corresponding shadow tiddler. If an ordinary tiddler "Foo" exists, it returns that (not the shadow). |
| `[[Foo]is[shadow]!is[tiddler]]` | "Foo" is purely a shadow, no ordinary tiddler overrides it. |
| `[[Foo]!is[shadow]is[tiddler]]` | "Foo" is purely ordinary — no shadow exists with that title. |
| `[prefix[X]]` | Tiddlers whose title starts with X (C — selection constructor) |
| `[suffix[X]]` | Tiddlers whose title ends with X (C — selection constructor) |

## Detecting and Resolving Existing Shadow Overrides

If you need to check existing tiddlers for unintentional shadow overrides, see `checking-tiddlers.md`.
