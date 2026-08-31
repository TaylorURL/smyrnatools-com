// Ambient declarations so the Supabase edge functions type-check under the
// repo's Node TypeScript setup: the Deno global and the npm:/https: import
// specifiers only exist in the Deno runtime that runs them in production.
declare global {
    const Deno: {
        env: { get(key: string): string | undefined }
        serve: (handler: (req) => Promise<Response>) => void
    }
}

declare module 'npm:*'

declare module 'https://deno.land/*'

export {}
