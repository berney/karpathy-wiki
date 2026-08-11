/*\
title: $:/plugins/bdawg/markdown-export-routes/markdown/filter.js
type: application/javascript
module-type: route
\*/

"use strict";

var mdExport;
try {
	mdExport = require("$:/plugins/cdaven/markdown-export/markdown-export.js");
} catch (e) {
	console.error("markdown-export-routes: failed to load markdown-export plugin:", e.message);
}

exports.methods = ["GET"];
exports.path = /^\/markdown\/filter(\/(.*))?$/;
exports.info = {priority: 100};

exports.handler = function(request, response, state) {
	var filter = "";
	// group 0 is the `(\/(.*))?` with the leading slash.
	// group 1 is the inner `(.*)` without the slash
	if (state.params[1]) {
		filter = decodeURIComponent(state.params[1]);
	} else {
		filter = state.queryParameters.filter || "";
	}
	if (!filter) {
		state.sendResponse(400, {"Content-Type": "text/plain"}, "Missing required 'filter' query parameter or path segment", "utf8");
		return;
	}
	var extension = state.queryParameters.extension || "";
	if (extension === ".zip") {
		if (!$tw.modules.titles["$:/plugins/tiddlywiki/jszip/jszip.js"]) {
			state.sendResponse(503, {"Content-Type": "text/plain"}, "jszip plugin not installed — cannot generate zip archives", "utf8");
			return;
		}
	}
	var md;
	try {
		md = mdExport.run(filter, "", "", extension);
	} catch (err) {
		state.sendResponse(500, {"Content-Type": "text/plain"}, "Error exporting: " + err.message, "utf8");
		return;
	}
	if (!md) {
		state.sendResponse(404, {"Content-Type": "text/plain"}, "No tiddlers matched the filter", "utf8");
		return;
	}

	var headers = {"Content-Type": "text/markdown; charset=utf-8"};
	if (extension === ".zip") {
		headers["Content-Type"] = "application/zip";
		md = Buffer.from(md, "base64");
	}
	state.sendResponse(200, headers, md, extension === ".zip" ? undefined : "utf8");
};
