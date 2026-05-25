# Setup Guide for twillm wiki

When initializing or checking a twillm wiki project, handle both the runtime setup (Docker compose or npx) AND version control setup (`.gitignore`). The gitignore step is always required unless the user explicitly declines.

## Gitignore Rules

Three things inside `twillm-wiki/` are transient and must be gitignored — check if a `.gitignore` exists at the project root and add these lines if missing:

```
# twillm transient content (recreated automatically)
twillm-wiki/output/
# overwritten by materialiseWiki() on every start, even with bind-mount trick
twillm-wiki/tiddlywiki.info
# runtime story state — not meaningful to commit
twillm-wiki/tiddlers/$__StoryList.tid
```

Use `scripts/gitignore.example` from this skill as the canonical `.gitignore` template. If no `.gitignore` exists, create one at the project root by copying this file. If a `.gitignore` already exists, check whether each of the three entries is present — add only the missing ones.

**Always put comments on their own line, never inline with gitignore entries.** Git will treat the entire line as the pattern, so `twillm-wiki/output/ # comment` would try to ignore a directory named literally `"output/ # comment"`. If you need to explain something, use a standalone `# comment` line above the entry.

`twillm-wiki/tiddlywiki.info` gets overwritten every time twillm starts (by `materialiseWiki()` copying from the template directory), whether or not you use the bind-mount trick to persist plugin edits. Always gitignore it.

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
```

For non-standard vault names:

```yaml
volumes:
  - ./docs/wiki:/app/vault:Z           # SELinux relabel for Linux hosts
  - ./docs/twillm-wiki:/app/twillm-wiki:Z
```

The user can customize the host mount to map any directory. Document this in the compose file comments.

### Persisting tiddlywiki.info Edits

`twillm-wiki/tiddlywiki.info` is the TiddlyWiki configuration file loaded on startup — it controls which plugins and themes are active. The `tiddlywiki.info` inside `twillm-wiki/` gets overwritten every time twillm starts because `materialiseWiki()` in twillm's cli.js unconditionally copies all files from `template-wiki/` into `twillm-wiki/`. There is no existence guard.

This means any plugin additions to `twillm-wiki/tiddlywiki.info` are lost on container restart. To persist edits, bind-mount a custom `tiddlywiki.info` over the template path:

```yaml
services:
  twillm:
    volumes:
      - ./vault:/app/vault:Z
      - ./twillm-wiki:/app/twillm-wiki:Z
      - ./template-wiki/tiddlywiki.info:/app/template-wiki/tiddlywiki.info:Z
```

The user creates a `template-wiki/` directory alongside their compose file and puts their customized `tiddlywiki.info` there. The bind mount shadows the template file inside the container so materialiseWiki has nothing to overwrite.

**Default tiddlywiki.info:** Use `scripts/template-wiki/tiddlywiki.info` from this skill as the starting point when helping users set up a new project. Copy it into the user's `template-wiki/` directory.

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
After editing, validate with `jq . < template-wiki/tiddlywiki.info`. If jq fails, report the error to the user — TiddlyWiki may tolerate non-standard JSON (comments, trailing commas, etc.) that jq rejects, so don't assume it's broken. Ask the user if they want you to fix the formatting or leave it as-is.

**Popular TiddlyWiki plugins** (add to `"plugins"` array):
| Plugin | Use for |
|---|---|
| `tiddlywiki/highlight` | Syntax highlighting for code blocks via highlight.js |
| `tiddlywiki/katex` | Mathematical typesetting with KaTeX |
| `tiddlywiki/railroad` | Railroad diagrams for grammar/IR visualizations |
| `tiddlywiki/tw5.com-docs` | Official TiddlyWiki 5 documentation as a reference wiki |
| `orange/mermaid-tw5` | Mermaid diagrams (flowcharts, sequence diagrams, etc.) |

**Themes** can also be added to the `"themes"` array. Default: `[vanilla, snowwhite]`.

### Validate Syntax

Always run `docker compose config` **before** making changes to verify the existing file is valid. If it fails, tell the user and ask what to do rather than guessing fixes.

After making changes, run `docker compose config` again before telling the user they're done. A broken compose file can silently break other services in the project — don't risk leaving it in a bad state.

### Upgrade Existing Setup

When the user asks to "check" or "upgrade" their docker-compose (e.g., "check my docker setup", "upgrade my docker setup"), check each item independently by pattern-matching against the user's compose file — do NOT try to diff line-by-line against the fixture. The fixture (`scripts/docker-compose.example.yml`) is for reference only; use its volume mount strings as the known-good values when a mount is missing:

1. **Find the compose file:** Check for `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml`.
2. **Read it** (small files directly; large files use `docker compose config --services`).
3. **Check each item independently** by looking for specific volume mount patterns in the user's file:
   - **Vault mount present** — grep for a line matching `./vault:/app/vault:Z` or a non-standard path (e.g. `./docs/wiki:/app/vault:Z`)
   - **twillm-wiki mount present** — grep for `./twillm-wiki:/app/twillm-wiki:Z`. If missing, this is critical: generated content from ingest is lost on container restart.
   - **tiddlywiki.info bind mount** (optional but recommended) — if the user wants to add TiddlyWiki plugins, they need `./template-wiki/tiddlywiki.info:/app/template-wiki/tiddlywiki.info:Z`. Suggest this proactively if not present.
   - **Port binding** — confirm the host port matches what's already in use (don't "fix" a deliberate port change)
   - **:Z SELinux label** — present for Linux hosts; note if absent on systems where it's needed
4. **Propose changes.** Show the user exactly what's missing and ask before modifying. For example: "Your compose file is missing the `twillm-wiki` volume mount — without it, all generated content from ingestion will be lost when the container restarts. Want me to add it?" Do not try to copy lines from the fixture into the user's file; always write complete, valid volume mount entries.
5. **Validate after changes:** Run `docker compose config` to confirm validity.

If the user's setup has other services or a custom structure, preserve their configuration and only add what's missing. Do not suggest removing or modifying existing services or volumes that aren't part of twillm.
