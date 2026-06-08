/*\
title: $:/plugins/cdaven/markdown-export/zip-archive.js
type: application/javascript
module-type: library
\*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZipArchive = void 0;
class ZipArchive {
    constructor(title) {
        this.title = title;
        this.archive = null;
        const JSZip = desire("$:/plugins/tiddlywiki/jszip/jszip.js");
        if (JSZip !== undefined) {
            this.archive = new JSZip();
        }
    }
    isEnabled() {
        return this.archive != null;
    }
    /** Load archive from a tiddler */
    load() {
        if (!this.isEnabled()) {
            console.error("JSZip plugin probably missing");
            return;
        }
        const tiddler = $tw.wiki.getTiddler(this.title);
        if (tiddler && tiddler.fields.type === "application/zip") {
            try {
                this.archive.load(tiddler.fields.text, { base64: true });
            }
            catch (e) {
                console.error("JSZip error: " + e);
            }
        }
        else {
            console.warn("Missing tiddler or wrong type: ", this.title);
        }
    }
    /** Save archive to a tiddler */
    save() {
        if (!this.isEnabled()) {
            console.error("JSZip plugin probably missing");
            return;
        }
        $tw.wiki.addTiddler({
            title: this.title,
            type: "application/zip",
            text: this.toBase64()
        });
    }
    /** Add file to archive */
    addFile(filename, contents) {
        if (!this.isEnabled()) {
            console.error("JSZip plugin probably missing");
            return;
        }
        this.archive.file(filename, contents);
    }
    /** Render archive with Base64-encoding */
    toBase64() {
        return this.archive.generate({ type: "base64" });
    }
}
exports.ZipArchive = ZipArchive;
/** Like require, but doesn't throw errors when module is missing */
function desire(moduleName) {
    return $tw.modules.titles[moduleName] ? require(moduleName) : undefined;
}
