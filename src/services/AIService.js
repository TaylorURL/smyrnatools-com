import { PROMPTS } from '../app/ai'
import APIUtility from '../utils/APIUtility'

const DEFAULT_MODEL = 'grok-4'
const FAST_MODEL = 'grok-3-mini-fast'
const MAX_SUGGESTIONS = 5
const MAX_RECENT_CHANGES = 10
const EXCLUDED_AGGREGATE_KEYS = ['report_date', 'notes']
/** Matches known plant codes in user questions for context scoping. */
const PLANT_CODE_PATTERN = /\b(40[1-8]|410|45[35]|46[18]|455)\b/
/** Formats fleet statistics (active/spare/in-shop counts) into readable summary lines. */
const formatFleetStatLine = (label, stats) => {
    if (!stats) return []
    const lines = [`\n${label}: ${stats.total} total`]
    lines.push(`  Active: ${stats.active} | Spare: ${stats.spare} | In Shop: ${stats.inShop}`)
    if (stats.total > 0) {
        lines.push(`  Utilization: ${Math.round((stats.active / stats.total) * 100)}%`)
    }
    return lines
}
/** Returns a single-line fleet stat summary, or null if stats are unavailable. */
const formatFleetStatSummary = (label, stats) =>
    stats
        ? `${label}: ${stats.total} total, ${stats.active} active${stats.inShop !== undefined ? `, ${stats.inShop} in shop` : ''}${stats.spare !== undefined ? `, ${stats.spare} spare` : ''}`
        : null
const findByTruckNumber = (list, truckNum) =>
    list?.find((item) => String(item.truckNumber) === truckNum || String(item.truckNumber).includes(truckNum))
const filterByTruckNumber = (list, truckNum) =>
    list?.filter((item) => String(item.truckNumber) === truckNum || String(item.truckNumber).includes(truckNum)) ?? []
/**
 * AI-powered insights service using the Grok API.
 * Provides dashboard analysis, history summaries, report validation,
 * follow-up conversations, and content generation for fleet management.
 */
class AIServiceImpl {
    /**
     * Core API call routed through the ai-service edge function to avoid CORS restrictions.
     * @returns Parsed response content, or an error descriptor object.
     */
    async fetchFromAPI(systemPrompt, messages, options = {}) {
        try {
            const { model = DEFAULT_MODEL, temperature = 0.3, timeout } = options
            const { res, json } = await APIUtility.post(
                '/ai-service/generate',
                { messages, model, systemPrompt, temperature },
                { ...(timeout && { maxRetries: 1, timeout }) }
            )
            if (res.status === 429) return { error: 'rate_limited' }
            if (!res.ok) {
                console.error('AI API response error:', res.status, json)
                return { error: 'api_error', status: res.status }
            }
            return { content: json?.content ?? null }
        } catch (error) {
            console.error('AI API Error:', error)
            return { error: 'network_error' }
        }
    }
    /** Convenience wrapper for single-prompt API calls. */
    async callAPI(systemPrompt, userPrompt, options = {}) {
        return this.fetchFromAPI(systemPrompt, [{ content: userPrompt, role: 'user' }], options)
    }
    /** Multi-message conversation call with user-friendly error fallback strings. */
    async callAPIWithMessages(systemPrompt, messages, options = {}) {
        const result = await this.fetchFromAPI(systemPrompt, messages, options)
        if (!result) return 'Error connecting to AI service.'
        if (result.error === 'rate_limited') return 'Rate limited. Please wait a moment and try again.'
        if (result.error) return 'Error connecting to AI service.'
        return result.content ?? 'Could not process that question.'
    }
    /** Generic prompt-driven content generator using a registered prompt key and data formatter. */
    async generateContentFromPrompt(promptKey, dataFormatter, context, options = {}) {
        const userPrompt = dataFormatter.call(this, context)
        const result = await this.callAPI(PROMPTS[promptKey], userPrompt, {
            model: FAST_MODEL,
            temperature: 0.5,
            ...options
        })
        return result?.content ?? null
    }
    /** Generates strategic insights from aggregated dashboard fleet/operator/maintenance data. */
    async generateDashboardInsights(dashboardData) {
        const userPrompt = this.formatDashboardData(dashboardData)
        const result = await this.callAPI(PROMPTS.dashboardInsights, userPrompt)
        if (result?.error) {
            throw new Error(
                result.error === 'api_error' && result.status
                    ? `API Error: ${result.status}`
                    : 'Failed to generate insights'
            )
        }
        return result?.content ?? 'Unable to generate insights at this time.'
    }
    /** Handles follow-up questions within an ongoing conversation, selecting relevant context. */
    async askFollowUp(question, conversationHistory, contextData) {
        const formattedContext = this.selectRelevantContext(question, contextData)
        const messages = [
            { content: formattedContext, role: 'user' },
            ...conversationHistory.map(({ content, role }) => ({ content, role }))
        ]
        return this.callAPIWithMessages(PROMPTS.followUp, messages)
    }
    async generateHistorySummary(historyContext) {
        return this.generateContentFromPrompt('historySummary', this.formatHistoryData, historyContext)
    }
    async generateGMReportAnalysis(reportContext) {
        return this.generateContentFromPrompt('gmReportAnalysis', this.formatGMReportData, reportContext)
    }
    async generateGMReportExportSummary(reportContext) {
        return this.generateContentFromPrompt('gmReportExportSummary', this.formatGMExportData, reportContext, {
            temperature: 0.4
        })
    }
    async improveListItem(description, comments = '') {
        const userPrompt = comments
            ? `Description: "${description}"\nComments: "${comments}"`
            : `Description: "${description}"\nComments: (none - please add a brief relevant comment)`
        const result = await this.callAPI(PROMPTS.improveListItem, userPrompt, { model: FAST_MODEL })
        if (!result?.content) return null
        try {
            const parsed = JSON.parse(result.content.trim())
            return { comments: parsed.comments || '', description: parsed.description || description }
        } catch {
            return { comments: '', description: result.content }
        }
    }
    /**
     * Scores list items by operational priority using AI analysis.
     * Processes items in batches of 15 to keep each API call fast.
     * @param {Array<{id: string, status: string, deadline: string, responsible_role: string, description: string, comments: string}>} items
     * @returns {Map<string, number>|null} Map of itemId → priority score (1-10), or null on failure.
     */
    /**
     * Scores list items by operational priority using AI analysis.
     * Returns Map of itemId → { score, status, deadline }.
     */
    async prioritizeListItems(items) {
        if (!items?.length) return null
        const BATCH_SIZE = 10
        const allResults = new Map()
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE)
            const batchResults = await this.scorePriorityBatch(batch)
            if (batchResults) {
                for (const [itemId, data] of batchResults) allResults.set(itemId, data)
            }
        }
        return allResults.size > 0 ? allResults : null
    }
    /**
     * Scores a single batch of items against the priority prompt.
     * Returns a Map of itemId → { score, status, deadline } for each item.
     */
    async scorePriorityBatch(batch) {
        const todayStr = new Date().toISOString().split('T')[0]
        const compactPayload =
            `Today: ${todayStr}\n\n` +
            batch
                .map(
                    (item) =>
                        `${item.id} | ${item.status || 'pending'} | ${item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : 'none'} | ${item.responsible_role || 'unassigned'} | ${item.description || ''} | ${item.comments || ''}`
                )
                .join('\n')
        const result = await this.callAPI(PROMPTS.prioritizeListItems, compactPayload, {
            model: FAST_MODEL,
            temperature: 0.2
        })
        if (!result?.content) return null
        try {
            const cleaned = result.content.replace(/```json\s*|```\s*/g, '').trim()
            const parsed = JSON.parse(cleaned)
            if (!Array.isArray(parsed)) return null
            const VALID_STATUSES = new Set(['pending', 'in_progress', 'ordered_materials', 'blocked', 'waiting'])
            const resultMap = new Map()
            for (const entry of parsed) {
                if (!entry?.id || typeof entry.score !== 'number') continue
                resultMap.set(entry.id, {
                    deadline: entry.deadline || null,
                    score: Math.max(1, Math.min(10, Math.round(entry.score))),
                    status: VALID_STATUSES.has(entry.status) ? entry.status : null
                })
            }
            return resultMap.size > 0 ? resultMap : null
        } catch {
            return null
        }
    }
    /**
     * Reformats a plan's free-text notes into tidy markdown without altering
     * meaning. Used for read-only display on the Plan dashboard — the raw
     * notes the user typed are always what's persisted.
     */
    async formatPlanNotes(notes) {
        const trimmed = (notes || '').trim()
        if (!trimmed) return ''
        const systemPrompt = [
            'You are an expert markdown formatter for concrete-plant shift notes.',
            'Input: raw notes a dispatcher typed — usually messy, short-form, with abbreviations and imperfect grammar.',
            'Output: ONLY rich GitHub-flavored markdown (no code fences, no preamble, no closing commentary).',
            '',
            'Hard rules:',
            '- Preserve every fact, time, plant code, name, number, and intent exactly.',
            '- Do NOT invent information, add opinions, disclaimers, or sign-offs.',
            '- Fix obvious spelling, capitalization, and punctuation.',
            '- Never wrap the whole reply in code fences.',
            '',
            'Styling guidance — use the FULL markdown toolbox when it aids clarity:',
            '- `##` / `###` headings to group topics (Weather, Dispatch, Plant Notes, QC, Safety, etc.) when multiple topics are present.',
            '- Bulleted lists (`- `) for parallel items; nested bullets with 2-space indent when relevant.',
            '- Numbered lists for ordered steps or priorities.',
            '- Task checkboxes `- [ ]` for action items the crew must do; `- [x]` for completed items.',
            '- `**bold**` for critical callouts (plant closures, delays, safety), `*italic*` for emphasis.',
            '- `> ` blockquotes for warnings or important standing instructions.',
            '- `---` horizontal rule to separate clearly distinct sections.',
            '- Inline `` `code` `` for truck numbers, mix codes, plant codes, or exact identifiers.',
            '- Tables (pipe syntax) when data is clearly tabular (e.g. plant → start time → notes).',
            '',
            'Brevity: if the raw note is one sentence, return one polished sentence. Do not pad short notes into huge documents.'
        ].join('\n')
        const result = await this.callAPI(systemPrompt, trimmed, {
            model: FAST_MODEL,
            temperature: 0.2
        })
        if (!result?.content) return null
        return result.content.replace(/^```(?:markdown|md)?\s*|\s*```$/g, '').trim()
    }
    async suggestListItems(partialDescription = '') {
        if (!partialDescription?.trim()) return []
        const result = await this.callAPI(PROMPTS.suggestListItems, `Complete this task: "${partialDescription}"`, {
            model: FAST_MODEL,
            temperature: 0.6
        })
        if (!result?.content) return []
        return result.content
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, MAX_SUGGESTIONS)
    }
    /**
     * Validates whether an operator's free-text comment adequately explains
     * flagged efficiency issues (late start, early end, low loads, excessive hours).
     */
    async validateEfficiencyComment(comment, issues) {
        const issueLines = [
            issues.startDelayed && `Punch in to 1st load: ${issues.startMinutes} minutes (expected: <=15)`,
            issues.endDelayed && `Washout to punch out: ${issues.endMinutes} minutes (expected: <=20)`,
            issues.lowLoads && `Total loads: ${issues.loads} (expected: >=3)`,
            issues.excessiveHours && `Total hours: ${issues.hours.toFixed(1)} (expected: <=14)`
        ].filter(Boolean)
        const userPrompt = `Performance Issues:\n${issueLines.join('\n')}\n\nOperator Comment: "${comment}"\n\nIs this a valid explanation?`
        /* 30s timeout so a single slow / hung AI request can't stall the
         * whole Plant Efficiency submit flow. The validator loop in
         * `validatePlantProduction` runs sequentially; one stuck call
         * previously locked the AI-validating modal open indefinitely. */
        const result = await this.callAPI(PROMPTS.validateEfficiencyComment, userPrompt, {
            temperature: 0.1,
            timeout: 30000
        })
        if (result?.error) return { error: true }
        const response = result?.content?.trim() ?? ''
        if (response.startsWith('VALID')) return { valid: true }
        const invalidMatch = response.match(/^INVALID:\s*(.+)$/i)
        return invalidMatch
            ? { guidance: invalidMatch[1].trim(), valid: false }
            : { guidance: 'Please provide a detailed explanation for the timing issues.', valid: false }
    }
    /**
     * Validates plant manager report metrics for mathematical consistency.
     * Flags entries where yardage, hours, or loss ratios appear anomalous.
     */
    async validatePlantManagerMetrics(form) {
        const yardage = Number(form.yardage) || 0
        const hours = Number(form.total_hours) || 0
        if (yardage === 0 || hours === 0) return { needsReview: false }
        const yph = yardage / hours
        const userPrompt = [
            'Plant Manager Report Metrics:',
            `- Total Yardage: ${yardage} yards`,
            `- Total Hours: ${hours} hours`,
            `- Yards Per Hour: ${yph.toFixed(2)}`,
            '',
            'Does this data make sense or should the plant manager double-check their entries?'
        ].join('\n')
        const result = await this.callAPI(PROMPTS.validatePlantManagerMetrics, userPrompt, {
            temperature: 0.2,
            timeout: 30000
        })
        if (result?.error) return { error: true }
        try {
            return JSON.parse(result?.content?.trim() || '{"needsReview": false}')
        } catch {
            return { needsReview: false }
        }
    }
    /**
     * Selects the most relevant context data based on the user's question keywords.
     * Avoids sending the entire dataset to the API for better token efficiency.
     */
    selectRelevantContext(question, ctx) {
        const q = question.toLowerCase()
        const parts = [
            `Region: ${ctx.regionName || 'Unknown'}, Date: ${ctx.currentDate || new Date().toISOString().slice(0, 10)}`
        ]
        this.appendTruckContext(q, ctx, parts)
        this.appendOperatorContext(q, ctx, parts)
        this.appendFleetContext(q, ctx, parts)
        this.appendPlantOperatorContext(q, ctx, parts)
        this.appendShopContext(q, ctx, parts)
        this.appendReportContext(q, ctx, parts)
        return parts.join('\n')
    }
    /** Appends truck-specific context (mixer/tractor details, operator history) when a truck number is detected. */
    appendTruckContext(q, ctx, parts) {
        const truckMatch = q.match(/\b\d{3,5}\b/)
        if (!truckMatch) return
        const truckNum = truckMatch[0]
        const mixer = findByTruckNumber(ctx.allMixersList, truckNum)
        if (mixer) {
            parts.push(
                `Mixer ${mixer.truckNumber}: ${mixer.status} at Plant ${mixer.plant}, Operator: ${mixer.operatorName || 'Unassigned'}, VIN: ${mixer.vin || 'N/A'}, Make: ${mixer.make || 'N/A'}, Model: ${mixer.model || 'N/A'}, Year: ${mixer.year || 'N/A'}, Last Service: ${mixer.lastServiceDate?.slice(0, 10) || 'N/A'}`
            )
        }
        const tractor = findByTruckNumber(ctx.allTractorsList, truckNum)
        if (tractor) {
            parts.push(
                `Tractor ${tractor.truckNumber}: ${tractor.status} at Plant ${tractor.plant}, Operator: ${tractor.operatorName || 'Unassigned'}, Type: ${tractor.type || 'N/A'}`
            )
        }
        const history = filterByTruckNumber(ctx.operatorAssignmentHistory, truckNum)
        const operators = [
            ...new Set(history.map((h) => h.newOperator).filter((o) => o && o !== 'None' && o !== 'Unknown Operator'))
        ]
        if (operators.length > 0) parts.push(`Operators who have driven ${truckNum}: ${operators.join(', ')}`)
    }
    appendOperatorContext(q, ctx, parts) {
        const op = ctx.allOperatorsList?.find((o) => q.includes(o.name?.toLowerCase()))
        if (!op) return
        parts.push(`Operator ${op.name}: ${op.status} at Plant ${op.plant}, Position: ${op.position || 'Operator'}`)
        const assignedMixer = ctx.allMixersList?.find((m) => m.operatorName === op.name)
        if (assignedMixer)
            parts.push(
                `${op.name} is currently driving Mixer ${assignedMixer.truckNumber} at Plant ${assignedMixer.plant}`
            )
        const assignedTractor = ctx.allTractorsList?.find((t) => t.operatorName === op.name)
        if (assignedTractor)
            parts.push(
                `${op.name} is currently driving Tractor ${assignedTractor.truckNumber} at Plant ${assignedTractor.plant}`
            )
    }
    appendFleetContext(q, ctx, parts) {
        if (!q.includes('fleet') && !q.includes('status') && !q.includes('how many') && !q.includes('total')) return
        const summaries = [
            formatFleetStatSummary('Mixers', ctx.mixerStats),
            formatFleetStatSummary('Tractors', ctx.tractorStats),
            formatFleetStatSummary('Trailers', ctx.trailerStats),
            ctx.operatorStats && `Operators: ${ctx.operatorStats.total} total, ${ctx.operatorStats.active} active`
        ].filter(Boolean)
        parts.push(...summaries)
    }
    appendPlantOperatorContext(q, ctx, parts) {
        if (!q.includes('operator')) return
        const plantMatch = q.match(PLANT_CODE_PATTERN)
        if (!plantMatch) return
        const plantCode = plantMatch[0]
        const ops = ctx.allOperatorsList?.filter((o) => String(o.plant) === plantCode) ?? []
        if (ops.length > 0) parts.push(`Operators at Plant ${plantCode}: ${ops.map((o) => o.name).join(', ')}`)
    }
    appendShopContext(q, ctx, parts) {
        if (!q.includes('shop') || !ctx.mixersInShop?.length) return
        parts.push(`Mixers in shop: ${ctx.mixersInShop.map((m) => `${m.truckNumber} (${m.plant})`).join(', ')}`)
    }
    appendReportContext(q, ctx, parts) {
        if (!q.includes('yard') && !q.includes('report') && !q.includes('production')) return
        const plantMatch = q.match(PLANT_CODE_PATTERN)
        if (plantMatch) {
            const reports = ctx.plantManagerReports?.filter((r) => String(r.plant) === plantMatch[0]).slice(0, 5) ?? []
            reports.forEach((r) =>
                parts.push(`Week ${r.week} Plant ${r.plant}: ${r.yardage} yards, ${r.totalHours} hours`)
            )
            return
        }
        const latestWeek = ctx.plantManagerReports?.[0]?.week
        if (!latestWeek) return
        const weekReports = ctx.plantManagerReports.filter((r) => r.week === latestWeek)
        const totalYards = weekReports.reduce((sum, r) => sum + (r.yardage || 0), 0)
        parts.push(`Week ${latestWeek}: ${totalYards} total yards across ${weekReports.length} plants`)
    }
    /** Composes the full dashboard data prompt with fleet, operator, maintenance, and historical sections. */
    formatDashboardData(data) {
        const parts = [`Analysis Date: ${new Date().toLocaleDateString()}`]
        if (data.regionName) parts.push(`Region: ${data.regionName}`)
        if (data.selectedPlant) parts.push(`Viewing Plant: ${data.selectedPlant}`)
        parts.push('\n=== FLEET STATUS ===')
        parts.push(...formatFleetStatLine('MIXERS', data.mixerStats))
        parts.push(...formatFleetStatLine('TRACTORS', data.tractorStats))
        parts.push(...formatFleetStatLine('TRAILERS', data.trailerStats))
        parts.push(...formatFleetStatLine('EQUIPMENT', data.equipmentStats))
        parts.push('\n=== OPERATORS ===')
        if (data.operatorStats) {
            const os = data.operatorStats
            parts.push(
                `Total Operators: ${os.total}`,
                `Active: ${os.active}`,
                `  - Mixer Operators (assigned to mixers): ${os.mixerOperators || 0}`,
                `  - Tractor Operators (assigned to tractors): ${os.tractorOperators || 0}`,
                `  - Unassigned Active: ${os.unassigned || 0}`,
                `Training: ${os.training || 0}`,
                `Pending Start: ${os.pendingStart || 0}`,
                `Light Duty: ${os.lightDuty || 0}`
            )
        }
        parts.push('\n=== MAINTENANCE ===')
        parts.push(`Service Overdue: ${data.overdueCount || 0} assets`)
        parts.push(`Open Issues: ${data.openIssuesCount || 0}`)
        this.appendHistoricalTrends(data, parts)
        this.appendRecentReports(data, parts)
        parts.push(
            '\nAnalyze this data and provide 3-5 specific issues or concerns. Focus on problems, not positives. Consider production trends, yardage, hours, efficiency, and staffing levels.'
        )
        return parts.join('\n')
    }
    appendHistoricalTrends(data, parts) {
        if (!data.statusHistory) return
        parts.push(`\n=== HISTORICAL TRENDS (${data.historyDateRange || 'all time'}) ===`)
        const appendDistribution = (label, items) => {
            if (!items?.length) return
            parts.push(`${label} Time Distribution:`)
            items.slice(0, 3).forEach((s) => parts.push(`  ${s.status}: ${s.percentage}%`))
        }
        appendDistribution('Mixer', data.statusHistory.mixers)
        appendDistribution('Tractor', data.statusHistory.tractors)
    }
    appendRecentReports(data, parts) {
        if (!data.recentReports) return
        parts.push('\n=== RECENT REPORTS (Last 4 Weeks) ===')
        parts.push(`Total Completed Reports: ${data.recentReports.totalReportsLast4Weeks || 0}`)
        const reportFormatters = [
            {
                format: (r) =>
                    `  Week ${r.week} - Plant ${r.plant}: ${r.yardage || 0} yards, ${r.hours || 0} hours, ${r.operatorCount || 0} operators, ${r.loadsLost || 0} loads lost`,
                key: 'plantManagerReports',
                label: 'PLANT MANAGER REPORTS'
            },
            {
                format: (r) =>
                    `  Week ${r.week}: ${r.totalYardage || 0} total yards, ${r.totalHours || 0} hours, ${r.operatorsActive || 0} active operators, ${r.mixersRunnable || 0} runnable/${r.mixersDown || 0} down`,
                key: 'generalManagerReports',
                label: 'GENERAL MANAGER REPORTS'
            },
            {
                format: (r) =>
                    `  Week ${r.week} - Plant ${r.plant}: Start ${r.avgStartTime || 'N/A'}, End ${r.avgEndTime || 'N/A'}, ${r.loadsPerHour || 'N/A'} loads/hr`,
                key: 'efficiencyReports',
                label: 'EFFICIENCY REPORTS'
            },
            {
                format: (r) =>
                    `  Week ${r.week}: ${r.trainersActive || 0} active trainers, ${r.pendingHires || 0} pending hires, goal: ${r.hiringGoal || 0}`,
                key: 'rmiReports',
                label: 'RMI (TRAINING/HIRING) REPORTS'
            }
        ]
        reportFormatters.forEach(({ key, label, format }) => {
            const items = data.recentReports[key]
            if (!items?.length) return
            parts.push(`\n${label}:`)
            items.forEach((r) => parts.push(format(r)))
        })
        if (data.recentReports.aggregateReports?.length > 0) {
            parts.push('\nAGGREGATE PRODUCTION REPORTS:')
            data.recentReports.aggregateReports.slice(0, 4).forEach((r) => {
                parts.push(
                    `  Week ${r.week}: ${Array.isArray(r.materials) ? r.materials.length : 0} materials reported`
                )
            })
        }
    }
    /** Formats asset history data (status changes, cleanliness trends, service records) for AI analysis. */
    formatHistoryData(ctx) {
        const parts = [
            `Asset Type: ${ctx.assetType}`,
            `Identifier: ${ctx.assetIdentifier}`,
            `Current Status: ${ctx.currentStatus}`,
            `Current Plant: ${ctx.currentPlant}`,
            `Total History Entries: ${ctx.totalHistoryEntries}`
        ]
        if (ctx.statusChanges > 0) {
            parts.push(`Status Changes: ${ctx.statusChanges}`)
            if (ctx.statusBreakdown) {
                parts.push(
                    `Status Time Breakdown: ${Object.entries(ctx.statusBreakdown)
                        .map(([status, days]) => `${status}: ${days} days`)
                        .join(', ')}`
                )
            }
            if (ctx.currentStatusDays > 0) parts.push(`Days in Current Status: ${ctx.currentStatusDays}`)
        }
        if (ctx.cleanlinessHistory) {
            const ch = ctx.cleanlinessHistory
            parts.push(
                `Cleanliness Ratings Recorded: ${ch.count}`,
                `Average Cleanliness: ${ch.average.toFixed(1)}/5`,
                `Current Cleanliness: ${ch.current}/5`
            )
            if (ch.trend !== 0) {
                parts.push(
                    `Cleanliness Trend: ${ch.trend > 0 ? 'Improving' : 'Declining'} (${ch.trend > 0 ? '+' : ''}${ch.trend})`
                )
            }
        }
        if (ctx.operatorChanges > 0) {
            parts.push(`Operator Changes: ${ctx.operatorChanges}`, `Unique Operators Assigned: ${ctx.uniqueOperators}`)
        }
        if (ctx.serviceHistory) {
            parts.push(`Service Records: ${ctx.serviceHistory.count}`)
            if (ctx.serviceHistory.lastService)
                parts.push(`Last Service: ${new Date(ctx.serviceHistory.lastService).toLocaleDateString()}`)
            if (ctx.serviceHistory.avgDaysBetweenService)
                parts.push(`Avg Days Between Service: ${ctx.serviceHistory.avgDaysBetweenService}`)
        }
        if (ctx.plantChanges > 0) parts.push(`Plant Assignment Changes: ${ctx.plantChanges}`)
        if (ctx.openIssues > 0 || ctx.resolvedIssues > 0) {
            parts.push(`Open Issues: ${ctx.openIssues}`, `Resolved Issues: ${ctx.resolvedIssues}`)
            if (ctx.highSeverityIssues > 0)
                parts.push(`HIGH SEVERITY OPEN ISSUES: ${ctx.highSeverityIssues} - needs immediate attention`)
        }
        if (ctx.recentChanges?.length > 0) {
            parts.push('Recent Changes (last 10):')
            ctx.recentChanges
                .slice(0, MAX_RECENT_CHANGES)
                .forEach((c) =>
                    parts.push(`  - ${c.field}: "${c.from}" -> "${c.to}" (${new Date(c.date).toLocaleDateString()})`)
                )
        }
        return parts.join('\n')
    }
    /** Formats General Manager weekly report data for AI-powered analysis. */
    formatGMReportData(ctx) {
        const parts = ['Weekly General Manager Report Summary', `Week: ${ctx.weekIso || 'Unknown'}`]
        if (ctx.plants?.length > 0) {
            parts.push(
                `\nRegion covers ${ctx.plants.length} plants: ${ctx.plants.map((p) => p.plant_code || p).join(', ')}`
            )
        }
        if (ctx.plantSummaries?.length > 0) {
            parts.push('\nPer-Plant Metrics:')
            ctx.plantSummaries.forEach((p) => {
                parts.push(`\n${p.plantName} (${p.plantCode}):`)
                const metrics = [
                    p.operators !== undefined &&
                        `  Operators: ${p.operators} (last week: ${p.lastWeekOperators || 'N/A'})`,
                    p.runnableTrucks !== undefined &&
                        `  Runnable Trucks: ${p.runnableTrucks} (last week: ${p.lastWeekRunnable || 'N/A'})`,
                    p.downTrucks !== undefined &&
                        `  Down Trucks: ${p.downTrucks} (last week: ${p.lastWeekDown || 'N/A'})`,
                    p.operatorsStarting !== undefined && `  Operators Starting: ${p.operatorsStarting}`,
                    p.operatorsLeaving !== undefined && `  Operators Leaving: ${p.operatorsLeaving}`,
                    p.operatorsTraining !== undefined && `  In Training: ${p.operatorsTraining}`,
                    p.yardage !== undefined &&
                        `  Total Yardage: ${p.yardage} (last week: ${p.lastWeekYardage || 'N/A'})`,
                    p.hours !== undefined && `  Total Hours: ${p.hours} (last week: ${p.lastWeekHours || 'N/A'})`,
                    p.notes && `  Notes: ${p.notes}`
                ].filter(Boolean)
                parts.push(...metrics)
            })
        }
        if (ctx.efficiencyReports?.length > 0) {
            parts.push(`\nPlant Efficiency Reports Available: ${ctx.efficiencyReports.length}`)
            ctx.efficiencyReports.forEach((e) => {
                parts.push(
                    `  ${e.plantCode}: ${e.totalLoads || 0} loads, ${e.totalHours?.toFixed(1) || 0} hours, ${e.avgLoadsPerHour?.toFixed(2) || 'N/A'} loads/hour`
                )
            })
        }
        if (ctx.aggregateData) {
            parts.push('\nAggregate Production This Week:')
            Object.entries(ctx.aggregateData)
                .filter(([key, value]) => value && !EXCLUDED_AGGREGATE_KEYS.includes(key))
                .forEach(([key, value]) => parts.push(`  ${key}: ${value}`))
        }
        if (ctx.rmiReport) {
            parts.push('\nReady Mix Instructor Report Available: Yes')
            if (ctx.rmiReport.total_trainees !== undefined)
                parts.push(`  Total Trainees: ${ctx.rmiReport.total_trainees}`)
        }
        return parts.join('\n')
    }
    /** Formats condensed GM export data for AI-generated summary paragraphs. */
    formatGMExportData(ctx) {
        const parts = [`Week: ${ctx.weekIso || 'Unknown'}`, `Plants: ${ctx.plantCount || 0}`]
        const conditionalMetrics = [
            ctx.totalYardage !== undefined && `Total Yardage: ${ctx.totalYardage}`,
            ctx.totalOperators !== undefined && `Total Operators: ${ctx.totalOperators}`,
            ctx.totalRunnable !== undefined && `Runnable Trucks: ${ctx.totalRunnable}`,
            ctx.totalDown !== undefined && `Down Trucks: ${ctx.totalDown}`,
            ctx.fleetUtilization !== undefined && `Fleet Utilization: ${ctx.fleetUtilization}%`,
            ctx.allocationPct !== undefined && `Operator Allocation: ${ctx.allocationPct}%`
        ].filter(Boolean)
        parts.push(...conditionalMetrics)
        if (ctx.prevWeekYardage !== undefined && ctx.totalYardage !== undefined) {
            const change =
                ctx.prevWeekYardage > 0
                    ? Math.round(((ctx.totalYardage - ctx.prevWeekYardage) / ctx.prevWeekYardage) * 100)
                    : 0
            parts.push(`WoW Yardage Change: ${change > 0 ? '+' : ''}${change}%`)
        }
        if (ctx.plantIssues?.length > 0) parts.push(`Plant Issues: ${ctx.plantIssues.join(', ')}`)
        return parts.join('\n')
    }
}
export const AIService = new AIServiceImpl()
