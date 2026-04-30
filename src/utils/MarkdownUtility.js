// Lightweight markdown parser used by the plan notes mini-renderer. Avoids
// pulling a full markdown library — handles only the subset we need: headings,
// paragraphs, blockquotes, horizontal rules, tables, ordered / unordered /
// task lists with nesting, and inline bold / italic / strikethrough / code /
// links.

/**
 * Inline token pattern, scanned greedily left-to-right. Order matters: longer
 * delimiters first so `**bold**` doesn't get eaten by the single-asterisk italic.
 */
export const MARKDOWN_INLINE_PATTERN =
    /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[([^\]]+)\]\(([^)]+)\))/

const LIST_ITEM_PATTERN = /^(\s*)([-*+]|\d+\.)\s+(.*)$/
const TASK_ITEM_PATTERN = /^\[( |x|X)\]\s+(.*)$/
const HORIZONTAL_RULE_PATTERN = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/
const BLOCKQUOTE_PATTERN = /^\s*>\s?/
const TABLE_SEPARATOR_PATTERN = /^\s*\|?[\s:|-]+\|?\s*$/
const MAX_HEADING_LEVEL = 3

/** Tokenise a single line of inline markdown into ordered token records. */
export function tokenizeMarkdownInline(text) {
    const tokens = []
    let remaining = text
    while (remaining.length > 0) {
        const match = remaining.match(MARKDOWN_INLINE_PATTERN)
        if (!match) {
            tokens.push({ type: 'text', value: remaining })
            break
        }
        const { index } = match
        if (index > 0) tokens.push({ type: 'text', value: remaining.slice(0, index) })
        const token = match[0]
        if (token.startsWith('**') || token.startsWith('__')) {
            tokens.push({ type: 'strong', value: token.slice(2, -2) })
        } else if (token.startsWith('~~')) {
            tokens.push({ type: 'strike', value: token.slice(2, -2) })
        } else if (token.startsWith('`')) {
            tokens.push({ type: 'code', value: token.slice(1, -1) })
        } else if (token.startsWith('[')) {
            tokens.push({ href: match[3], label: match[2], type: 'link' })
        } else {
            tokens.push({ type: 'em', value: token.slice(1, -1) })
        }
        remaining = remaining.slice(index + token.length)
    }
    return tokens
}

const splitTableRow = (line) =>
    line
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((cell) => cell.trim())

/**
 * Parse markdown source into a block tree consumable by `MarkdownView`.
 * Supports headings (h1–h3), paragraphs, blockquotes, horizontal rules,
 * tables, and nested ordered / unordered / task lists.
 */
export function parseMarkdownBlocks(source) {
    const lines = (source || '').split(/\r?\n/)
    const blocks = []
    const cursor = { i: 0 }

    const parseListItems = (baseIndent, ordered) => {
        const items = []
        while (cursor.i < lines.length) {
            const line = lines[cursor.i]
            if (!line.trim()) {
                const next = lines[cursor.i + 1]
                const nextMatch = next?.match(LIST_ITEM_PATTERN)
                if (!next || !nextMatch || nextMatch[1].length < baseIndent) break
                cursor.i++
                continue
            }
            const match = line.match(LIST_ITEM_PATTERN)
            if (!match) break
            const indent = match[1].length
            const isOrdered = /\d+\./.test(match[2])
            if (indent < baseIndent) break
            if (indent > baseIndent) {
                const child = parseListItems(indent, isOrdered)
                if (items.length > 0) items[items.length - 1].children.push(child)
                continue
            }
            if (isOrdered !== ordered) break
            let content = match[3]
            let task = null
            const taskMatch = content.match(TASK_ITEM_PATTERN)
            if (taskMatch) {
                task = taskMatch[1].toLowerCase() === 'x'
                content = taskMatch[2]
            }
            items.push({ children: [], content, task })
            cursor.i++
        }
        return { items, ordered, type: 'list' }
    }

    while (cursor.i < lines.length) {
        const line = lines[cursor.i]
        if (!line.trim()) {
            cursor.i++
            continue
        }
        if (HORIZONTAL_RULE_PATTERN.test(line)) {
            blocks.push({ type: 'hr' })
            cursor.i++
            continue
        }
        const headingMatch = line.match(HEADING_PATTERN)
        if (headingMatch) {
            blocks.push({
                level: Math.min(MAX_HEADING_LEVEL, headingMatch[1].length),
                text: headingMatch[2].trim(),
                type: 'heading'
            })
            cursor.i++
            continue
        }
        if (BLOCKQUOTE_PATTERN.test(line)) {
            const quoted = []
            while (cursor.i < lines.length && BLOCKQUOTE_PATTERN.test(lines[cursor.i])) {
                quoted.push(lines[cursor.i].replace(BLOCKQUOTE_PATTERN, ''))
                cursor.i++
            }
            blocks.push({ text: quoted.join('\n').trim(), type: 'blockquote' })
            continue
        }
        if (line.includes('|') && cursor.i + 1 < lines.length && TABLE_SEPARATOR_PATTERN.test(lines[cursor.i + 1])) {
            const header = splitTableRow(line)
            cursor.i += 2
            const rows = []
            while (cursor.i < lines.length && lines[cursor.i].includes('|')) {
                rows.push(splitTableRow(lines[cursor.i]))
                cursor.i++
            }
            blocks.push({ header, rows, type: 'table' })
            continue
        }
        const listMatch = line.match(LIST_ITEM_PATTERN)
        if (listMatch) {
            blocks.push(parseListItems(listMatch[1].length, /\d+\./.test(listMatch[2])))
            continue
        }
        const paragraphLines = []
        while (
            cursor.i < lines.length &&
            lines[cursor.i].trim() &&
            !/^(#{1,6}\s|\s*>\s?|\s*(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[cursor.i]) &&
            !LIST_ITEM_PATTERN.test(lines[cursor.i]) &&
            !(lines[cursor.i].includes('|') && TABLE_SEPARATOR_PATTERN.test(lines[cursor.i + 1] || ''))
        ) {
            paragraphLines.push(lines[cursor.i])
            cursor.i++
        }
        if (paragraphLines.length > 0) blocks.push({ text: paragraphLines.join(' ').trim(), type: 'paragraph' })
    }
    return blocks
}
