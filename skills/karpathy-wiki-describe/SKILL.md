---
name: karpathy-wiki-describe
description: Generate and update description fields in wiki tiddlers via subagent-based batch processing. Use when the user says "describe all", "describe the papers", "describe vault/*.md", "[prefix[Foo:]]", or has a list of file paths to process. Supports --refresh for re-evaluating existing descriptions.
---

# LLM wiki — Description Generator

Generate and update `description` frontmatter fields across wiki tiddlers using subagent-based batch processing with configurable concurrency. Each subagent handles one file in isolation — no cross-file context pollution, even when processing hundreds of files.

**Related skills:**

| Skill | Role with descriptions |
|---|---|
| `karpathy-wiki-work` | Inline — writes description during ingest/edit, already has content. No subagent overhead. |
| `karpathy-wiki-lint` | Read-only stat — "N tiddlers missing descriptions" during scan phase. Does not write. |

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

- **File glob:** shell-expand with `find vault -name '<glob>' -type f` or similar. Files are flat in `vault/`.
- **TiddlyWiki filter:** pass verbatim to the twillm API's `/bdawg/canonical` endpoint. The response is JSON where each object includes a `filepath` field — extract these with `jq 'map(.filepath)'`. If the call fails, report the error and exit without dispatching.
- **Explicit list:** validate each path exists with `test -f`. Skip non-existent entries silently and note them in the final report.
- **Natural language:** infer intent. "describe all" → file glob `vault/*.md`. "the papers" → TiddlyWiki filter `[tag[Paper]]`. "Foo: *.md" → TiddlyWiki filter `[prefix[Foo:]]`.

After resolution, produce a deduplicated list of absolute paths (relative to vault root). If the list is empty, report that and exit without dispatching.

## Dispatch Algorithm — Steady-State Concurrency

Given a resolved file list and concurrency N (default 2):

1. **Seed:** Spawn up to `min(N, queue.length)` background subagents immediately.
2. **Steady-state refill:** As each subagent completes and a task notification is received, pop the next file from the queue and dispatch it. Keep at most N concurrent.

Pseudocode:

```
queue = resolved_files[]        # ordered list of files to process
in_flight = []                  # tracking active subagents

# Seed phase
for i in 1..min(N, len(queue)):
    file = queue.pop(0)
    spawn background subagent(file)
    in_flight.append(subagent_id)

# Steady-state loop
while queue not empty or in_flight not empty:
    receive task notification (one subagent done)
    record result {file, action, description?}

    if queue is not empty:
        file = queue.pop(0)
        spawn background subagent(file)
        in_flight.append(subagent_id)
    # If queue is empty, just remove from in_flight (implicitly handled)
```

**Key points:**
- All subagents run as **background tasks** so the main agent continues dispatching without blocking on notifications.
- Concurrency N should be configurable — default 2, adjustable by user based on GPU capacity.
- As each notification arrives, immediately dispatch the next queued file (not after all N complete).
- On completion of all files, report the summary and exit. No intermediate questions.

## Subagent Job (Per File)

Each subagent handles one tiddler end-to-end using **only the `Read` and `Edit` tools**. This is a fully autonomous batch operation — no external tool calls, no WebFetch, no Bash, no permission prompts.

1. **Read** the `.md` file using the `Read` tool. This includes frontmatter with any existing description field.
2. **Evaluate** the description state:
   - **Missing** — no `description:` line exists → write a one-line summary based on the file's content alone.
   - **Redundant** — description equals (or closely repeats) the title → replace with a genuine summary that adds context beyond the title.
   - **Good description exists** — description is different from title and provides unique information → skip the file entirely (unless `--refresh` mode, see below).
3. **Write** — if an update is needed, use the `Edit` tool to add or replace the `description:` frontmatter line. Insert it between `title:` and `tags:` in the existing frontmatter block. Preserve all other frontmatter fields unchanged. Update `modified:` timestamp if present.

   - **Adding a new description:** insert a full line `description: <your text>` as a new line after `title:`.
   - **Replacing an existing description:** match the **entire existing line** including the key and current value (e.g. `old_string: "description: redundant title"`) and replace it with the full new line (e.g. `new_string: "description: your actual text"`). Do NOT supply only the value as `old_string` — that would overwrite the entire line with just the value and lose the `description:` key.
4. **Return** a summary object: `{file, action: "added"|"updated"|"skipped", description?: string}`.

**Tool use restrictions:** Do NOT call WebFetch, Bash, Agent, CronCreate, or any tool other than Read and Edit. If the tiddler body contains URLs (YouTube links, arXiv IDs, etc.), ignore them — do not attempt to fetch or resolve them. Base the description solely on the text content available on disk.

### Description Quality Guidelines

A good description:
- Is one line (max ~256 characters)
- Provides context that the title alone does not
- Does NOT repeat or paraphrase the title
- Uses plain prose, no markdown formatting, no wikilinks

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

Fully autonomous run — no intermediate questions or prompts during the dispatch loop. After all files are processed, report a summary:

```
Processed 142 tiddlers — added 87 descriptions, updated 12 redundant ones, skipped 43 with good descriptions.
```

If any errors occurred (file read failures, edit conflicts), list them separately at the end of the summary.

## Tips

- **Describe during ingest instead.** If you are creating or editing a tiddler right now via `karpathy-wiki-work`, just write the description inline — the main agent already has the file content and doesn't need a subagent. Use this skill for bulk operations on files not currently in context.
- **Default concurrency of 2 is optimal for single-GPU setups.** Each background task shares the GPU; too many concurrent tasks slow down each one due to queue contention. Start at 2 and adjust based on observed performance.
