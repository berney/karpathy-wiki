/*\
title: $:/plugins/cdaven/markdown-export/render-rules.js
type: application/javascript
module-type: library
\*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultRules = getDefaultRules;
exports.getMetaRule = getMetaRule;
exports.getAnchorRule = getAnchorRule;
const render_helpers_1 = require("./render-helpers");
/** Get rules for rendering a TiddlyWiki widget tree consisting of HTML-ish elements/nodes */
function getDefaultRules(renderer) {
    let rules = {
        "p": (node, im) => {
            var _a;
            if (((_a = node.parentNode) === null || _a === void 0 ? void 0 : _a.tag) === "li") {
                const newlines = renderer.isLastChild(node)
                    ? "\n" // End with one newline for the last child
                    : "\n\n"; // End with two newlines between paragraphs
                if (node.parentNode.children[0] == node) {
                    // The first <p> inside a <li> is rendered as inline text
                    return `${im.trim()}${newlines}`;
                }
                else {
                    // Subsequent <p> inside a <li> is rendered with indentation
                    return `    ${im.trim()}${newlines}`;
                }
            }
            else {
                // Add newlines after paragraphs
                return `${im.trim()}\n\n`;
            }
        },
        "em": (_, im) => `*${im}*`,
        "strong": (_, im) => `**${im}**`,
        "u": (_, im) => `<u>${im}</u>`,
        "strike": (_, im) => `~~${im}~~`,
        // Force line-break
        "br": (node) => {
            const nextNode = renderer.getNextNode(node);
            if (nextNode == null || ((0, render_helpers_1.isTextNode)(nextNode) && nextNode.textContent === "\n")) {
                // If the next line is blank, shouldn't end with a \
                return "\n";
            }
            else {
                return "\\\n";
            }
        },
        "hr": () => `---\n\n`,
        "label": (_, im) => im,
        // Pandoc 3.0 supports highlighted text using ==, if you specify --from markdown+mark
        "mark": (_, im) => `==${im}==`,
        "span": (node, im) => {
            const katexStart = '<annotation encoding="application/x-tex">';
            if (node.rawHTML && node.rawHTML.indexOf(katexStart) !== -1) {
                let mathEq = node.rawHTML.substring(node.rawHTML.indexOf(katexStart) + katexStart.length);
                // The raw HTML is encoded here, but we need to decode at least LaTeX-specific characters such as <, >, &
                mathEq = (0, render_helpers_1.latex_htmldecode)(mathEq.substring(0, mathEq.indexOf('</annotation>')));
                if ((0, render_helpers_1.isOnlyNodeInBlock)(node) || (mathEq.startsWith("\n") && mathEq.endsWith("\n"))) {
                    // As a block equation
                    return `$$${(0, render_helpers_1.trimEnd)(mathEq)}\n$$\n\n`;
                }
                else {
                    // As an inline equation
                    return `$${mathEq}$`;
                }
            }
            else {
                return im;
            }
        },
        "sub": (_, im) => `~${im.replace(/ /g, "\\ ")}~`,
        "sup": (_, im) => `^${im.replace(/ /g, "\\ ")}^`,
        "h1": (_, im) => `# ${im}\n\n`,
        "h2": (_, im) => `## ${im}\n\n`,
        "h3": (_, im) => `### ${im}\n\n`,
        "h4": (_, im) => `#### ${im}\n\n`,
        // Definition lists
        "dl": (_, im) => `${im.trim()}\n\n`,
        "dt": (_, im) => `${im}\n`,
        "dd": (_, im) => ` ~ ${im}\n\n`,
        // Code blocks
        "pre": (node, im) => {
            if (node.children.every(child => (0, render_helpers_1.isDomNode)(child) && child.tag === "code")) {
                // <pre> with nested <code> elements, just pass through
                return im;
            }
            else {
                // <pre> without nested <code>
                return `\`\`\`\n${im.trim()}\n\`\`\`\n\n`;
            }
        },
        "code": (node, im) => {
            var _a, _b, _c;
            if (((_a = node.parentNode) === null || _a === void 0 ? void 0 : _a.tag) === "pre") {
                // <code> nested inside <pre>
                // The Highlight plugin puts the language in the "class" attribute
                let classRx = (_c = (_b = node.attributes) === null || _b === void 0 ? void 0 : _b.class) === null || _c === void 0 ? void 0 : _c.match(/^(.+) hljs$/);
                if (classRx) {
                    const lang = classRx[1];
                    return `\`\`\`${lang}\n${im.trim()}\n\`\`\`\n\n`;
                }
                else {
                    return `\`\`\`\n${im.trim()}\n\`\`\`\n\n`;
                }
            }
            else {
                // As inline code
                return `\`${im}\``;
            }
        },
        "blockquote": (node, im) => {
            var _a;
            let indentation = "";
            if (((_a = node.parentNode) === null || _a === void 0 ? void 0 : _a.tag) === "li") {
                indentation = "    ";
            }
            // Insert "> " at the beginning of each line
            const prefix = `${indentation}> `;
            return `${prefix}${im.trim().replace(/\n/g, `\n${prefix}`)}\n\n`;
        },
        "cite": (_, im) => {
            return `<cite>${im}</cite>`;
        },
        // Lists
        "ul": (node, im) => {
            var _a;
            if (((_a = node.parentNode) === null || _a === void 0 ? void 0 : _a.tag) === "li") {
                // Nested list, should not end with double newlines
                return `\n${im}`;
            }
            else {
                return `${im.trim()}\n\n`;
            }
        },
        "li": (node, im) => {
            let curNode = node.parentNode;
            if (curNode == null) {
                console.error("Found <li> without parent");
                return null;
            }
            const listType = curNode.tag === "ul" ? "*" : "1.";
            const listTags = ["ul", "ol", "li"];
            let depth = -1;
            // Traverse up the path to count nesting levels
            while (curNode && listTags.indexOf(curNode.tag) !== -1) {
                if (curNode.tag !== "li") {
                    depth++;
                }
                curNode = curNode.parentNode;
            }
            const indent = "    ".repeat(depth);
            return `${indent}${listType} ${im.trim()}\n`;
        },
        "input": (node) => {
            var _a, _b;
            if (((_a = node.attributes) === null || _a === void 0 ? void 0 : _a.type) === "checkbox") {
                if ((_b = node.attributes) === null || _b === void 0 ? void 0 : _b.checked) {
                    return "[x]";
                }
                else {
                    return "[ ]";
                }
            }
            else {
                console.warn("Unsupported input node type", node);
                return null;
            }
        },
        "img": (node) => {
            var _a, _b;
            // TODO: If in zip archive mode, and the image is "local",
            // create a Markdown image link instead of inlining
            let caption = ((_a = node.attributes) === null || _a === void 0 ? void 0 : _a.title) || "";
            let src = ((_b = node.attributes) === null || _b === void 0 ? void 0 : _b.src) || "";
            const svgPrefix = "data:image/svg+xml,";
            if (src.startsWith(svgPrefix)) {
                // SVGs should also be Base64-encoded for compatibility
                src = svgPrefix.replace("svg+xml,", "svg+xml;base64,") +
                    (0, render_helpers_1.btoa)(decodeURIComponent(src.substring(svgPrefix.length)));
            }
            return `![${caption}](${src})`;
        },
        "i": (node, im) => {
            var _a;
            if ((_a = node.attributes) === null || _a === void 0 ? void 0 : _a.class) {
                const classes = node.attributes.class.split(" ");
                if (im.trim().length === 0 && classes.some(c => c.startsWith("fa-"))) {
                    // Lazily render all FontAwesome icons as a replacement character
                    return "�";
                }
            }
            return null;
        },
        // Tables
        "table": (node) => {
            let tbody = null;
            for (const child of node.children) {
                if ((0, render_helpers_1.isDomNode)(child) && child.tag === "tbody") {
                    tbody = child;
                    break;
                }
            }
            if (tbody == null) {
                return null;
            }
            let thead = null;
            for (const child of node.children) {
                if ((0, render_helpers_1.isDomNode)(child) && child.tag === "thead") {
                    thead = child;
                    break;
                }
            }
            const justifyLeft = (s, w) => {
                const sLen = (s === null || s === void 0 ? void 0 : s.length) || 0;
                return s + ' '.repeat(w - sLen);
            };
            const justifyRight = (s, w) => {
                const sLen = (s === null || s === void 0 ? void 0 : s.length) || 0;
                return ' '.repeat(w - sLen) + s;
            };
            const center = (s, w) => {
                const sLen = (s === null || s === void 0 ? void 0 : s.length) || 0;
                const spacesLeft = Math.ceil((w - sLen) / 2);
                const spacesRight = w - sLen - spacesLeft;
                return ' '.repeat(spacesLeft) + s + ' '.repeat(spacesRight);
            };
            let grid = [];
            if (thead != null) {
                for (const row of thead.children) {
                    if ((0, render_helpers_1.isDomNode)(row) && row.tag === "tr") {
                        let cellsInCurrentRow = [];
                        for (const cell of row.children) {
                            if ((0, render_helpers_1.isDomNode)(cell)) {
                                cellsInCurrentRow.push({
                                    innerMarkup: renderer.renderNode(cell),
                                    header: cell.tag === "th",
                                    align: cell.attributes.align,
                                });
                            }
                        }
                        grid.push(cellsInCurrentRow);
                    }
                }
            }
            for (const row of tbody.children) {
                if ((0, render_helpers_1.isDomNode)(row) && row.tag === "tr") {
                    let cellsInCurrentRow = [];
                    for (const cell of row.children) {
                        if ((0, render_helpers_1.isDomNode)(cell)) {
                            cellsInCurrentRow.push({
                                innerMarkup: renderer.renderNode(cell),
                                header: cell.tag === "th",
                                align: cell.attributes.align,
                            });
                        }
                    }
                    if (cellsInCurrentRow.length > 0) {
                        grid.push(cellsInCurrentRow);
                    }
                }
            }
            let columnWidths = [];
            for (let i = 0; i < grid[0].length; i++) {
                // Check max length of each column's inner markup
                columnWidths.push(Math.max(...grid.map(row => { var _a; return ((_a = row[i].innerMarkup) === null || _a === void 0 ? void 0 : _a.length) || 0; })));
            }
            let tableMarkup = [];
            let isFirstRow = true;
            for (const row of grid) {
                let rowMarkup = [];
                for (const column in row) {
                    const cell = row[column];
                    const innerMarkup = cell.innerMarkup;
                    const columnWidth = columnWidths[column];
                    if (cell.align === "center") {
                        rowMarkup.push(center(innerMarkup, columnWidth));
                    }
                    else if (cell.align === "right") {
                        rowMarkup.push(justifyRight(innerMarkup, columnWidth));
                    }
                    else {
                        rowMarkup.push(justifyLeft(innerMarkup, columnWidth));
                    }
                }
                tableMarkup.push("| " + rowMarkup.join(" | ") + " |");
                if (isFirstRow) {
                    // Markdown requires the first row to be a header row
                    let rowMarkup = [];
                    for (const column in row) {
                        const columnWidth = columnWidths[column];
                        rowMarkup.push("-".repeat(columnWidth));
                    }
                    tableMarkup.push("|-" + rowMarkup.join("-|-") + "-|");
                    isFirstRow = false;
                }
            }
            return tableMarkup.join("\n") + "\n\n";
        },
        // The <tr> tag is handled by the <table> rule
        "tr": () => null,
        "td": (_, im) => im,
        "th": (_, im) => im,
        // Generic block element rule
        "block": (node, im) => {
            if (im.trim().length > 0) {
                return `<${node.tag}>${im.trim()}</${node.tag}>\n`;
            }
            else {
                return null;
            }
        },
        // Wildcard rule, catching all other inline elements
        "*": (node, im) => {
            if (im.trim().length > 0) {
                return `<${node.tag}>${im.trim()}</${node.tag}>`;
            }
            else {
                return null;
            }
        },
    };
    // Inherit identical rules
    rules["div"] = rules["p"];
    rules["ol"] = rules["ul"];
    // Generic block elements
    rules["address"] = rules["block"];
    rules["article"] = rules["block"];
    rules["aside"] = rules["block"];
    rules["details"] = rules["block"];
    rules["dialog"] = rules["block"];
    rules["fieldset"] = rules["block"];
    rules["figcaption"] = rules["block"];
    rules["figure"] = rules["block"];
    rules["footer"] = rules["block"];
    rules["form"] = rules["block"];
    rules["header"] = rules["block"];
    rules["hgroup"] = rules["block"];
    rules["main"] = rules["block"];
    rules["nav"] = rules["block"];
    rules["section"] = rules["block"];
    return rules;
}
/** Get "meta" rule for rendering frontmatter */
function getMetaRule(renderer, exportTarget) {
    return (node, im) => {
        const fields = node.attributes;
        const metadata = {
            title: fields.title,
            author: fields.author,
            date: fields.modified || fields.created,
            abstract: fields.description,
            tags: fields.tags,
            other: {},
        };
        for (const field in fields) {
            if (["text", "title", "author", "modified", "description", "tags", "type"].indexOf(field) !== -1)
                // Ignore full text and the fields already taken care of, plus "type"
                continue;
            metadata.other[field] = fields[field];
        }
        let frontMatter = "";
        if (exportTarget == "logseq") {
            // Logseq uses its own syntax: https://docs.logseq.com/#/page/properties
            let properties = [];
            if (metadata.title) {
                properties.push(`title:: ${metadata.title}`);
            }
            if (metadata.author) {
                properties.push(`author:: ${metadata.author}`);
            }
            if (metadata.date) {
                properties.push(`date:: ${(0, render_helpers_1.formatDate)(metadata.date)}`);
            }
            if (metadata.abstract) {
                properties.push(`abstract:: ${(0, render_helpers_1.formatLogseqPropertyValue)(metadata.abstract)}`);
            }
            if (metadata.tags && metadata.tags.length > 0) {
                properties.push(`tags:: ${metadata.tags.join(', ')}`);
            }
            for (const field in metadata.other) {
                // Remove all illegal characters from field/property names
                const fieldName = field.trim().replace(/\s+/g, "-").replace(/[^a-z0-9.*+!?$%&=<>_-]/gi, "");
                if (fieldName.length > 0) {
                    properties.push(`${fieldName}:: ${(0, render_helpers_1.formatLogseqPropertyValue)(metadata.other[field])}`);
                }
            }
            frontMatter = `${properties.join("\n")}\n\n`;
        }
        else {
            // Both Obsidian and Pandoc accepts YAML, but values need not be quoted
            let properties = [];
            if (metadata.title) {
                properties.push(`title: ${(0, render_helpers_1.formatYamlPropertyValue)(metadata.title)}`);
            }
            if (metadata.author) {
                properties.push(`author: ${(0, render_helpers_1.formatYamlPropertyValue)(metadata.author)}`);
            }
            if (metadata.date) {
                properties.push(`date: ${(0, render_helpers_1.formatDate)(metadata.date)}`);
            }
            if (metadata.abstract) {
                properties.push(`abstract: ${(0, render_helpers_1.formatYamlPropertyValue)(metadata.abstract)}`);
            }
            if (metadata.tags && metadata.tags.length > 0) {
                const tags = metadata.tags.map((t) => (0, render_helpers_1.formatYamlPropertyValue)(t, false));
                if (exportTarget == "pandoc") {
                    // Pandoc expects this in a "keywords" property
                    properties.push(`keywords: [${tags.join(', ')}]`);
                }
                else {
                    // Obsidian expects this in a "tags" property
                    properties.push(`tags: [${tags.join(', ')}]`);
                }
            }
            for (const field in metadata.other) {
                const fieldName = field.trim().replace(/\s+/g, "-").replace(/[\:]+$/, "");
                if (fieldName.length) {
                    properties.push(`${fieldName}: ${(0, render_helpers_1.formatYamlPropertyValue)(metadata.other[field])}`);
                }
            }
            frontMatter = `---\n${properties.join("\n")}\n---\n\n`;
        }
        if (exportTarget == "pandoc") {
            // Add h1 header (Logseq and Obsidian already shows the filename/title as header)
            frontMatter += `# ${metadata.title}\n\n`;
        }
        return frontMatter;
    };
}
/** Get "a" (anchor) rule for rendering links */
function getAnchorRule(renderer, exportTarget) {
    return (node, im) => {
        var _a;
        const href = (_a = node.attributes) === null || _a === void 0 ? void 0 : _a.href;
        if (href === null || href === void 0 ? void 0 : href.startsWith("#")) {
            // Remove leading # character and decode html entities à la TiddlyWiki
            const target = decodeURIComponent(href.substring(1));
            const alias = im;
            if (exportTarget == "pandoc") {
                // Use the common Markdown link syntax to a different file
                return `[${alias}](${(0, render_helpers_1.titleToFilename)(target, exportTarget)}.md)`;
            }
            else if (exportTarget == "logseq") {
                // Logseq links should include special characters that will be escaped
                // before looking up the corresponding filename
                if (target == alias) {
                    return `[[${target}]]`;
                }
                else {
                    // Logseq alias syntax
                    return `[${alias}]([[${target}]])`;
                }
            }
            else {
                if (target == alias) {
                    return `[[${(0, render_helpers_1.titleToFilename)(target, exportTarget)}]]`;
                }
                else {
                    // Obsidian and Zettlr alias syntax
                    return `[[${(0, render_helpers_1.titleToFilename)(target, exportTarget)}|${alias}]]`;
                }
            }
        }
        else if (im && im != href) {
            return `[${im}](${href})`;
        }
        else {
            return `<${href}>`;
        }
    };
}
