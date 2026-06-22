import { createClient } from '@supabase/supabase-js'

const SUNDAY_MY_URL = import.meta.env.REACT_APP_SUNDAY_MY_SUPABASE_URL
const SUNDAY_MY_ANON_KEY = import.meta.env.REACT_APP_SUNDAY_MY_SUPABASE_ANON_KEY

export const sundayMyClient =
    SUNDAY_MY_URL && SUNDAY_MY_ANON_KEY
        ? createClient(SUNDAY_MY_URL, SUNDAY_MY_ANON_KEY)
        : null
