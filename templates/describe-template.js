export const meta = {
  name: 'describe',
  description: 'Generate or update description frontmatter for wiki tiddlers',
  phases: [
    { title: 'Processing' },
  ],
};

const FILES = {{FILES}};
const CONCURRENCY = {{CONCURRENCY}};
const VAULT_ROOT = '{{VAULT_ROOT}}';

function jobPrompt(file) {
  return `You are processing a wiki tiddler for description frontmatter generation.

1. Read the file: ${VAULT_ROOT}/${file}
2. Evaluate the description state from the frontmatter:
   - MISSING: no \`description:\` line exists → write a one-line summary
   - REDUNDANT: description equals (or closely repeats) the title → replace with a genuine summary
   - GOOD: description is different from title and provides unique info → skip
3. If update needed, use the Edit tool to add or replace the \`description:\` frontmatter line. Insert it between \`title:\` and \`tags:\` in the frontmatter block. Preserve all other frontmatter fields unchanged. Update \`modified:\` timestamp if present.
4. Return ONLY a JSON object (no markdown fences, no explanation): {"file":"${file}","action":"added"|"updated"|"skipped","description":"<the description text or null if skipped>"}

Description quality rules:
- One line, max ~256 characters
- Provides context the title alone does not
- Does NOT repeat or paraphrase the title
- Plain prose, no markdown, no wikilinks`;
}

// Steady-state dispatch: keep CONCURRENCY agents running at all times
phase('Processing');
log(`Processing ${FILES.length} files with concurrency=${CONCURRENCY}`);

const queue = [...FILES];
let added = 0, updated = 0, skipped = 0, errCount = 0;

function dispatch() {
  if (queue.length === 0) return null;
  const file = queue.shift();
  return agent(jobPrompt(file), { phase: 'Processing' })
    .then(r => {
      try {
        let parsed;
        if (typeof r === 'string') {
          const m = r.match(/\{"file"\s*:\s*"vault\/[^"]+"\s*,\s*"action"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*(null|"[^"]*")\}/);
          if (m) parsed = JSON.parse(m[0]);
        } else {
          parsed = r;
        }
        if (parsed && parsed.file) {
          if (parsed.action === 'added') added++;
          else if (parsed.action === 'updated') updated++;
          else if (parsed.action === 'skipped') skipped++;
          return;
        }
      } catch(e) {}
      errCount++;
    })
    .catch(() => { errCount++; });
}

// Seed
for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) dispatch();

// Steady-state: as each Promise resolves, dispatch next
async function runSteadyState() {
  // We need to interleave awaits. With a simple while loop + await for each,
  // the agents finish sequentially which defeats concurrency.
  // Instead: batch in groups of CONCURRENCY.
  while (queue.length > 0) {
    const batch = [];
    for (let i = 0; i < CONCURRENCY && queue.length > 0; i++) {
      batch.push(dispatch());
    }
    await Promise.all(batch);
    log(`Progress: ${added + updated + skipped}/${FILES.length} (added:${added} updated:${updated} skipped:${skipped})`);
  }
}

await runSteadyState();

log(`Done: ${FILES.length} tiddlers — added ${added}, updated ${updated}, skipped ${skipped}, errors ${errCount}`);
return { total: FILES.length, added, updated, skipped, errors: errCount };
