/*\
title: $:/plugins/zzberney/canonical-filenames/filter-titles.js
type: application/javascript
module-type: route

GET /bdawg/filter-titles?filter=<filter>
  Returns a list of tiddler titles matching the filter.
  Equivalent to `[all[tiddlers]...]` with any valid TW5 filter expression.

\*/
"use strict";

exports.methods = ["GET"];
exports.path = /^\/bdawg\/filter-titles$/;
exports.info = {priority: 100};

exports.handler = function(request, response, state) {
  var filter = state.queryParameters.filter || "";
  try {
    var titles = state.wiki.filterTiddlers(filter);
    if (Array.isArray(titles) && typeof titles[0] === "string" && /^Filter error:/.test(titles[0])) {
      response.writeHead(400, {"Content-Type": "application/json"});
      return response.end(JSON.stringify({error: titles[0]}));
    }
    response.writeHead(200, {"Content-Type": "application/json"});
    response.end(JSON.stringify(titles));
  } catch(e) {
    response.writeHead(400, {"Content-Type": "application/json"});
    response.end(JSON.stringify({error: e.message || String(e)}));
  }
};
