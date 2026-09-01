# Karpathy Wiki Plugin

- This repo is a multi-harness plugin containing Agentic Skills.
- Skills are for managing a [twillm](https://github.com/Jermolene/twillm) wiki
- twillm is an incremental, compounding knowledge base where an LLM maintains structured, interlinked Markdown tiddlers.
- Also contains the Docker image build context for twillm itself.
- The Docker image handles all the TiddlyWiki heavy lifting.
- The skills handle everything else — project setup, daily LLM workflows, and maintenance.
- A separate repo is the marketplace used to distribute the plugin
  [Berney Claude Code plugin marketplace](https://github.com/berney/claude-plugins).

## Skills

| Skill      | What it does                                                           |
|------------|------------------------------------------------------------------------|
| `setup`    | Initialize a new wiki project — vault, Docker Compose, system tiddlers |
| `work`     | Daily operations — ingest sources, curate tiddlers, query knowledge    |
| `lint`     | Periodic health checks — broken links, orphans, tag hygiene            |
| `describe` | Generate description frontmatter for all wiki tiddlers                 |

## Mono-repo Structure

```text
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

## Markdown Writing Conventions

- **One sentence per line.*
  Write each sentence on its own line, even when sentences belong to the same paragraph.
  This avoids MD013 (line-length) warnings and matches your preferred style.

  Good:

  ```markdown
  This is a sentence.
  This is another sentence, same paragraph.
  ```

  Bad:

  ```markdown
  This is a sentence. And this is another sentence on the same line.
  ```

- **Lint with `rumdl`.** After creating or editing any `.md` file, run `rumdl` on it.
  MD013 (line-length) warnings are acceptable when the line cannot naturally be broken with a newline after a period.
  If a line can easily be split by inserting a newline after a `.`, do so — it avoids the warning and matches the one-sentence-per-line convention.
