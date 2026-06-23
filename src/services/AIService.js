import { PROMPTS } from '../app/ai'
import APIUtility from '../utils/APIUtility'

const DEFAULT_MODEL = 'grok-4'
const FAST_MODEL = 'grok-3-mini-fast'
const MAX_RECENT_CHANGES = 10
/**
 * AI-powered content service using the Grok API. Provides asset history
 * summaries and plan-notes markdown formatting.
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
    async generateHistorySummary(historyContext) {
        return this.generateContentFromPrompt('historySummary', this.formatHistoryData, historyContext)
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
