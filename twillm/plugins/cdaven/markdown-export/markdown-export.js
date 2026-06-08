/*\
title: $:/plugins/cdaven/markdown-export/markdown-export.js
type: application/javascript
module-type: macro
\*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.params = exports.name = void 0;
exports.run = run;
const render_helpers_js_1 = require("./render-helpers.js");
const render_js_1 = require("./render.js");
const zip_archive_js_1 = require("./zip-archive.js");
exports.name = "markdown-export";
exports.params = [
    {
        name: "filter",
        default: ""
    },
    {
        name: "note",
        default: ""
    },
    {
        name: "version",
        default: ""
    },
    {
        name: "extension",
        default: ".md"
    },
];
/** LaTeX page break, recognized by Pandoc */
const pageBreak = "\n\n\\newpage\n\n";
/** Title of temporary zip tiddler */
const tempZipTiddler = "$:/temp/cdaven/markdown.zip";
/** The macro entrypoint */
function run(filter = "", note = "", version = "", extension = ".md") {
    console.log(`Running Markdown Export ${version} with filter ${filter} and extension ${extension}`);
    if (!filter) {
        console.warn("No filter specified, exiting");
        return "";
    }
    const createArchive = extension == ".zip";
    const exportTarget = (0, render_helpers_js_1.getExportTarget)();
    const twRenderer = new render_js_1.TiddlyWikiRenderer($tw);
    const renderer = new render_js_1.MarkdownRenderer(twRenderer, exportTarget);
    let markdownTiddlers = [];
    for (const title of $tw.wiki.filterTiddlers(filter)) {
        let markdownTiddler = null;
        try {
            markdownTiddler = renderer.renderTiddler(title);
        }
        catch (err) {
            console.error(err);
        }
        if (markdownTiddler) {
            markdownTiddlers.push({
                title: title,
                text: markdownTiddler.trim()
            });
        }
    }
    if (createArchive) {
        let zipArchive = new zip_archive_js_1.ZipArchive(tempZipTiddler);
        if (!zipArchive.isEnabled()) {
            console.error("JSZip plugin is required for generating zip archives");
            return "";
        }
        for (const mdTiddler of markdownTiddlers) {
            zipArchive.addFile((0, render_helpers_js_1.titleToFilename)(mdTiddler.title, exportTarget) + ".md", mdTiddler.text);
        }
        return zipArchive.toBase64();
    }
    else {
        return markdownTiddlers.map(t => t.text).join(pageBreak);
    }
}
;
