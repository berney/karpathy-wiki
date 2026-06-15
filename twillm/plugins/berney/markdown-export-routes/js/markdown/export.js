/*\
title: $:/plugins/bdawg/markdown-export-routes/markdown/export.js
type: application/javascript
module-type: route
\*/

"use strict";

var mdTiddler;
try {
	mdTiddler = require("$:/plugins/cdaven/markdown-export/md-tiddler.js");
} catch (e) {
	console.error("markdown-export-routes: failed to load markdown-export plugin:", e.message);
}

exports.methods = ["GET"];
exports.path = /^\/markdown\/export(\/(.*))?$/;
exports.info = {priority: 100};

exports.handler = function(request, response, state) {
	var title = "";
	if (state.params[0]) {
		title = decodeURIComponent(state.params[0]);
	} else {
		title = state.queryParameters.title || "";
	}
	if (!title) {
		state.sendResponse(400, {"Content-Type": "text/plain"}, "Missing required 'title' parameter or path segment", "utf8");
		return;
	}
	var tiddler = state.wiki.getTiddler(title);
	if (!tiddler) {
		state.sendResponse(404, {"Content-Type": "text/plain"}, "Tiddler not found: " + title, "utf8");
		return;
	}
	var md;
	try {
		md = mdTiddler.run.call({getVariable: function(name) { return null; }}, title);
	} catch (err) {
		state.sendResponse(500, {"Content-Type": "text/plain"}, "Error rendering tiddler: " + err.message, "utf8");
		return;
	}
	if (!md) {
		state.sendResponse(500, {"Content-Type": "text/plain"}, "Failed to render markdown", "utf8");
		return;
	}
	state.sendResponse(200, {"Content-Type": "text/markdown; charset=utf-8"}, md, "utf8");
};
