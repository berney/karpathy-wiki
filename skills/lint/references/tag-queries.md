# Tag queries

## 1. List all unique tags (sorted)

```bash
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tags[]sort[]]'
```

Returns a JSON array of every unique tag used across all tiddlers, sorted alphabetically. Use this to audit tag hygiene — look for near-duplicates (`Concept` vs `concepts`), tags used by only one tiddler, or tags that should be merged.

Without `sort[]` (`[tags[]]`) the list is unsorted and harder to scan.

## 2. Count tiddlers with a specific tag

```bash
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tag[foo]count[]]'
```

Returns the number of tiddlers tagged with `foo`. This uses the `[tag[<tag>]count[]]` form — `tag` takes a single argument (the tag name), while `tags` takes no arguments (it lists all unique tags).

## 3. List tiddlers with a specific tag

```bash
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tag[Concept]]'
```

Returns the titles of all tiddlers tagged with `Concept`. To also get the count, run a second query with `[tag[Concept]count[]]` — `count[]` replaces the list rather than appending to it.

## 4. List tags with their counts

```bash
xh get http://localhost:$PORT/bdawg/filter-titles filter=='[tags[]sort[]] :map[all[tiddlers]tag<currentTiddler>count[]addprefix[:]addprefix<currentTiddler>]'
```

Returns the count of tiddlers for each unique tag in the form `["foo:3", "bar:4", "baz:1"]`. Useful for spotting tags used by only one tiddler (potential orphan tags). The `:map` iterates over each tag from `[tags[]sort[]]`, uses it as `<currentTiddler>` to count matching tiddlers, then prefixes the tag name with `:` separator.
