/*\
title: $:/plugins/cdaven/markdown-export/md-tiddler.js
type: application/javascript
module-type: macro

Macro to output a single tiddler to Markdown, e.g. for use with a template, possibly from the command line.
\*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.params = exports.name = void 0;
exports.run = run;
const render_helpers_js_1 = require("./render-helpers.js");
const render_js_1 = require("./render.js");
exports.name = "mdtiddler";
exports.params = [
    {
        name: "title",
        default: ""
    },
];
/** The macro entrypoint */
function run(title = "") {
    title = title || this.getVariable("currentTiddler");
    if (!title) {
        console.warn("No title specified, exiting");
        return "";
    }
    if (title === "$:/plugins/cdaven/markdown-export/md-tiddler") {
        // TODO: This avoids a Javascript error, but there should be a better solution
        console.warn("Shouldn't render itself...?");
        return "";
    }
    const exportTarget = (0, render_helpers_js_1.getExportTarget)();
    const twRenderer = new render_js_1.TiddlyWikiRenderer($tw);
    const renderer = new render_js_1.MarkdownRenderer(twRenderer, exportTarget);
    return renderer.renderTiddler(title) || "";
}
;
