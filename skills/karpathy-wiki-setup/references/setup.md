# Setup Guide for twillm wiki

When initializing or checking a twillm wiki project, handle both the runtime setup (Docker compose or npx) AND version control setup (`.gitignore`). The gitignore step is always required unless the user explicitly declines.

## Vault Directory Discovery

twillm auto-detects vault directories by name: **vault/**, **notes/**, or **content/**. It also treats the current directory as a vault if `.obsidian/` is present. For any other path (e.g. `docs/wiki/`), an explicit argument must be passed to twillm.

When the user mentions a vault that isn't one of the auto-detected names, use twillm with an explicit path argument: `twillm docs/wiki`.

For Docker setups, mount the chosen directory to `/app/vault` in the container — twillm always looks for `./vault` from its working directory. The user can customize this mapping (e.g. `./docs:/app/vault`).

## Gitignore Rules

Two things inside `twillm-wiki/` are transient and must be gitignored — check if a `.gitignore` exists at the project root and add these lines if missing:

```
# twillm transient content (recreated automatically)
twillm-wiki/output/
# runtime story state — not meaningful to commit
twillm-wiki/tiddlers/$__StoryList.tid
```

Use `scripts/gitignore.example` from this skill as the canonical `.gitignore` template. If no `.gitignore` exists, create one at the project root by copying this file. If a `.gitignore` already exists, check whether each of the two entries is present — add only the missing ones.

**Always put comments on their own line, never inline with gitignore entries.** Git will treat the entire line as the pattern, so `twillm-wiki/output/ # comment` would try to ignore a directory named literally `"output/ # comment"`. If you need to explain something, use a standalone `# comment` line above the entry.

`twillm-wiki/tiddlywiki.info` is normally overwritten on every start by `materialiseWiki()`, which is why it was removed from the gitignore above — with the empty-template pattern (template-wiki/ kept free of files), there's nothing to copy so no clobbering occurs.

## Docker Setup

For Docker deployments, follow these steps. For quick one-off use without Docker, see the npx instructions in SKILL.md.

### Compose Detection Strategy

When setting up Docker:

1. **Check for existing compose files:** Read `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml` if they exist.
2. **For small files (< 100 lines):** Read the file directly, look for conflicts (existing service named `twillm`/`wiki`/`docs`, port conflicts).
3. **For large files:** Use `docker compose config --services` and `docker compose config --profiles` to list services without loading the full file into context. Ask the user if they want you to modify this file or create a separate one.
4. **No existing compose or user prefers fresh setup:** Create a new `docker-compose.yml`.

### Port Detection Strategy

When choosing a port for the twillm container:

1. Check common ports (8080, 8082, 9090, 3000).
2. Check existing compose files for exposed ports.
3. If still unclear, ask the user or offer 8082 as default and note it's configurable.

### Service Naming

The twillm service can be named `twillm`, `wiki`, or `docs` — use a name that fits the project context. Check for conflicts with existing services using the detection strategy above.

### Image vs Build

Use the published image (`image: ghcr.io/berney/twillm:latest`). For custom builds (e.g., testing a fork), uncomment `build:` in the compose file and point it at the twillm/ context.

### Vault Mounting

Mount both directories required by twillm. The vault holds your hand-written tiddlers; `twillm-wiki` holds generated content from ingest — both persist across restarts:

```yaml
volumes:
  - ./vault:/app/vault:Z          # hand-written tiddlers
  - ./twillm-wiki:/app/twillm-wiki:Z   # generated/derived content from ingest
  - ./template-wiki/:/app/template-wiki/:ro,Z   # empty dir, read-only, prevents materialiseWiki() clobbering
```

For non-standard vault names:

```yaml
volumes:
  - ./docs/wiki:/app/vault:Z           # SELinux relabel for Linux hosts
  - ./docs/twillm-wiki:/app/twillm-wiki:Z
  - ./template-wiki/:/app/template-wiki/:ro,Z
```

The user can customize the host mount to map any directory. Document this in the compose file comments. The `template-wiki/` directory should be kept empty (`.gitkeep` only) so that materialiseWiki() has no files to copy into twillm-wiki/.

### Empty Template Pattern (prevents clobbering)

`twillm-wiki/tiddlywiki.info` is the TiddlyWiki configuration file loaded on startup — it controls which plugins and themes are active. The `tiddlywiki.info` inside `twillm-wiki/` gets overwritten every time twillm starts because `materialiseWiki()` in twillm's cli.js unconditionally copies all files from `template-wiki/` into `twillm-wiki/`. There is no existence guard.

The standard approach to prevent clobbering: keep `template-wiki/` intentionally empty and pre-populate `twillm-wiki/` with a default `tiddlywiki.info`. Since template-wiki/ has no files, there's nothing for materialiseWiki() to copy, so twillm-wiki/ is left alone.

For the Docker compose file, bind-mount an empty template-wiki/:

```yaml
services:
  twillm:
    volumes:
      - ./vault:/app/vault:Z
      - ./twillm-wiki:/app/twillm-wiki:Z
      - ./template-wiki/:/app/template-wiki/:ro,Z
```

**Setting up the directories:**

1. Create an empty `template-wiki/` directory (just a `.gitkeep` for git tracking).
2. Ensure the user's `twillm-wiki/` directory exists (create it if missing).
3. Copy all fixtures from this skill's `scripts/twillm-wiki/` into the user's `twillm-wiki/` using rsync:

   ```bash
   rsync -a <skill-scripts>/twillm-wiki/ ./twillm-wiki/
   ```

   This includes system tiddlers (site title, graphs, state) and required plugin content:
   - `tiddlywiki.info` — sensible defaults: markdown, highlight, tour, confetti, dynannotate, vanilla/snowwhite themes
   - `tiddlers/$__plugins_cdaven_markdown-export.json` — markdown-export plugin definition
   - `plugins/markdown-export-routes/` — local plugin exposing `/markdown/export/*` endpoints

   If `rsync` is not available, fall back to:

   ```bash
   cp -a <skill-scripts>/twillm-wiki/ ./twillm-wiki/
   ```

   The trailing `/` means "copy the contents, not the directory itself." Both preserve permissions and subdirectories, including dotfiles.

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

After editing, validate with `jq . < twillm-wiki/tiddlywiki.info`. If jq fails, report the error to the user — TiddlyWiki may tolerate non-standard JSON (comments, trailing commas, etc.) that jq rejects, so don't assume it's broken. Ask the user if they want you to fix the formatting or leave it as-is.

**Popular TiddlyWiki plugins** (add to `"plugins"` array):
| Plugin | Use for |
|---|---|
| `tiddlywiki/highlight` | Syntax highlighting for code blocks via highlight.js |
| `tiddlywiki/katex` | Mathematical typesetting with KaTeX |
| `tiddlywiki/railroad` | Railroad diagrams for grammar/IR visualizations |
| `tiddlywiki/tw5.com-docs` | Official TiddlyWiki 5 documentation as a reference wiki |
| `tiddlywiki/jszip` | This plugin provides primitives for creating Zip files in the browser. It also makes the JSZip library available for use by other plugins. |
| `orange/mermaid-tw5` | Mermaid diagrams (flowcharts, sequence diagrams, etc.) |

**Themes** can also be added to the `"themes"` array. Default: `[vanilla, snowwhite]`.

### Validate Syntax

Always run `docker compose config` **before** making changes to verify the existing file is valid. If it fails, tell the user and ask what to do rather than guessing fixes.

After making changes, run `docker compose config` again before telling the user they're done. A broken compose file can silently break other services in the project — don't risk leaving it in a bad state.

### Upgrade Existing Setup

When the user asks to "check" or "upgrade" their docker-compose (e.g., "check my docker setup", "upgrade my docker setup"), check each item independently by pattern-matching against the user's compose file — do NOT try to diff line-by-line against the fixture. The fixture (`scripts/docker-compose.example.yml`) is for reference only; use its volume mount strings as the known-good values when a mount is missing:

1. **Find the compose file:** Check for `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`.
2. **Read it** (small files directly; large files use `docker compose config --services`).
3. **Gitignore migration:** If the user has a `.gitignore` with `twillm-wiki/tiddlywiki.info`, remove that line — it was removed from the canonical gitignore when we switched to the empty-template pattern (keeping `template-wiki/` free of files means there's nothing for `materialiseWiki()` to copy, so no clobbering occurs).
4. **System tiddlers check:** Verify these required system tiddlers exist in the user's `twillm-wiki/` — if any are missing the setup is from before they were added or they were deleted accidentally:
   - `plugins/markdown-export-routes/` (directory — a local plugin exposing `/markdown/export/*` endpoints)
   - `tiddlers/$__plugins_cdaven_markdown-export.json` (markdown-export plugin definition)

   Copy only the missing items — be surgical, don't overwrite the full directory. Use `rsync` with a dry run first to verify nothing unexpected would change:

   ```bash
   # Dry run — inspect before copying
   rsync -avin <source>/ <destination>/
   ```

   Check that only the expected missing items would be created or overwritten. If safe, follow up with `rsync -a`. For example, if only one of the system tiddler directories is missing:

   ```bash
   rsync -avin <skill-scripts>/twillm-wiki/plugins/ ./twillm-wiki/plugins/
   ```

   If `rsync` is not available, fall back to `cp -a --update=none-fail source dest` which refuses to overwrite existing files — the copy will fail with an error if the destination already exists, rather than silently clobbering it.
5. **Check each item independently** by looking for specific volume mount patterns in the user's file:
   - **Vault mount present** — grep for a line matching `./vault:/app/vault:Z` or a non-standard path (e.g. `./docs/wiki:/app/vault:Z`)
   - **twillm-wiki mount present** — grep for `./twillm-wiki:/app/twillm-wiki:Z`. If missing, this is critical: generated content from ingest is lost on container restart.
   - **template-wiki bind mount present** — grep for `./template-wiki/:/app/template-wiki/:ro,Z`. Without it, the container uses the image's baked-in template-wiki/ which has actual files; materialiseWiki() copies those into twillm-wiki/ on every start, clobbering user edits and resetting tiddlywiki.info back to defaults.
   - **Port binding** — confirm the host port matches what's already in use (don't "fix" a deliberate port change)
   - **:Z SELinux label** — present for Linux hosts; note if absent on systems where it's needed
6. **Propose changes.** Show the user exactly what's missing and ask before modifying. For example: "Your compose file is missing the `twillm-wiki` volume mount — without it, all generated content from ingestion will be lost when the container restarts. Want me to add it?" Do not try to copy lines from the fixture into the user's file; always write complete, valid volume mount entries.
7. **Validate after changes:** Run `docker compose config` to confirm validity.

If the user's setup has other services or a custom structure, preserve their configuration and only add what's missing. Do not suggest removing or modifying existing services or volumes that aren't part of twillm.
