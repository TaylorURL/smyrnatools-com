import React, { useEffect, useMemo, useRef, useState } from 'react'

import { AIService } from '../../../services/AIService'

const FORMAT_DEBOUNCE_MS = 1500

/* ── Markdown renderer ───────────────────────────────────────────────────── */

/**
 * Inline token pattern, scanned greedily left-to-right. Order matters: longer
 * delimiters first so `**bold**` doesn't get eaten by the single-asterisk italic.
 */
const INLINE_PATTERN =
    /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[([^\]]+)\]\(([^)]+)\))/

const renderInline = (text) => {
    const nodes = []
    let remaining = text
    let key = 0
    while (remaining.length > 0) {
        const match = remaining.match(INLINE_PATTERN)
        if (!match) {
            nodes.push(<span key={key++}>{remaining}</span>)
            break
        }
        const { index } = match
        if (index > 0) nodes.push(<span key={key++}>{remaining.slice(0, index)}</span>)
        const token = match[0]
        if (token.startsWith('**') || token.startsWith('__')) {
            nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
        } else if (token.startsWith('~~')) {
            nodes.push(
                <span key={key++} style={{ textDecoration: 'line-through', opacity: 0.75 }}>
                    {token.slice(2, -2)}
                </span>
            )
        } else if (token.startsWith('`')) {
            nodes.push(
                <code
                    key={key++}
                    className="px-1.5 py-0.5 rounded text-[12px] font-mono"
                    style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)'
                    }}
                >
                    {token.slice(1, -1)}
                </code>
            )
        } else if (token.startsWith('[')) {
            const label = match[2]
            const href = match[3]
            nodes.push(
                <a
                    key={key++}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold"
                    style={{ color: 'var(--accent, #1e3a5f)' }}
                >
                    {label}
                </a>
            )
        } else {
            nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
        }
        remaining = remaining.slice(index + token.length)
    }
    return nodes
}

const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+(.*)$/
const TASK_ITEM = /^\[( |x|X)\]\s+(.*)$/

/**
 * Parse a markdown source into a block tree. Supports headings (h1–h3),
 * paragraphs, blockquotes, horizontal rules, tables, and nested ordered /
 * unordered / task lists. Inline formatting is applied at render time.
 */
const parseBlocks = (source) => {
    const lines = (source || '').split(/\r?\n/)
    const out = []
    let i = 0

    const parseListItems = (baseIndent, ordered) => {
        const items = []
        while (i < lines.length) {
            const line = lines[i]
            if (!line.trim()) {
                // blank line — peek next; if it's another list item at the same indent, continue
                const next = lines[i + 1]
                const nextMatch = next?.match(LIST_ITEM)
                if (!next || !nextMatch || nextMatch[1].length < baseIndent) break
                i++
                continue
            }
            const match = line.match(LIST_ITEM)
            if (!match) break
            const indent = match[1].length
            const marker = match[2]
            const isOrdered = /\d+\./.test(marker)
            if (indent < baseIndent) break
            if (indent > baseIndent) {
                // nested list belongs to the previous item
                const child = parseListItems(indent, isOrdered)
                if (items.length > 0) items[items.length - 1].children.push(child)
                continue
            }
            if (isOrdered !== ordered) break
            let content = match[3]
            let task = null
            const taskMatch = content.match(TASK_ITEM)
            if (taskMatch) {
                task = taskMatch[1].toLowerCase() === 'x'
                content = taskMatch[2]
            }
            items.push({ children: [], content, task })
            i++
        }
        return { items, ordered, type: 'list' }
    }

    while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) {
            i++
            continue
        }
        // Horizontal rule
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            out.push({ type: 'hr' })
            i++
            continue
        }
        // Headings
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
        if (headingMatch) {
            out.push({ level: Math.min(3, headingMatch[1].length), text: headingMatch[2].trim(), type: 'heading' })
            i++
            continue
        }
        // Blockquote (consecutive `> ` lines)
        if (/^\s*>\s?/.test(line)) {
            const quoted = []
            while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                quoted.push(lines[i].replace(/^\s*>\s?/, ''))
                i++
            }
            out.push({ text: quoted.join('\n').trim(), type: 'blockquote' })
            continue
        }
        // Table (header row + separator row + body rows)
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
            const headerCells = line
                .replace(/^\s*\|/, '')
                .replace(/\|\s*$/, '')
                .split('|')
                .map((c) => c.trim())
            i += 2
            const rows = []
            while (i < lines.length && lines[i].includes('|')) {
                const cells = lines[i]
                    .replace(/^\s*\|/, '')
                    .replace(/\|\s*$/, '')
                    .split('|')
                    .map((c) => c.trim())
                rows.push(cells)
                i++
            }
            out.push({ header: headerCells, rows, type: 'table' })
            continue
        }
        // Lists
        const listMatch = line.match(LIST_ITEM)
        if (listMatch) {
            const indent = listMatch[1].length
            const ordered = /\d+\./.test(listMatch[2])
            out.push(parseListItems(indent, ordered))
            continue
        }
        // Paragraph (collect subsequent non-block lines)
        const paragraphLines = []
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^(#{1,6}\s|\s*>\s?|\s*(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i]) &&
            !LIST_ITEM.test(lines[i]) &&
            !(lines[i].includes('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || ''))
        ) {
            paragraphLines.push(lines[i])
            i++
        }
        if (paragraphLines.length > 0) out.push({ text: paragraphLines.join(' ').trim(), type: 'paragraph' })
    }
    return out
}

function ListBlock({ block, depth = 0 }) {
    const Tag = block.ordered ? 'ol' : 'ul'
    const listClass = block.ordered ? 'list-decimal' : 'list-disc'
    return (
        <Tag
            className={`${listClass} pl-5 flex flex-col gap-1 ${depth > 0 ? 'mt-1' : ''} marker:text-[var(--text-tertiary)]`}
        >
            {block.items.map((item, idx) => (
                <li key={idx} className={item.task != null ? 'list-none -ml-5' : ''}>
                    {item.task != null ? (
                        <label className="flex items-start gap-2 cursor-default">
                            <span
                                className="mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0"
                                style={{
                                    background: item.task ? 'var(--accent, #1e3a5f)' : 'var(--bg-primary)',
                                    border: `1.5px solid ${item.task ? 'var(--accent, #1e3a5f)' : 'var(--border-medium)'}`,
                                    color: '#fff'
                                }}
                            >
                                {item.task && <i className="fas fa-check text-[9px]" />}
                            </span>
                            <span
                                style={{
                                    color: item.task ? 'var(--text-secondary)' : 'var(--text-primary)',
                                    textDecoration: item.task ? 'line-through' : 'none'
                                }}
                            >
                                {renderInline(item.content)}
                            </span>
                        </label>
                    ) : (
                        <span>{renderInline(item.content)}</span>
                    )}
                    {item.children.map((child, childIdx) => (
                        <ListBlock key={childIdx} block={child} depth={depth + 1} />
                    ))}
                </li>
            ))}
        </Tag>
    )
}

const HEADING_STYLES = {
    1: {
        className: 'text-[18px] font-bold mt-1 pb-1 border-b',
        extraStyle: { borderColor: 'var(--border-light)' }
    },
    2: {
        className: 'text-[15px] font-bold uppercase tracking-wider mt-2',
        extraStyle: {}
    },
    3: {
        className: 'text-[13px] font-bold uppercase tracking-wider mt-1',
        extraStyle: {}
    }
}

function MiniMarkdown({ source }) {
    const blocks = useMemo(() => parseBlocks(source), [source])
    return (
        <div className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {blocks.map((block, idx) => {
                if (block.type === 'heading') {
                    const style = HEADING_STYLES[block.level] || HEADING_STYLES[3]
                    const Tag = `h${block.level + 2}`
                    return (
                        <Tag
                            key={idx}
                            className={style.className}
                            style={{
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-heading)',
                                ...style.extraStyle
                            }}
                        >
                            {renderInline(block.text)}
                        </Tag>
                    )
                }
                if (block.type === 'hr') {
                    return (
                        <hr
                            key={idx}
                            className="my-2 border-0 border-t"
                            style={{ borderColor: 'var(--border-light)' }}
                        />
                    )
                }
                if (block.type === 'blockquote') {
                    return (
                        <blockquote
                            key={idx}
                            className="pl-3 py-2 pr-3 rounded-r-md border-l-4 italic"
                            style={{
                                background: 'var(--bg-tertiary)',
                                borderColor: 'var(--accent, #1e3a5f)',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            {block.text.split('\n').map((line, lineIdx) => (
                                <div key={lineIdx}>{renderInline(line)}</div>
                            ))}
                        </blockquote>
                    )
                }
                if (block.type === 'table') {
                    return (
                        <div
                            key={idx}
                            className="overflow-x-auto rounded-lg"
                            style={{ border: '1px solid var(--border-light)' }}
                        >
                            <table className="w-full text-[12.5px]">
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        {block.header.map((cell, cellIdx) => (
                                            <th
                                                key={cellIdx}
                                                className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[11px]"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {renderInline(cell)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {block.rows.map((row, rowIdx) => (
                                        <tr
                                            key={rowIdx}
                                            style={{
                                                borderTop: '1px solid var(--border-light)'
                                            }}
                                        >
                                            {row.map((cell, cellIdx) => (
                                                <td
                                                    key={cellIdx}
                                                    className="px-3 py-2 align-top"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {renderInline(cell)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
                if (block.type === 'list') {
                    return <ListBlock key={idx} block={block} />
                }
                return <p key={idx}>{renderInline(block.text)}</p>
            })}
        </div>
    )
}

/* ── Notes section ───────────────────────────────────────────────────────── */

/**
 * Notes editor with AI-formatted read view. Raw notes are always stored as
 * the author typed them. When read-only, we show a Grok-polished markdown
 * rendering; the formatted string + the source it came from are cached on
 * the plan's `_meta` blob so we don't re-query Grok on every render.
 */
function PlanNotesSection({
    accentColor,
    cachedFormatted,
    cachedSource,
    canEdit = true,
    notes,
    onFormattedChange,
    setNotes
}) {
    const trimmed = (notes || '').trim()
    const cacheMatches = cachedSource === notes && !!cachedFormatted
    const [mode, setMode] = useState(() => (trimmed ? 'view' : 'edit'))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const debounceRef = useRef(null)
    const activeSourceRef = useRef(null)

    // Auto-switch to edit when the plan has no notes so the user sees the textarea.
    useEffect(() => {
        if (!trimmed) setMode('edit')
    }, [trimmed])

    // When the raw notes diverge from what's cached, schedule a debounced
    // AI format so we don't burn API calls on every keystroke.
    useEffect(() => {
        if (!trimmed) {
            if (cachedFormatted || cachedSource) onFormattedChange?.(null, null)
            return undefined
        }
        if (cacheMatches) return undefined
        window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(async () => {
            const source = notes
            activeSourceRef.current = source
            setLoading(true)
            setError(null)
            try {
                const formatted = await AIService.formatPlanNotes(source)
                if (activeSourceRef.current !== source) return
                if (formatted) onFormattedChange?.(formatted, source)
                else setError('Could not format notes — showing raw text.')
            } catch {
                if (activeSourceRef.current === source) setError('Could not format notes — showing raw text.')
            } finally {
                if (activeSourceRef.current === source) setLoading(false)
            }
        }, FORMAT_DEBOUNCE_MS)
        return () => window.clearTimeout(debounceRef.current)
    }, [notes, trimmed, cacheMatches, cachedFormatted, cachedSource, onFormattedChange])

    const displaySource = cacheMatches ? cachedFormatted : notes

    return (
        <div className="flex flex-col gap-3">
            {(mode === 'edit' || (mode === 'view' && loading)) && (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {mode === 'view' && loading && (
                        <>
                            <i
                                className="fas fa-wand-magic-sparkles fa-fade text-[11px]"
                                style={{ color: accentColor }}
                            />
                            <span>Formatting with AI…</span>
                        </>
                    )}
                    {mode === 'edit' && (
                        <>
                            <i className="fas fa-pen-to-square text-[10px]" />
                            <span>Editing raw notes</span>
                        </>
                    )}
                </div>
            )}

            {mode === 'edit' && (
                <textarea
                    value={notes || ''}
                    onChange={(e) => setNotes?.(e.target.value)}
                    placeholder="Anything special about today — weather, plant closures, special events, etc."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)'
                    }}
                />
            )}

            {mode === 'view' && !trimmed && (
                <div
                    className="rounded-lg p-4 text-[12.5px] italic text-center"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                >
                    No notes yet. Click <b>Edit</b> to add context for today&apos;s plan.
                </div>
            )}

            {mode === 'view' && trimmed && (
                <div
                    className="rounded-lg px-4 py-3.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <MiniMarkdown source={displaySource} />
                    {error && (
                        <div className="text-[11px] mt-2" style={{ color: '#b45309' }}>
                            <i className="fas fa-triangle-exclamation mr-1" />
                            {error}
                        </div>
                    )}
                </div>
            )}

            {canEdit && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setMode((prev) => (prev === 'edit' ? 'view' : 'edit'))}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1.5"
                        style={{
                            background: mode === 'edit' ? accentColor : 'var(--bg-secondary)',
                            color: mode === 'edit' ? '#fff' : 'var(--text-primary)'
                        }}
                    >
                        <i className={`fas ${mode === 'edit' ? 'fa-check' : 'fa-pen'} text-[10px]`} />
                        {mode === 'edit' ? 'Done' : 'Edit'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default PlanNotesSection
