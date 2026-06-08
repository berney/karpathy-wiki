The system tiddler **$:/config/OriginalTiddlerPaths** is a JSON mapping of every vault tiddler title to its on-disk filepath. It is built at boot time by [[TiddlyWiki on Node.js]]'s filesystem adaptor and exposed via the REST API.

## How it works

During boot, when `loadTiddlersFromPath()` reads tiddler files from the wiki directory, each file gets a `filepath` stored in `$tw.boot.files`. At the end of boot (boot.js), TiddlyWiki iterates these entries and writes them into $:/config/OriginalTiddlerPaths as a JSON object:

```json
{
  "TW5 Doc: Filters": "Filters.md",
  "Plugin: tw5.com-docs": "Plugin_ tw5.com-docs.md",
  ...
}
```

The relative path is resolved from `$tw.boot.wikiTiddlersPath` and uses forward slashes regardless of OS.

## Access via REST API

```bash
# Returns the full mapping in the `text` field (a JSON-encoded string)
xh get http://localhost:8052/recipes/default/tiddlers/$:/config/OriginalTiddlerPaths
```

To parse it programmatically, unwrap the nested JSON twice:

```bash
# jq approach — .text is a JSON string inside JSON
xh get http://localhost:8052/recipes/default/tiddlers/$:/config/OriginalTiddlerPaths | \
  jq -r '.text' | jq 'from_entries'

# Python approach (single step)
python3 -c "import json,sys; d=json.load(sys.stdin); m=json.loads(d['text']); print(m)"
```

## Limitations

- **Boot-time snapshot** — entries are populated from files present at boot. Files created directly on disk (not via the PUT API / syncer) will not appear until the wiki reloads or the tiddler is saved through the REST API.
- **Vault-only** — shadow tiddlers from plugins (`$:/plugins/...`) that have no on-disk file in the wiki folder do not get entries. Only ordinary tiddlers stored in the vault directory are mapped.
- **`isEditableFile` gate** — only files where `isEditableFile` is true are included. This flag is set to `true` when `retain-original-tiddler-path` config is enabled, or when the file path is outside `$tw.boot.wikiTiddlersPath`.

## Use cases

- **Filename audit** — compare the map against actual vault files to find orphaned files or missing entries.
- **Rename detection** — track when TiddlyWiki rewrites filenames due to character sanitisation (e.g., `Foo: Bar.md` → `Foo_ Bar.md`).
- **Bulk operations** — iterate all titles and their corresponding disk paths without parsing frontmatter.

## Related

- [[Customising Tiddler File Naming]] — $:/config/FileSystemPaths for overriding the default filename generation
- [[WebServer API]] — REST endpoints for tiddler access
- Source: boot.js `loadTiddlersNode()` in the [[TiddlyWiki5]] source repository
