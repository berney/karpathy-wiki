---
name: describe
description: Generate and update description frontmatter for wiki tiddlers using workflow-based batch processing with configurable concurrency. Use this when the user says "describe all", "describe the papers", "describe vault/*.md", "[prefix[Foo:]]", or has a list of file paths to process.
---

# LLM wiki — Description Generator

Generate and update `description` frontmatter fields across wiki tiddlers using workflow-based batch processing with configurable concurrency. The main agent resolves input to file paths, fills a reusable workflow template, and emits the completed workflow for the harness to execute. Each subagent within the workflow handles one file in isolation — no cross-file context pollution, even when processing hundreds of files.

**Related skills:**

| Skill | Role with descriptions |
|---|---|
| `work` | Inline — writes description during ingest/edit, already has content. No subagent overhead. |
| `lint` | Read-only stat — "N tiddlers missing descriptions" during scan phase. Does not write. |

## Input Types

The caller provides one of:

| Type | Example | Resolution |
|---|---|---|
| File glob | `vault/*.md` or `vault/paper*.md` | Shell-expand, flat directory (no subdirectories) |
| TiddlyWiki filter | `[prefix[Foo:]]` or `[tag[Paper]tag[Concept]]` | Pass verbatim to the twillm API's `/bdawg/canonical` endpoint |
| List of filenames | `vault/Transformer.md vault/Attention.md` | Use as-is |
| Natural language | "describe the papers" or "Foo: *.md" | Infer which type applies |

Multiple invocations with different types are fine. For combining scopes, invoke separately.

**TiddlyWiki filter note:** Do not append `all[tiddlers]` to filters — the implicit starting state is `[all[tiddlers]]`, and appending it resets the list. Use `[tag[Paper]tag[Concept]]` for logical AND (tiddlers tagged with both).

## Resolving Targets

Given input, resolve a file list before dispatching:

- **File glob:** shell-expand with `find vault -name '<glob>' -type f` or similar. Files may be nested in subdirectories under `vault/`.
- **TiddlyWiki filter:** pass verbatim to the twillm API's `/bdawg/canonical` endpoint. The response is JSON where each object includes a `filepath` field — extract these with `jq 'map(.filepath)'`. If the call fails, report the error and exit without dispatching.
- **Explicit list:** validate each path exists with `test -f`. Skip non-existent entries silently and note them in the final report.
- **Natural language:** infer intent. "describe all" → file glob `vault/*.md`. "the papers" → TiddlyWiki filter `[tag[Paper]]`. "Foo: *.md" → TiddlyWiki filter `[prefix[Foo:]]`.

After resolution, produce a deduplicated list of relative paths (starting with `vault/`). If the list is empty, report that and exit without dispatching.

## Workflow-Based Dispatch

1. **Read the template.** Resolve the template path using `${CLAUDE_PLUGIN_ROOT}/templates/describe-template.js` and read its contents with the `Read` tool.
2. **Substitute placeholders.** Replace two placeholders in the template:
   - `{{FILES}}` → a JavaScript array literal of the resolved paths relative to the repo root, one per line, e.g.:
     ```
     [
       "vault/Transformer.md",
       "vault/paper/Attention.md",
     ]
     ```
   - `{{CONCURRENCY}}` → a number (default 2) based on user preference or GPU capacity
3. **Write the workflow.** Save the filled template to `~/.claude/workflows/describe-{timestamp}.js` where `{timestamp}` is an ISO-8601 timestamp without separators (e.g. `describe-20260618T150000.js`).
4. **Return a summary.** Report the number of files and concurrency: `"Emitted workflow for 47 files with concurrency=2."`

## Description Quality Guidelines

A good description:
- Is one line (max ~256 characters)
- Provides context that the title alone does not
- Does NOT repeat or paraphrase the title
- Uses plain prose, no markdown formatting, no wikilinks

These guidelines define the prompt text in `templates/describe-template.js`. When updating the template's `jobPrompt` function to change what subagents are told, refer to these rules.

Examples:

| Title | Good description | Bad description (redundant) |
|---|---|---|
| Transformer | A family of architectures using self-attention mechanisms | The Transformer architecture |
| Attention Is All You Need | Vaswani et al. 2017 paper that introduced the Transformer model | The paper "Attention Is All You Need" |
| Self-Attention | Computes weighted sums of values based on key-query similarity | Self-attention mechanism in neural networks |

## Refresh Mode

Add a `--refresh` flag parameter (default: disabled):

- **Default mode:** Only process files with missing or redundant descriptions. Skip files that already have a meaningful description. Fast and token-efficient for partially-done wikis.
- **`--refresh` mode:** Re-evaluate every file in the list, even those with existing descriptions. Useful after body edits may have invalidated older descriptions. More thorough but slower and more token-intensive.

## Reporting

The workflow handles reporting internally. After all files are processed, the workflow returns a summary to the main agent which relays it to the user:

```
Processed 142 tiddlers — added 87 descriptions, updated 12 redundant ones, skipped 43 with good descriptions.
```

If any errors occurred (file read failures, edit conflicts), list them separately at the end of the summary.

## Tips

- **Describe during ingest instead.** If you are creating or editing a tiddler right now via `work`, just write the description inline — the main agent already has the file content and doesn't need a workflow. Use this skill for bulk operations on files not currently in context.
- **Default concurrency of 2 is optimal for single-GPU setups.** Each background task shares the GPU; too many concurrent tasks slow down each one due to queue contention. Start at 2 and adjust based on observed performance.
