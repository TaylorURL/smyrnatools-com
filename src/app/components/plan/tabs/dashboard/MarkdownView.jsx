/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { parseMarkdownBlocks, tokenizeMarkdownInline } from '../../../../../utils/MarkdownUtility'

const HEADING_STYLES = {
    1: { className: 'text-[18px] font-bold mt-1 pb-1 border-b', extraStyle: { borderColor: 'var(--border-light)' } },
    2: { className: 'text-[15px] font-bold uppercase tracking-wider mt-2', extraStyle: {} },
    3: { className: 'text-[13px] font-bold uppercase tracking-wider mt-1', extraStyle: {} }
}

/** Render the inline-token stream produced by `tokenizeMarkdownInline`. */
function MarkdownInline({ text }) {
    const tokens = useMemo(() => tokenizeMarkdownInline(text), [text])
    return tokens.map((token, idx) => {
        if (token.type === 'strong') return <strong key={idx}>{token.value}</strong>
        if (token.type === 'em') return <em key={idx}>{token.value}</em>
        if (token.type === 'strike')
            return (
                <span className="opacity-75" key={idx} style={{ textDecoration: 'line-through' }}>
                    {token.value}
                </span>
            )
        if (token.type === 'code') return <InlineCode key={idx} text={token.value} />
        if (token.type === 'link') return <InlineLink key={idx} href={token.href} label={token.label} />
        return <span key={idx}>{token.value}</span>
    })
}

function InlineCode({ text }) {
    return (
        <code className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-bg-tertiary border border-border-light text-text-primary">
            {text}
        </code>
    )
}

function InlineLink({ href, label }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-[var(--accent, #1e3a5f)]"
        >
            {label}
        </a>
    )
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
                        <ListTaskItem item={item} />
                    ) : (
                        <span>
                            <MarkdownInline text={item.content} />
                        </span>
                    )}
                    {item.children.map((child, childIdx) => (
                        <ListBlock key={childIdx} block={child} depth={depth + 1} />
                    ))}
                </li>
            ))}
        </Tag>
    )
}

function ListTaskItem({ item }) {
    return (
        <label className="flex items-start gap-2 cursor-default">
            <span
                className="mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 text-white"
                style={{
                    background: item.task ? 'var(--accent, #1e3a5f)' : 'var(--bg-primary)',
                    border: `1.5px solid ${item.task ? 'var(--accent, #1e3a5f)' : 'var(--border-medium)'}`
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
                <MarkdownInline text={item.content} />
            </span>
        </label>
    )
}

function HeadingBlock({ block }) {
    const style = HEADING_STYLES[block.level] || HEADING_STYLES[3]
    const Tag = `h${block.level + 2}`
    return (
        <Tag
            className={style.className}
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', ...style.extraStyle }}
        >
            <MarkdownInline text={block.text} />
        </Tag>
    )
}

function BlockquoteBlock({ block }) {
    return (
        <blockquote className="pl-3 py-2 pr-3 rounded-r-md border-l-4 italic bg-bg-tertiary border-[var(--accent, #1e3a5f)] text-text-secondary">
            {block.text.split('\n').map((line, lineIdx) => (
                <div key={lineIdx}>
                    <MarkdownInline text={line} />
                </div>
            ))}
        </blockquote>
    )
}

function TableBlock({ block }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-border-light">
            <table className="w-full text-[12.5px]">
                <thead>
                    <tr className="bg-bg-tertiary">
                        {block.header.map((cell, cellIdx) => (
                            <th
                                key={cellIdx}
                                className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[11px] text-text-secondary"
                            >
                                <MarkdownInline text={cell} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {block.rows.map((row, rowIdx) => (
                        <tr className="border-t border-border-light" key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-3 py-2 align-top text-text-primary">
                                    <MarkdownInline text={cell} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Read-only markdown renderer for AI-formatted plan notes. Handles only the
 * subset `AIService.formatPlanNotes` emits (headings, lists, tables,
 * blockquotes, basic inline formatting) — pairs with the parser in MarkdownUtility.
 */
export function MarkdownView({ source }) {
    const blocks = useMemo(() => parseMarkdownBlocks(source), [source])
    return (
        <div className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-text-primary">
            {blocks.map((block, idx) => {
                if (block.type === 'heading') return <HeadingBlock key={idx} block={block} />
                if (block.type === 'hr') return <hr key={idx} className="my-2 border-0 border-t border-border-light" />
                if (block.type === 'blockquote') return <BlockquoteBlock key={idx} block={block} />
                if (block.type === 'table') return <TableBlock key={idx} block={block} />
                if (block.type === 'list') return <ListBlock key={idx} block={block} />
                return (
                    <p key={idx}>
                        <MarkdownInline text={block.text} />
                    </p>
                )
            })}
        </div>
    )
}

export default MarkdownView
