export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: '13.0.5'
    }
    public: {
        Tables: {
            active_visitors: {
                Row: {
                    last_seen: string | null
                    visitor_id: string
                    website_id: string
                }
                Insert: {
                    last_seen?: string | null
                    visitor_id: string
                    website_id: string
                }
                Update: {
                    last_seen?: string | null
                    visitor_id?: string
                    website_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'active_visitors_website_id_fkey'
                        columns: ['website_id']
                        isOneToOne: false
                        referencedRelation: 'websites'
                        referencedColumns: ['id']
                    }
                ]
            }
            client_errors: {
                Row: {
                    browser: string | null
                    column_number: number | null
                    component_stack: string | null
                    created_at: string | null
                    error_count: number | null
                    error_hash: string
                    error_message: string
                    fix_commit_hash: string | null
                    fix_notes: string | null
                    fixed: boolean | null
                    github_issue_number: number | null
                    github_issue_state: string | null
                    github_issue_url: string | null
                    github_repo: string | null
                    id: string
                    line_number: number | null
                    os: string | null
                    project: string
                    skip_reason: string | null
                    skipped: boolean | null
                    source_file: string | null
                    stack_trace: string | null
                    updated_at: string | null
                    url: string
                    user_agent: string | null
                }
                Insert: {
                    browser?: string | null
                    column_number?: number | null
                    component_stack?: string | null
                    created_at?: string | null
                    error_count?: number | null
                    error_hash: string
                    error_message: string
                    fix_commit_hash?: string | null
                    fix_notes?: string | null
                    fixed?: boolean | null
                    github_issue_number?: number | null
                    github_issue_state?: string | null
                    github_issue_url?: string | null
                    github_repo?: string | null
                    id?: string
                    line_number?: number | null
                    os?: string | null
                    project: string
                    skip_reason?: string | null
                    skipped?: boolean | null
                    source_file?: string | null
                    stack_trace?: string | null
                    updated_at?: string | null
                    url: string
                    user_agent?: string | null
                }
                Update: {
                    browser?: string | null
                    column_number?: number | null
                    component_stack?: string | null
                    created_at?: string | null
                    error_count?: number | null
                    error_hash?: string
                    error_message?: string
                    fix_commit_hash?: string | null
                    fix_notes?: string | null
                    fixed?: boolean | null
                    github_issue_number?: number | null
                    github_issue_state?: string | null
                    github_issue_url?: string | null
                    github_repo?: string | null
                    id?: string
                    line_number?: number | null
                    os?: string | null
                    project?: string
                    skip_reason?: string | null
                    skipped?: boolean | null
                    source_file?: string | null
                    stack_trace?: string | null
                    updated_at?: string | null
                    url?: string
                    user_agent?: string | null
                }
                Relationships: []
            }
            game_saves: {
                Row: {
                    character_archetype: string
                    character_backstory: string | null
                    character_name: string
                    conversation_history: Json
                    created_at: string | null
                    current_turn: Json | null
                    game_over_reason: string | null
                    id: string
                    is_game_over: boolean | null
                    player_id: string
                    timeline_entry_point_id: string
                    turn_count: number | null
                    universe_id: string
                    updated_at: string | null
                }
                Insert: {
                    character_archetype: string
                    character_backstory?: string | null
                    character_name: string
                    conversation_history?: Json
                    created_at?: string | null
                    current_turn?: Json | null
                    game_over_reason?: string | null
                    id?: string
                    is_game_over?: boolean | null
                    player_id: string
                    timeline_entry_point_id: string
                    turn_count?: number | null
                    universe_id: string
                    updated_at?: string | null
                }
                Update: {
                    character_archetype?: string
                    character_backstory?: string | null
                    character_name?: string
                    conversation_history?: Json
                    created_at?: string | null
                    current_turn?: Json | null
                    game_over_reason?: string | null
                    id?: string
                    is_game_over?: boolean | null
                    player_id?: string
                    timeline_entry_point_id?: string
                    turn_count?: number | null
                    universe_id?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'game_saves_player_id_fkey'
                        columns: ['player_id']
                        isOneToOne: false
                        referencedRelation: 'players'
                        referencedColumns: ['id']
                    }
                ]
            }
            page_views: {
                Row: {
                    country: string | null
                    created_at: string | null
                    id: string
                    page_url: string
                    referrer: string | null
                    visitor_id: string
                    website_id: string | null
                }
                Insert: {
                    country?: string | null
                    created_at?: string | null
                    id?: string
                    page_url: string
                    referrer?: string | null
                    visitor_id: string
                    website_id?: string | null
                }
                Update: {
                    country?: string | null
                    created_at?: string | null
                    id?: string
                    page_url?: string
                    referrer?: string | null
                    visitor_id?: string
                    website_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'page_views_website_id_fkey'
                        columns: ['website_id']
                        isOneToOne: false
                        referencedRelation: 'websites'
                        referencedColumns: ['id']
                    }
                ]
            }
            players: {
                Row: {
                    created_at: string | null
                    display_name: string | null
                    email: string
                    id: string
                    last_login: string | null
                    password_hash: string
                    username: string
                }
                Insert: {
                    created_at?: string | null
                    display_name?: string | null
                    email: string
                    id?: string
                    last_login?: string | null
                    password_hash: string
                    username: string
                }
                Update: {
                    created_at?: string | null
                    display_name?: string | null
                    email?: string
                    id?: string
                    last_login?: string | null
                    password_hash?: string
                    username?: string
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    created_at: string | null
                    full_name: string | null
                    id: string
                    role: string | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    full_name?: string | null
                    id: string
                    role?: string | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    full_name?: string | null
                    id?: string
                    role?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            uptime_checks: {
                Row: {
                    created_at: string | null
                    id: string
                    is_up: boolean
                    response_time_ms: number | null
                    status_code: number | null
                    website_id: string | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    is_up?: boolean
                    response_time_ms?: number | null
                    status_code?: number | null
                    website_id?: string | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    is_up?: boolean
                    response_time_ms?: number | null
                    status_code?: number | null
                    website_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'uptime_checks_website_id_fkey'
                        columns: ['website_id']
                        isOneToOne: false
                        referencedRelation: 'websites'
                        referencedColumns: ['id']
                    }
                ]
            }
            website_stats: {
                Row: {
                    avg_load_time_ms: number | null
                    id: string
                    is_up_now: boolean | null
                    page_views_30d: number | null
                    updated_at: string | null
                    uptime_pct: number | null
                    visitors_30d: number | null
                    visitors_now: number | null
                    website_id: string
                }
                Insert: {
                    avg_load_time_ms?: number | null
                    id?: string
                    is_up_now?: boolean | null
                    page_views_30d?: number | null
                    updated_at?: string | null
                    uptime_pct?: number | null
                    visitors_30d?: number | null
                    visitors_now?: number | null
                    website_id: string
                }
                Update: {
                    avg_load_time_ms?: number | null
                    id?: string
                    is_up_now?: boolean | null
                    page_views_30d?: number | null
                    updated_at?: string | null
                    uptime_pct?: number | null
                    visitors_30d?: number | null
                    visitors_now?: number | null
                    website_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'website_stats_website_id_fkey'
                        columns: ['website_id']
                        isOneToOne: false
                        referencedRelation: 'websites'
                        referencedColumns: ['id']
                    }
                ]
            }
            websites: {
                Row: {
                    created_at: string | null
                    domain: string
                    id: string
                    name: string
                    notes: string | null
                    status: string | null
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    domain: string
                    id?: string
                    name: string
                    notes?: string | null
                    status?: string | null
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    domain?: string
                    id?: string
                    name?: string
                    notes?: string | null
                    status?: string | null
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            cleanup_expired_linking_tokens: { Args: never; Returns: undefined }
            cleanup_expired_tokens: { Args: never; Returns: undefined }
            find_plugin_by_hash: {
                Args: { hash_to_find: string }
                Returns: {
                    id: string
                    name: string
                }[]
            }
            get_user_profile: {
                Args: { user_id_param: string }
                Returns: {
                    avatar_url: string
                    display_name: string
                    email: string
                    id: string
                    username: string
                }[]
            }
            get_user_roles: {
                Args: { target_user_id: string }
                Returns: {
                    role: string
                }[]
            }
            increment_plugin_downloads: {
                Args: { p_plugin_id: string }
                Returns: undefined
            }
            is_staff: { Args: { check_user_id: string }; Returns: boolean }
            is_staff_or_admin: { Args: never; Returns: boolean }
            update_plugin_rating: {
                Args: { p_plugin_id: string }
                Returns: undefined
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
          ? R
          : never
      : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I
        }
          ? I
          : never
      : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U
        }
          ? U
          : never
      : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
    public: {
        Enums: {}
    }
} as const
