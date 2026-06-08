Implementation details of how TiddlyWiki maps a tiddler title to an on-disk filename when saving via the [[WebServer API]] Node.js adapter. This covers the actual code path, all edge cases, and undocumented behaviour not present in user-facing docs.

## Source Files

Two modules implement the full pipeline:

| File | Function | Role |
|---|---|---|
| `core-server/filesystem.js` | `$tw.utils.generateTiddlerFileInfo()` (l.213) | Determines file format (.tid, .json, body+meta), then calls generateTiddlerFilepath |
| `core-server/filesystem.js` | `$tw.utils.generateTiddlerFilepath()` (l.317-409) | Maps title → canonical filepath with all sanitisation steps |
| `core/modules/utils/transliterate.js` | `$tw.utils.transliterate()` (l.917-921) | Converts accented/non-ASCII chars to ASCII equivalents |

## The Pipeline (step-by-step)

### 1. pathFilters override (filesystem.js:324-333)

If `options.pathFilters` is set, each filter expression is evaluated against the tiddler's tags/fields. The first matching filter's output becomes the entire filepath. This is what $:/config/FileSystemPaths uses. If no filter matches, proceed to step 2.

### 2. originalpath fallback (filesystem.js:335-338)

If saving a tiddler that was read from disk and carries an `originalpath`, the function preserves its on-disk path without extension. This is how TiddlyWiki remembers where it originally found each file, enabling renames when the title changes.

### 3. Base = title (filesystem.js:340)

If neither pathFilters nor originalpath apply, use the title directly as the starting string.

### 4. Slashes → underscore (filesystem.js:342)

Replace `/` and `\` with `_`. This prevents directory traversal — a title like `Some/Path/Tiddler` becomes `Some_Path_Tiddler` rather than creating subdirectories.

### 5. Windows reserved names (filesystem.js:345)

Prefix any filename matching Windows reserved device names with underscores:

| Pattern | Example input → output |
|---|---|
| `con`, `prn`, `aux`, `nul` | `CON.md` → `_CON_.md` |
| `com[0-9]` | `COM1` → `_COM1_` |
| `lpt[0-9]` | `LPT1` → `_LPT1_` |

### 6. Leading spaces → underscores (filesystem.js:347)

Leading spaces are replaced with the same number of underscores to prevent trailing space issues.

### 7. Leading dots → underscores (filesystem.js:349-352)

If path doesn't start with `.` or `..`, replace leading dots with underscores. This prevents invisible files on Unix systems where dotfiles are hidden by default.

### 8. Unicode control codes (filesystem.js:354)

Replace all Unicode control characters (`\x00-\x1f` and `\x80-\x9f`) with `_`.

### 9. Unsafe chars + transliteration (filesystem.js:356) **← undocumented**

This is the core sanitisation step, done in sequence:

```javascript
filepath = $tw.utils.transliterate(
  filepath.replace(/<|>|~|\:|\"|\||\?|\*|\^/g,"_")
);
```

1. Replace characters that are unsafe on multiple filesystems: `< > | ~ : " | ? * ^` → `_`
2. Then call `$tw.utils.transliterate()` — a 914-pair lookup table (transliterationPairs) that maps accented/Unicode characters to ASCII equivalents:
   - `é` → `e`, `ñ` → `n`, `ß` → `ss`, `Ü` → `U`, `Ÿ` → `Y`
   - Cyrillic: `Ф` → `F`, `ж` → `zh`, `ч` → `ch`
   - Ligatures: `ﬀ` → `ff`, `ﬁ` → `fi`, `œ` → `oe`, `ﬆ` → `st`
   - Superscripts/subscripts: `ₐ` → `a`, `ᵢ` → `i`

**Important:** transliterate only affects characters that are *not* already replaced in step 9a. The regex `/[^A-Za-z0-9\[\] ]/g` in transliterate preserves spaces, brackets, and ASCII alphanumerics.

### 10. Extension cleanup (filesystem.js:357-362)

Remove trailing dots/spaces from extension with same number of underscores. Truncate extensions longer than 32 characters.

### 11. Redundant extension removal (filesystem.js:364-366)

If the filepath already ends with the target extension, strip it first to avoid double-appending.

### 12. Filename truncation (filesystem.js:368-370)

Truncate the filename portion to 200 characters.

### 13. Quirkify — all-punctuation fallback (filesystem.js:372-381)

If the title consists entirely of punctuation or becomes empty after sanitisation, fall back to character codes joined by hyphens: `...` → `46-46-46`.

### 14. File clash handling (filesystem.js:383-392)

Append `_0`, `_1`, etc. if a file already exists at that path. Skipped if `overwrite: true` is passed in options. The existing filepath is remembered to avoid re-clashing with the same name during updates.

### 15. encode hook + URI encoding fallback (filesystem.js:396-406)

Two mechanisms can kick in here:

a. **`th-make-tiddler-path` hook** — allows plugins to modify the computed path before final validation.

b. **`encodeURIComponentExtended()` fallback** — if the resolved write path doesn't fall within any of the allowed directories (wikiTiddlersPath, options.directory, or originalpath's parent), the full path gets URI-encoded. This catches non-ASCII characters that survived transliteration and unusual filesystem layouts.

## File Format Decision (`generateTiddlerFileInfo`)

Before computing the filepath, `generateTiddlerFileInfo()` determines the file format:

1. **`application/json`** — if any field value (other than `text`) contains control characters (`\x00-\x1F`) or leading/trailing whitespace.
2. **`application/x-tiddler` (.tid)** — if tiddler type is `text/vnd.tiddlywiki`, `text/vnd.tiddlywiki-multiple`, or has a `_canonical_uri` field.
3. **Type-specific with `.meta` sidecar** — all other types save the body content separately and a `.meta` file for metadata fields.

Extension can be overridden via $:/config/FileSystemExtensions (evaluated as filter expressions before step 2 above).

## Originalpath Tracking

During boot, `boot/boot.js:2302-2317` builds `$tw.boot.files[title]` for every loaded file and stores the relative path as originalpath. This is then written into the system tiddler $:/config/OriginalTiddlerPaths as a JSON object.

During save operations, the filesystem adaptor (`plugins/tiddlywiki/filesystem/filesystemadaptor.js`) passes the existing `fileInfo` to `generateTiddlerFilepath()`, which uses `originalpath` (step 2 above) to preserve or update the on-disk location. After a successful write, `$tw.utils.cleanupTiddlerFiles()` deletes the old file if the path changed.

## What's NOT in User-Facing Docs

- The **transliterate step** happens *after* character replacement, not before
- Windows reserved name sanitisation (step 5) is completely undocumented
- Leading dot handling (step 7) is undocumented
- The `th-make-tiddler-path` hook mechanism (step 15a) is undocumented
- `$tw.utils.encodeURIComponentExtended()` URI encoding fallback (step 15b) is undocumented

## Related Topics

- [](<#KW: $:/config/OriginalTiddlerPaths>) — boot-time snapshot of title → filepath mapping, exposed via REST API
- [[Customising Tiddler File Naming]] — user-facing customisation via $:/config/FileSystemPaths and $:/config/FileSystemExtensions
- Source: `core-server/filesystem.js`, `core/modules/utils/transliterate.js` in [[TiddlyWiki5]]
