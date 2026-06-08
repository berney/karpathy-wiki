A TiddlyWiki plugin route that returns tiddler titles matching any TW5 filter expression.

# Route

**GET** `/bdawg/filter-titles?filter={filter-expression}`

The handler calls `wiki.filterTiddlers()` directly with the `filter` query parameter and returns a plain JSON array of title strings.

```bash
# Find all missing tiddlers (including those referenced by system tiddlers)
xh get http://localhost:8080/bdawg/filter-titles filter=='[all[missing]]' | jq -r '.[]'

# Get all backlinks to a tiddler
xh get http://localhost:8080/bdawg/filter-titles filter=='[[Transformer]backlinks[]]'

# All non-system tiddlers
xh get http://localhost:8080/bdawg/filter-titles filter=='[!is[system]count[]]'
```

## Error handling

A malformed filter expression returns **HTTP 400** with ``{"error": "Filter error: ..."}`` instead of HTTP 200 with a string in the array. This means tools using ``| jq length`` correctly see ``0`` (the response is an object, not an array).

```bash
# Malformed filter → 400 + {"error": "..."}
xh get http://localhost:8080/bdawg/filter-titles 'filter==[[TW5 Doc: Variables]]is[shadow]!is[tiddler]'
# > HTTP/1.1 400 BAD REQUEST
# > {"error": "Filter error: Missing [ in filter expression"}

# Safe jq usage — length is 0 on error (object, not array)
xh get http://localhost:8080/bdawg/filter-titles 'filter==[all[missing]]' | jq 'length'
```

## Benefit over built-in routes

The built-in ``/tiddlers.json`` route (TiddlyWeb API) only returns **existing** tiddlers — it filters to titles that are stored in the store. This means:

- It cannot return results for filters like ``[all[missing]]`` because missing tiddlers aren't in the store.
- System tiddler references from filters are excluded or restricted by default filter rules.

``/bdawg/filter-titles`` bypasses this entirely — it returns the **raw result** of ``filterTiddlers()`` regardless of whether the titles exist, are system tiddlers, or come from plugins. You can run any TW5 filter expression and get proper results.

## Comparison with ``/tiddlers.json``

| Feature | ``/tiddlers.json`` | ``/bdawg/filter-titles`` |
|---|---|---|
| Returns existing tiddler objects | Yes (full JSON) | No (title strings only) |
| Works with ``[all[missing]]`` | No | Yes |
| System tiddler references | Restricted/filtered | Unrestricted |
| Response size | Heavy (full tiddlers) | Minimal (just titles) |
| Arbitrary filter support | Limited by TiddlyWeb API | Full — calls ``filterTiddlers()`` directly |
