#!/usr/bin/env node
const { execFileSync } = require('node:child_process')
const { mkdirSync, writeFileSync } = require('node:fs')
const { dirname, resolve } = require('node:path')

const RELEASE_SUBJECT_PATTERN = /^(?:.+?:\s*)?Release v([^\s]+)$/
const FIELD_SEP = '<<<F>>>'
const RECORD_SEP = '<<<R>>>'

function readReleaseCommits() {
    const format = ['%H', '%aI', '%s', '%b'].join(FIELD_SEP) + RECORD_SEP
    const raw = execFileSync('git', ['log', '--grep=Release v', `--format=${format}`], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024
    })
    return raw
        .split(RECORD_SEP)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [hash, isoDate, subject, ...bodyParts] = entry.split(FIELD_SEP)
            return { body: bodyParts.join(FIELD_SEP), hash, isoDate, subject }
        })
}

function extractBullets(body) {
    const bullets = []
    let current = null
    for (const rawLine of (body ?? '').split('\n')) {
        const line = rawLine.replace(/\r$/, '')
        if (/^- /.test(line)) {
            if (current) bullets.push(current.trim())
            current = line.substring(2)
        } else if (current !== null && /^\s+\S/.test(line)) {
            current += ' ' + line.trim()
        } else if (current !== null && line.trim() === '') {
            bullets.push(current.trim())
            current = null
        }
    }
    if (current) bullets.push(current.trim())
    return bullets.filter(Boolean)
}

function toReleaseEntry({ body, isoDate, subject }) {
    const match = subject.match(RELEASE_SUBJECT_PATTERN)
    if (!match) return null
    return {
        changes: extractBullets(body),
        date: isoDate.slice(0, 10),
        version: match[1]
    }
}

function generateReleases() {
    return readReleaseCommits()
        .map(toReleaseEntry)
        .filter(Boolean)
}

function main() {
    const outputPath = resolve(__dirname, '..', 'src', 'data', 'releases.json')
    const releases = generateReleases()
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, JSON.stringify(releases, null, 2) + '\n', 'utf8')
    console.log(`Wrote ${releases.length} release entries to ${outputPath}`)
}

main()
