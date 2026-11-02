// @ts-ignore
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
// @ts-ignore
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts'
// @ts-ignore
import { requireAuthenticated } from '../_shared/requireSession.ts'

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions'

const DEFAULT_MODEL = 'grok-4'
const DEFAULT_TEMPERATURE = 0.3

// Claude is the backup: it answers only when Grok is not configured or its
// request fails. The caller's `model` and `temperature` are Grok settings, so
// the Claude request uses its own model and leaves sampling at the defaults.
const CLAUDE_MODEL = 'claude-opus-5-5'
const CLAUDE_MAX_TOKENS = 16000

type GenerateRequest = {
    systemPrompt: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    model?: string
    temperature?: number
}

/**
 * Asks Grok for a completion. Never throws: a failure comes back as the
 * Response the caller should send if no backup answers instead.
 */
async function generateWithGrok(
    apiKey: string,
    { systemPrompt, messages, model, temperature }: GenerateRequest,
    headers: Record<string, string>
): Promise<{ content?: string | null; failure?: Response }> {
    try {
        const response = await fetch(GROK_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                model: model || DEFAULT_MODEL,
                stream: false,
                temperature: temperature ?? DEFAULT_TEMPERATURE
            })
        })

        if (response.status === 429) return { failure: errorResponse('Rate limited', headers, 429) }
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error')
            return { failure: errorResponse('AI request failed', headers, response.status, { detail: errorText }) }
        }

        const data = await response.json()
        return { content: data.choices?.[0]?.message?.content ?? null }
    } catch (error) {
        console.error('[ai-service] Grok request failed:', error)
        return { failure: errorResponse('AI request failed', headers, 502) }
    }
}

/**
 * Asks Claude for a completion. Returns the text, or null when Claude declines
 * or the request fails, so the caller can fall back to Grok's own error.
 *
 * A user-level Anthropic key is not bound to one workspace, and the API
 * refuses it unless the request names one in `anthropic-workspace-id`.
 */
async function generateWithClaude(
    apiKey: string,
    workspaceId: string | undefined,
    { systemPrompt, messages }: GenerateRequest
): Promise<string | null> {
    try {
        const client = new Anthropic({
            apiKey,
            maxRetries: 1,
            timeout: 60_000,
            ...(workspaceId && { defaultHeaders: { 'anthropic-workspace-id': workspaceId } })
        })
        const response = await client.beta.messages.create({
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            max_tokens: CLAUDE_MAX_TOKENS,
            messages,
            model: CLAUDE_MODEL,
            output_config: { effort: 'low' },
            system: systemPrompt
        })
        if (response.stop_reason === 'refusal') return null
        let text = ''
        for (const block of response.content) {
            if (block.type === 'text') text += block.text
        }
        return text || null
    } catch (error) {
        if (error instanceof Anthropic.APIError) {
            console.error('[ai-service] Claude request failed:', error.status, error.message)
        } else {
            console.error('[ai-service] Claude request failed:', error)
        }
        return null
    }
}

Deno.serve(async (req) => {
    const origin = req.headers.get('origin')
    if (req.method === 'OPTIONS') return handleOptions(origin)
    const headers = getCorsHeaders(origin)

    try {
        const grokApiKey = Deno.env.get('GROK_API_KEY')
        const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
        if (!grokApiKey && !anthropicApiKey) return errorResponse('AI service not configured', headers, 503)

        const url = new URL(req.url)
        const endpoint = url.pathname.split('/').pop()

        switch (endpoint) {
            case 'generate': {
                const body = await req.json().catch(() => ({}))
                const auth = await requireAuthenticated(null, req, headers, body)
                if (auth instanceof Response) return auth
                const { systemPrompt, messages } = body

                if (!systemPrompt || !Array.isArray(messages)) {
                    return errorResponse('systemPrompt and messages are required', headers, 400)
                }

                let failure = errorResponse('AI service not configured', headers, 503)
                if (grokApiKey) {
                    const grok = await generateWithGrok(grokApiKey, body, headers)
                    if (!grok.failure) return jsonResponse({ content: grok.content }, headers)
                    failure = grok.failure
                }

                if (anthropicApiKey) {
                    const content = await generateWithClaude(
                        anthropicApiKey,
                        Deno.env.get('ANTHROPIC_WORKSPACE_ID'),
                        body
                    )
                    if (content) return jsonResponse({ content }, headers)
                }

                return failure
            }
            default:
                return errorResponse('Invalid endpoint', headers, 404, { path: url.pathname })
        }
    } catch (error) {
        return errorResponse('Internal server error', headers, 500)
    }
})
