/*\
title: $:/plugins/cdaven/markdown-export/render.js
type: application/javascript
module-type: library
\*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownRenderer = exports.TiddlyWikiRenderer = void 0;
const render_helpers_js_1 = require("./render-helpers.js");
const render_rules_js_1 = require("./render-rules.js");
// TODO: Look at/think about https://tiddlywiki.com/static/Creating%2520a%2520custom%2520export%2520format.html
class TiddlyWikiRenderer {
    constructor(tw) {
        this.tw = tw;
        // Imports built-in macros and custom macros in the tiddler, including the $:/tags/Macro/View tag
        const macroImport = "[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!has[draft.of]] [all[shadows+tiddlers]tag[$:/tags/Macro/View]!has[draft.of]]";
        this.widgetOptions = {
            document: $tw.fakeDocument,
            mode: "block",
            importVariables: macroImport,
            recursionMarker: "yes",
            variables: {
                currentTiddler: null
            }
        };
    }
    /** Let TiddlyWiki parse the tiddler text and build a widget tree */
    renderWidgetTree(title) {
        this.widgetOptions.variables.currentTiddler = title;
        const widgetNode = this.tw.wiki.makeTranscludeWidget(title, this.widgetOptions);
        const container = this.tw.fakeDocument.createElement("div");
        widgetNode.render(container, null);
        // Get the first-level nodes in the tree
        return container.children[0].children;
    }
    /** "Wikify" a WikiText string */
    wikifyText(text) {
        return this.tw.wiki.renderText("text/plain", "text/vnd.tiddlywiki", text);
    }
    /** Get tiddler fields */
    getFields(title) {
        const tiddler = this.tw.wiki.getTiddler(title);
        if (tiddler == null) {
            console.warn("Found no such tiddler", title);
            return null;
        }
        // Clone tiddler fields
        return Object.assign({}, tiddler.fields);
    }
}
exports.TiddlyWikiRenderer = TiddlyWikiRenderer;
class MarkdownRenderer {
    constructor(tw, target) {
        this.tw = tw;
        this.tw = tw;
        this.rules = (0, render_rules_js_1.getDefaultRules)(this);
        this.rules["meta"] = (0, render_rules_js_1.getMetaRule)(this, target);
        this.rules["a"] = (0, render_rules_js_1.getAnchorRule)(this, target);
    }
    renderTiddler(title) {
        if (this.rules == null) {
            console.warn("Cannot render tiddler without rules");
            return null;
        }
        const nodes = this.tw.renderWidgetTree(title);
        this.tiddlerFields = this.tw.getFields(title);
        if (this.tiddlerFields == null) {
            console.warn(`Tiddler [[${title}]] doesn't seem to exist`);
            return null;
        }
        let renderedNodes = "";
        for (const node of nodes) {
            const nodeMarkup = this.renderNode(node);
            if (nodeMarkup != null) {
                renderedNodes += nodeMarkup;
            }
        }
        // Prepend meta node last, in case attributes have changed during rendering
        const metaNode = {
            tag: "meta",
            nodeType: render_helpers_js_1.Node.ELEMENT_NODE,
            attributes: this.tiddlerFields,
            children: []
        };
        let markup = this.renderNode(metaNode) + renderedNodes;
        return markup.replace(/\n\n\n+/g, "\n\n").trim() + "\n";
    }
    /** Get raw text from node */
    getNodeText(node) {
        if ((0, render_helpers_js_1.isTextNode)(node)) {
            return node.textContent || "";
        }
        else if ((0, render_helpers_js_1.isDomNode)(node)) {
            return node.children.map(child => this.getNodeText(child)).join(" ");
        }
        else {
            return null;
        }
    }
    /** Render specified node to Markdown */
    renderNode(node) {
        if ((0, render_helpers_js_1.isTextNode)(node)) {
            return node.textContent || "";
        }
        else if ((0, render_helpers_js_1.isDomNode)(node)) {
            // Render markup from children depth-first
            const innerMarkup = node.children.map(child => this.renderNode(child)).join("");
            return this.executeRule(node, innerMarkup);
        }
        else {
            console.error("Unknown type of node", node);
            throw new Error("Unknown type of node");
        }
    }
    /** Get next sibling of specified node */
    getNextNode(node) {
        if (node.parentNode == null) {
            return null;
        }
        let isNext = false;
        for (const n of node.parentNode.children) {
            if (isNext) {
                return n;
            }
            else if (n === node) {
                isNext = true;
            }
        }
        return null;
    }
    isFirstChild(node) {
        if (node.parentNode == null) {
            // Define all root elements as the first and last children
            return true;
        }
        return node == node.parentNode.children[0];
    }
    isLastChild(node) {
        if (node.parentNode == null) {
            // Define all root elements as the first and last children
            return true;
        }
        return node == node.parentNode.children[node.parentNode.children.length - 1];
    }
    setRule(tag, renderer) {
        this.rules[tag] = renderer;
    }
    executeRule(node, innerMarkup) {
        if (node.tag in this.rules) {
            return this.rules[node.tag](node, innerMarkup);
        }
        else {
            // Use wildcard rule when tag doesn't have its own rule
            return this.rules["*"](node, innerMarkup);
        }
    }
}
exports.MarkdownRenderer = MarkdownRenderer;
