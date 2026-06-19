export const meta = {
  name: 'describe',
  description: 'Generate or update description frontmatter for wiki tiddlers',
  phases: [
    { title: 'Processing' },
  ],
};

const FILES = {{FILES}};
const CONCURRENCY = {{CONCURRENCY}};

function jobPrompt(file) {
  return `Process this file: ${file}`;
}

// Steady-state dispatch: keep CONCURRENCY agents running at all times
phase('Processing');
log(`Processing ${FILES.length} files with concurrency=${CONCURRENCY}`);

const queue = [...FILES];
let added = 0, updated = 0, skipped = 0, errCount = 0;

function dispatch() {
  if (queue.length === 0) return null;
  const file = queue.shift();
  return agent(jobPrompt(file), { phase: 'Processing', agentType: 'describe-worker' })
    .then(r => {
      try {
        let parsed;
        if (typeof r === 'string') {
          const m = r.match(/\{"file"\s*:\s*"[^"]+"\s*,\s*"action"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*(null|"[^"]*")\}/);
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

// True steady-state: keep exactly CONCURRENCY agents inflight at all times.
// Each agent removes itself when done; a new one fires immediately if queue has work.
const active = new Set();

function addAgent() {
  if (queue.length === 0) return;
  const p = dispatch().finally(() => {
    active.delete(p);
    // One free slot → start another to maintain steady-state concurrency
    runSteadyState__dispatchNext();
  });
  active.add(p);
}

function runSteadyState__dispatchNext() {
  while (active.size < CONCURRENCY && queue.length > 0) {
    addAgent();
  }
}

runSteadyState__dispatchNext();

// Wait for all agents to finish, logging progress periodically.
await new Promise(resolve => {
  function checkDone() {
    if (active.size === 0) return resolve();
    log(`Progress: ${added + updated + skipped}/${FILES.length} (added:${added} updated:${updated} skipped:${skipped})`);
    setTimeout(checkDone, 3000);
  }
  checkDone();
});

log(`Done: ${FILES.length} tiddlers — added ${added}, updated ${updated}, skipped ${skipped}, errors ${errCount}`);
return { total: FILES.length, added, updated, skipped, errors: errCount };
