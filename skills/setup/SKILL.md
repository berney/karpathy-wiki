---
name: setup
description: Set up a twillm wiki project — initialize vault, Docker Compose configuration, and system tiddlers. Use this whenever the user says "set up a wiki", "initialize twillm", "create a wiki vault", "check my docker compose", "upgrade my twillm setup", or "repair broken wiki configuration".
---

# LLM wiki for twillm — Setup

How to set up and operate a twillm wiki — an incremental, compounding knowledge base built from ingested sources. The LLM reads your raw documents and maintains structured, interlinked markdown tiddlers in a twillm vault. This skill handles project initialization, Docker Compose configuration, setup verification, and repair.

Use this whenever the user says "set up a wiki", "initialize twillm", "create a wiki vault", "check my docker compose", "upgrade my twillm setup", or "repair broken wiki configuration". For daily wiki work (ingesting sources, querying, maintaining tiddlers), use `work`.

## Key TiddlyWiki Concepts

| Term | Definition |
|---|---|
| Tiddler | The fundamental unit of information — equivalent to a page in other wikis, but tend to be small. |
| **Shadow Tiddler** | A tiddler bundled inside a plugin — always present in every wiki. |
| **(Shadow) Override** | When an ordinary tiddler shares a title with a shadow, overriding it in rendering. |
| **Ordinary Tiddler** | A tiddler stored in the vault, created or edited by the user. Wins over shadows. |
| **System Tiddler** | TiddlyWiki internal tiddlers starting with `$:/` (e.g. `$:/theme`). |

## Project Structure

```
project-root/
  CLAUDE.md              ← Agent instructions for this vault (not served as a wiki page)
  vault/                 ← The twillm vault — flat directory of tiddler files
    *.md                 ← Markdown tiddlers (ordinary tiddlers)
    *.tid                ← TiddlyWiki wikitext UI tiddlers
  twillm-wiki/           ← Where twillm persists generated and derived content
    tiddlywiki.info      ← Plugin/theme configuration
    plugins/             ← Local plugins (markdown export routes)
    tiddlers/            ← System tiddlers, shell views, graphs
  template-wiki/         ← Empty directory (read-only bind mount prevents clobbering)
  docker-compose.yml     ← Docker Compose configuration
```

**Critical paths:**
- `CLAUDE.md` at the **project root**, outside any vault directory. twillm renders every `.md` inside the vault as a wiki page.
- Vault tiddlers are in `vault/` by default — alternative names need an explicit compose mount change.
- `twillm-wiki/` is where twillm persists generated and derived content from ingestion. Both `vault/` and `twillm-wiki/` need persistence (bind-mounted in Docker).

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
- `title` (required): The tiddler's logical title — the original, unmapped name. Use Title Case with spaces. **Only one `title:` line should exist.** YAML uses the last value, so duplicate `title:` lines silently overwrite earlier ones and can cause mismatched title-to-filename mappings. The file itself must be named using the canonical mapping (see the work skill for details).
- `description` (optional): A one-line description of the tiddler's content — additional context that supplements the title with new information, not redundant phrasing. Used by computed index views to surface tiddler meaning at a glance.
- `tags` (required): YAML array of classification tags. See Tagging Taxonomy below.
- `rating` (optional): Integer 1–9 reflecting confidence or importance.
- `created` / `modified` (required): ISO-8601 timestamps — both millisecond UTC (`2026-06-04T10:21:47.840Z`) and timezone offsets (`2026-06-04T12:00:00+10:00`) are fine. Update `modified` on every edit.
- `aliases` (optional): Alternate names that should resolve to this tiddler.

### Tagging Taxonomy

| Tag | Use for |
|---|---|
| `Topic` | Broad subject area, the "root" category for a topic cluster |
| `Concept` | Specific ideas, methods, algorithms, techniques |
| `Architecture` | Model/system architectures and components |
| `Paper` | Academic papers (author-year named) |
| `Entity` | People, organizations, datasets, tools |

**Rules:**
- Every tiddler must have tags. Minimum one tag.
- `Topic` is the broadest level — use it sparingly, usually one per subject area.

## Docker Port

The docker-compose service is always named `twillm`. When it's running, discover the host port with:

```bash
docker compose port twillm 8080   # returns "127.0.0.1:8051" → extract "8051"
```

If this fails (no output), start it: `docker compose up -d`. Then retry to get the port. Always use `docker compose port twillm 8080` rather than hard-coding a port number — users may have customized their compose configuration.

## Operations

### Init a New Wiki

1. **Ask about the primary domain** (research topic, personal interest, business area) to customize CLAUDE.md tag taxonomy.
2. **Create directories:** `vault/`, `twillm-wiki/`, `template-wiki/` (empty, just `.gitkeep`).
3. **Copy fixtures** from this skill's `scripts/twillm-wiki/` into the user's `twillm-wiki/`:

   ```bash
   rsync -a <skill-scripts>/twillm-wiki/ ./twillm-wiki/
   ```

   If `rsync` is not available, fall back to:

   ```bash
   cp -a <skill-scripts>/twillm-wiki/ ./twillm-wiki/
   ```

4. **Create `.gitignore`:** Two things inside `twillm-wiki/` are transient:

   ```
   # twillm transient content (recreated automatically)
   twillm-wiki/output/
   # runtime story state — not meaningful to commit
   twillm-wiki/tiddlers/$__StoryList.tid
   ```

5. **Create `docker-compose.yml`:** Use the template from this skill's `scripts/docker-compose.example.yml`. The service is always named `twillm` and listens on port 8080 internally. Bind-mount all three directories.

6. **Create CLAUDE.md** at the project root with a tag taxonomy customized to the user's domain. Follow the format in [Tiddler Conventions](#tiddler-conventions) above.

7. **Start the service** (see below) and confirm it's accessible.

### Check or Upgrade Existing Setup

Verify these items independently:

1. **Find compose file:** `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, or `compose.yaml`.
2. **Validate syntax:** Run `docker compose config` before making changes.
3. **Gitignore check:** Verify the two transient entries are present in `.gitignore`. If `twillm-wiki/tiddlywiki.info` is gitignored, remove that line — it was removed from the canonical gitignore when we switched to the empty-template pattern.
4. **System tiddlers:** Verify these required files exist in the user's `twillm-wiki/`:
   - `plugins/markdown-export-routes/` (directory)
   - `tiddlywiki/info` exists and has valid plugins list
5. **Volume mounts** — verify these patterns in the compose file:
   - Vault mount with `./vault:/app/vault:Z` or non-standard path
   - `./twillm-wiki:/app/twillm-wiki:Z` (critical — without it, generated content is lost)
   - `./template-wiki/:/app/template-wiki/:ro,Z` (without it, materialiseWiki() clobbers user edits)
6. **Report findings** and propose changes. Do not silently modify compose files.

### Repair Broken Setup

Diagnose with these steps:

1. **Empty-template integrity:** `template-wiki/` should contain only `.gitkeep`. If it has real files, materialiseWiki() will copy them into twillm-wiki/ on every start.
2. **Bind mount presence:** Check that template-wiki is mounted read-only (`:ro,Z`). Without it, the container uses the image's baked-in template-wiki/ which has actual files.
3. **System tiddler restoration:** Copy only missing items from this skill's `scripts/twillm-wiki/`:

   ```bash
   # Dry run first — inspect before copying
   rsync -avin <skill-scripts>/twillm-wiki/ ./twillm-wiki/
   ```

4. **Validate after changes:** Run `docker compose config` to confirm validity.

## Running the Service

```bash
docker compose up -d      # start detached
docker compose ps twillm  # verify running
docker compose port twillm 8080  # discover host port
docker compose down        # stop
```
