import { PROMPTS } from '../app/ai'
import APIUtility from '../utils/APIUtility'
import { formatCentralDate } from '../utils/PlanUtility'

const DEFAULT_MODEL = 'grok-4'
const FAST_MODEL = 'grok-3-mini-fast'
const MAX_RECENT_CHANGES = 10
/** Grok-backed content generation, currently used to summarize asset history. */
class AIServiceImpl {
    /**
     * Single entry point to the model. Requests go to the `ai-service` edge
     * function rather than to the provider directly.
     *
     * Never throws: every failure comes back as `{ error }` — `rate_limited`
     * for a 429, `api_error` with the status for any other bad response, and
     * `network_error` when the request itself fails. Callers that only read
     * `.content` therefore see null rather than an exception.
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
    /**
     * Runs one of the prompts registered in `PROMPTS` against `context`,
     * rendered to a user message by `dataFormatter`. Defaults to the fast
     * model; `options` overrides any of the per-call model settings.
     *
     * @returns {Promise<string|null>} the generated text, or null on any failure
     */
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
     * Renders an asset's history statistics as the labelled plain-text block
     * the `historySummary` prompt reads. Every section past the header is
     * conditional, so an asset with no service records or issues produces no
     * lines for them and the model is not asked to reason about absent data.
     *
     * The literal "(last 10)" in the recent-changes header must track
     * MAX_RECENT_CHANGES, or the block will misdescribe how much it lists.
     */
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
                parts.push(`Last Service: ${formatCentralDate(ctx.serviceHistory.lastService)}`)
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
                .forEach((c) => parts.push(`  - ${c.field}: "${c.from}" -> "${c.to}" (${formatCentralDate(c.date)})`))
        }
        return parts.join('\n')
    }
}
export const AIService = new AIServiceImpl()
