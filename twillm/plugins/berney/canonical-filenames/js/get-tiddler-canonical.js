/*\
title: $:/plugins/berney/canonical-filenames/get-tiddler-canonical.js
type: application/javascript
module-type: route

GET /bdawg/canonical?title=<tiddler-title>[&extension=.md]
  Returns {exists, isSystem, isShadow, title, description, fileInfo, filepath, canonical, isCanonical, isLooselyCanonical, tags}
  For existing tiddlers: all fields populated.
  For non-existent: exists=false, only title + canonical are set (fileInfo/filepath/null).

GET /bdawg/canonical?filename=<tiddler-filename.ext>
  Looks up a tiddler by its on-disk filename (basename or relative path).
  Returns the same fields as the title variant. Returns 404 if not found.

GET /bdawg/canonical?filter=<filter>[&extension=.md]
  Returns [{exists, isSystem, isShadow, title, description, fileInfo, filepath, canonical, isCanonical, isLooselyCanonical, tags}]
  for every tiddler matching the filter. Defaults to [!is[system]] if neither `title` nor `filter` supplied.
  `extension` only applies for non-existing tiddlers (where there's no on-disk file to determine extension from).

POST /bdawg/canonical?title=<tiddler-title>&strict=false
  Renames a single tiddler file on disk from its current name to the canonical (sanitised) name.
  strict=true also fixes casing; strict=false skips files that are already
  the lowercase version of the canonical name (e.g. index.md → Index.md).

POST /bdawg/canonical/rename-all?strict=false
  Renames all tiddler files on disk to their canonical names. Skips system tiddlers.

\*/
"use strict";

var path = $tw.node ? require("path") : null;
var fs = $tw.node ? require("fs") : null;

exports.methods = ["GET", "POST"];
exports.path = /^\/bdawg\/canonical(\/rename-all)?$/;
exports.info = {
  priority: 100
};

// Compute project-root once at module load time
var root = path.dirname($tw.boot.wikiPath);

function resolveRelative(filepath) {
  if (!filepath) return null;
  return path.relative(root, filepath);
}

/**
 * Resolve the directory to use for canonical path computation.
 * For existing files: their parent directory. Otherwise: wiki tiddlers dir.
 */
function resolveDirectory(existingFileInfo) {
  if (existingFileInfo && existingFileInfo.filepath) {
    return path.dirname(existingFileInfo.filepath);
  }
  return $tw.boot.wikiTiddlersPath;
}

/**
 * Reverse-lookup a tiddler title by its on-disk filename (basename or relative path).
 * Returns the title string or null.
 */
function lookupTitleByFilename(filename) {
  var titles = Object.keys($tw.boot.files);
  for (var i = 0; i < titles.length; i++) {
    var t = titles[i];
    var fi = $tw.boot.files[t];
    if (!fi || !fi.filepath) continue;
    var rel = resolveRelative(fi.filepath);
    if (rel === filename || path.basename(rel) === filename) {
      return t;
    }
  }
  return null;
}

/**
 * Compute canonical file info for an EXISTING tiddler.
 * Returns { ok, existingFileInfo, canonicalFileInfo, tags, description } or { ok: false, reason }.
 */
function lookupExisting(title, wiki) {
  var existingFileInfo = $tw.boot.files[title] || null;
  if (!existingFileInfo || !existingFileInfo.filepath) {
    return {ok: false, reason: "no existing file info"};
  }

  var tiddler = wiki.getTiddler(title);
  if (!tiddler) {
    return {ok: false, reason: "tiddler not found"};
  }

  // Compute canonical file info (type + extension detection).
  // fileInfo.overwrite:true skips the collision loop since we manage files.
  var canonicalFileInfo = $tw.utils.generateTiddlerFileInfo(tiddler, {
    directory: path.dirname(existingFileInfo.filepath),
    fileInfo: {overwrite: true}
  });

  var fields = tiddler.fields || {};
  return {ok: true, existingFileInfo, canonicalFileInfo, tags: fields.tags, description: fields.description};
}

/**
 * Compute canonical filepath for a title — works even if the tiddler doesn't exist.
 * Returns absolute filepath or null on failure.
 */
function computeCanonicalPath(title, extension) {
  var directory = resolveDirectory(null);
  return $tw.utils.generateTiddlerFilepath(title, {
    directory: directory,
    extension: extension || ".md",
    overwrite: true
  });
}

/**
 * Rename file on disk if current ≠ canonical. Returns action result.
 */
function renameIfDifferent(title, existingFileInfo, canonicalFileInfo, strict) {
  var currentPath = existingFileInfo.filepath;

  // Already at the canonical name
  if (currentPath === canonicalFileInfo.filepath) {
    return {ok: true, skipped: false, filepath: resolveRelative(currentPath), canonical: resolveRelative(canonicalFileInfo.filepath)};
  }

  // System tiddlers — never rename, their on-disk names are managed by TiddlyWiki core
  if ($tw.wiki.isSystemTiddler(title)) {
    return {skipped: true, reason: "system tiddler"};
  }

  // Non-strict mode: skip if current path is the lowercase version of canonical path
  if (!strict) {
    if (existingFileInfo.filepath.toLowerCase() === canonicalFileInfo.filepath.toLowerCase()) {
      return {ok: true, skipped: true, reason: "lowercase match", filepath: resolveRelative(currentPath), canonical: resolveRelative(canonicalFileInfo.filepath)};
    }
  }

  // Rename the file on disk (sync — this is an admin endpoint)
  try {
    $tw.utils.createDirectory(path.dirname(canonicalFileInfo.filepath));
    fs.copyFileSync(currentPath, canonicalFileInfo.filepath);
    fs.unlinkSync(currentPath);

    // Update boot.files: start with existingFileInfo (has all the right fields
    // like originalpath, isEditableFile, dynamicStoreId), then surgically update
    // filepath, type, hasMetaFile, and originalpath to match the new path.
    var updatedInfo = $tw.utils.extend({}, existingFileInfo, {
      filepath: canonicalFileInfo.filepath,
      type: canonicalFileInfo.type,
      hasMetaFile: canonicalFileInfo.hasMetaFile,
      originalpath: path.relative($tw.boot.wikiTiddlersPath, canonicalFileInfo.filepath)
    });
    $tw.boot.files[title] = updatedInfo;

    return {ok: true, renamed: true, filepath: resolveRelative(currentPath), canonical: resolveRelative(canonicalFileInfo.filepath)};
  } catch (err) {
    return {ok: false, reason: err.message};
  }
}

/**
 * Build the canonical info JSON for a single tiddler.
 */
function buildResponse(state, title, info, extension) {
  if (info.ok) {
    return {
      exists: true,
      title: title,
      description: info.description,
      fileInfo: info.existingFileInfo,
      filepath: resolveRelative(info.existingFileInfo.filepath),
      canonical: resolveRelative(info.canonicalFileInfo.filepath),
      isCanonical: info.existingFileInfo.filepath === info.canonicalFileInfo.filepath,
      isLooselyCanonical: info.existingFileInfo.filepath.toLowerCase() === info.canonicalFileInfo.filepath.toLowerCase(),
      isShadow: state.wiki.isShadowTiddler(title),
      isSystem: state.wiki.isSystemTiddler(title),
      tags: info.tags || []
    };
  } else {
    return {
      exists: false,
      isShadow: state.wiki.isShadowTiddler(title),
      isSystem: state.wiki.isSystemTiddler(title),
      title: title,
      description: null,
      fileInfo: null,
      filepath: null,
      canonical: path.basename(computeCanonicalPath(title, extension || ".md")),
      tags: []
    };
  }
}

exports.handler = function(request, response, state) {
  var title = state.queryParameters.title;
  var filename = state.queryParameters.filename;
  var isRenameAll = (state.urlInfo.pathname === "/bdawg/canonical/rename-all");

  // GET /bdawg/canonical — lookup only (supports non-existent titles and filtering)
  if (request.method === "GET") {
    var extension = state.queryParameters.extension;
    var filter = state.queryParameters.filter;

    // Resolve filename → title if provided instead of title
    if (title === undefined && filename !== undefined) {
      var resolved = lookupTitleByFilename(filename);
      if (!resolved) {
        response.writeHead(404, {"Content-Type": "application/json"});
        return response.end(JSON.stringify({error: "Tiddler not found for filename: " + filename}));
      }
      title = resolved;
    }

    if (!title && !filter) {
      filter = "[!is[system]]";
    }

    // Filter mode — returns an array
    if (title === undefined && filter !== undefined) {
      var matchedTitles, results;
      try {
        matchedTitles = state.wiki.filterTiddlers(filter);
      } catch(e) {
        response.writeHead(400, {"Content-Type": "application/json"});
        return response.end(JSON.stringify({error: e.message || String(e)}));
      }

      results = [];
      for (var i = 0; i < matchedTitles.length; i++) {
        var t = matchedTitles[i];
        results.push(buildResponse(state, t, lookupExisting(t, state.wiki), extension));
      }

      response.writeHead(200, {"Content-Type": "application/json"});
      response.end(JSON.stringify(results));
      return;
    }

    // Single tiddler mode — returns an object
    var info = lookupExisting(title, state.wiki);
    var body = JSON.stringify(buildResponse(state, title, info, extension));
    response.writeHead(200, {"Content-Type": "application/json"});
    response.end(body);
    return;
  }

  // POST /bdawg/canonical — rename a single tiddler file
  if (request.method === "POST" && !isRenameAll) {
    if (!title) {
      response.writeHead(400, {"Content-Type": "text/plain"});
      return response.end("Missing 'title' query parameter");
    }

    var info = lookupExisting(title, state.wiki);
    if (!info.ok) {
      response.writeHead(200, {"Content-Type": "application/json"});
      response.end(JSON.stringify({title: title, ...info}));
      return;
    }

    var strict = (state.queryParameters.strict || "false") === "true";
    var result = renameIfDifferent(title, info.existingFileInfo, info.canonicalFileInfo, strict);
    response.writeHead(200, {"Content-Type": "application/json"});
    response.end(JSON.stringify({title: title, ...result}));
    return;
  }

  // POST /bdawg/canonical/rename-all — rename all tiddler files
  if (request.method === "POST" && isRenameAll) {
    var strict = (state.queryParameters.strict || "false") === "true";
    var results = {};
    var titles = Object.keys($tw.boot.files);
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      var info = lookupExisting(t, state.wiki);
      if (!info.ok) {
        results[t] = {ok: false, reason: info.reason};
        continue;
      }
      results[t] = renameIfDifferent(t, info.existingFileInfo, info.canonicalFileInfo, strict);
    }
    response.writeHead(200, {"Content-Type": "application/json"});
    response.end(JSON.stringify({results}));
    return;
  }

  // Unmatched — should never happen due to exports.path guard
  response.writeHead(404, {"Content-Type": "text/plain"});
  response.end("Not found");
};
