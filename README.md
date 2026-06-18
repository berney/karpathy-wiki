# Karpathy Wiki

A multi-harness plugin that provides skills for managing a [twillm](https://github.com/Jermolene/twillm) wiki — an incremental, compounding knowledge base where an LLM maintains structured, interlinked Markdown tiddlers.
Also contains the Docker image build context for twillm itself.

## Installation

Install from the [Berney Claude Code plugin marketplace](https://github.com/berney/claude-plugins).
Once installed, you get four skills:

| Skill      | What it does                                                           |
|------------|------------------------------------------------------------------------|
| `setup`    | Initialize a new wiki project — vault, Docker Compose, system tiddlers |
| `work`     | Daily operations — ingest sources, curate tiddlers, query knowledge    |
| `lint`     | Periodic health checks — broken links, orphans, tag hygiene            |
| `describe` | Generate description frontmatter for all wiki tiddlers                 |

## Quick Start

1. In your project directory, invoke the setup skill: `/setup`
2. The skill creates `docker-compose.yml`, `.gitignore`, `vault/`, `twillm-wiki/`, and more
3. Start the wiki: `docker compose up`
4. Visit `http://localhost:<port>` (discover the port with `docker compose port twillm 8080`)

From there, use `/work` to ingest sources and build your knowledge base, `/lint` for periodic health checks.

## Mono-repo Structure

```
.claude-plugin/        Plugin manifest for Claude Code
.codex-plugin/         Plugin manifest for Codex CLI
.cursor-plugin/        Plugin manifest for Cursor IDE
.kimi-plugin/          Plugin manifest for Kimi
skills/                Harness-agnostic skills (shared across editors)
  setup/               Bootstrap a new twillm wiki project
  work/                Daily wiki operations (ingestion, querying, curation)
  lint/                Health checks and maintenance
  describe/            Description frontmatter generation
hooks/                 Harness hooks — session management scripts for each supported editor
docs/                  Internal wiki content for this plugin's own development
twillm/                Docker image build context for twillm
  Dockerfile           Image definition — bundles TiddlyWiki plugins etc.
  cli.js               CLI entrypoint
  goss.yaml            Health-check assertions
  plugins/             TiddlyWiki plugins bundled in the image
  template-wiki/       Empty template directory (prevents materialiseWiki clobbering)
```

This is a mono-repo. The `skills/`, `hooks/`, and per-harness manifests are the distributable plugin. The `twillm/` directory builds the Docker image referenced by the setup skill's `docker-compose.yml` template — it bundles TiddlyWiki plugins, shadow tiddlers, and system configuration so users need nothing beyond this plugin and Docker.

## How It Works

```
User installs plugin  →  Gets skills + setup skill
                        ↓
User runs /setup      →  Skill generates docker-compose.yml, vault/, twillm-wiki/
                        ↓
docker compose up     →  Pulls twillm image (pre-baked with TiddlyWiki plugins)
                        ↓
Vault edits live      →  twillm watches vault/ and serves wiki in browser
```

The Docker image handles all the TiddlyWiki heavy lifting.
The skills handle everything else — project setup, daily LLM workflows, and maintenance.

## Development

- Edit skills in `skills/` — each skill is a SKILL.md with optional scripts, references, and fixtures that any compatible harness can consume
- Build the Docker image: `docker build -t ghcr.io/berney/twillm twillm/`
- Test a wiki locally by running `/setup` in a test directory after making changes
