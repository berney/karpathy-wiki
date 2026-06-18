# Installing karpathy-wiki for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add karpathy-wiki to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["karpathy-wiki@git+https://github.com/berney/karpathy-wiki.git"]
}
```

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
registers all skills.

Verify by asking: "Tell me about your karpathy-wiki skills"

OpenCode uses its own plugin install. If you also use Claude Code, Codex, or
another harness, install karpathy-wiki separately for each one.

## Migrating from the old symlink-based install

If you previously installed karpathy-wiki using `git clone` and symlinks, remove the old setup:

```bash
# Remove old symlinks
rm -f ~/.config/opencode/plugins/karpathy-wiki.js
rm -rf ~/.config/opencode/skills/karpathy-wiki

# Optionally remove the cloned repo
rm -rf ~/.config/opencode/karpathy-wiki

# Remove skills.paths from opencode.json if you added one for karpathy-wiki
```

Then follow the installation steps above.

## Usage

Use OpenCode's native `skill` tool:

```
use skill tool to list skills
use skill tool to load karpathy-wiki setup
```

## Updating

OpenCode installs karpathy-wiki through a git-backed package spec. Some OpenCode
and Bun versions pin that resolved git dependency in a lockfile or cache, so a
restart may not pick up the newest karpathy-wiki commit. If updates do not appear,
clear OpenCode's package cache or reinstall the plugin.

To pin a specific version:

```json
{
  "plugin": ["karpathy-wiki@git+https://github.com/berney/karpathy-wiki.git#v0.1.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -i karpathy-wiki`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Windows install issues

Some Windows OpenCode builds have upstream installer issues with git-backed
plugin specs, including cache paths for `git+https` URLs and Bun not finding
`git.exe` even when it works in a normal terminal. If OpenCode cannot install
the plugin, try installing with system npm and pointing OpenCode at the local
package:

```powershell
npm install karpathy-wiki@git+https://github.com/berney/karpathy-wiki.git --prefix "$HOME\.config\opencode"
```

Then use the installed package path in `opencode.json`:

```json
{
  "plugin": ["~/.config/opencode/node_modules/karpathy-wiki"]
}
```

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

Skills speak in actions ("create a tiddler", "run a health check", "read a file"). On OpenCode these resolve to:

- "Create a file" / "edit a file" / "delete a file" → `apply_patch`
- "Run a shell command" → `bash`
- "Search file contents" / "find files by name" → `grep`, `glob`
- "Fetch a URL" → `webfetch`
