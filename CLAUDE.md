## Notes for editing this vault

- The wiki at http://localhost:8080 (when running) reflects vault edits live via filesystem watching.
- Frontmatter `title` wins over filename when they differ; keep them in sync where you can.
- `created`/`modified` are optional; if present they round-trip as ISO-8601 strings.
  Omit `type` — `.md` extension implies `text/x-markdown` and it rounds-trip out.
- List fields (`tags`, `list`) should be YAML arrays: `tags: [concept, multi word tag]`.
- For TiddlyWiki UI tiddlers (wikitext, macros, dashboards) use `.tid` instead of `.md`,
  and put them in `twillm-wiki/tiddlers/`.

## Tiddler format

Markdown files with YAML frontmatter:

```markdown
---
title: Some Concept
tags: [concept, synthesis]
rating: 6
---

Body in Markdown. Wiki links: [[Other Tiddler]]
```

The YAML frontmatter is extracted into native TiddlyWiki fields:
- **Arrays** on list fields (tags, list) become TiddlyWiki bracketed lists
- **Strings** are stored as-is
- **Other types** (objects, booleans) are stored as JSON
