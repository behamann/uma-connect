
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "answer_counts": {
                  Row: {
                    "cell": number,"picks": number,"puzzle_number": number,"trainee_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cell": number,"picks"?: number,"puzzle_number": number,"trainee_id": string
                  }
                  Update: {
                    "cell"?: number,"picks"?: number,"puzzle_number"?: number,"trainee_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answer_counts_puzzle_number_fkey"
      columns: ["puzzle_number"]
isOneToOne: false
      referencedRelation: "puzzles"
      referencedColumns: ["puzzle_number"]
    },{
      foreignKeyName: "answer_counts_trainee_id_fkey"
      columns: ["trainee_id"]
isOneToOne: false
      referencedRelation: "trainees"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_sessions": {
                  Row: {
                    "finished_at": string | null,"guesses": NonNullable<Json>,"imported": boolean,"is_guest": boolean,"puzzle_number": number,"score": number,"started_at": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "finished_at"?: string | null,"guesses"?: NonNullable<Json>,"imported"?: boolean,"is_guest"?: boolean,"puzzle_number": number,"score"?: number,"started_at"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "finished_at"?: string | null,"guesses"?: NonNullable<Json>,"imported"?: boolean,"is_guest"?: boolean,"puzzle_number"?: number,"score"?: number,"started_at"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_sessions_puzzle_number_fkey"
      columns: ["puzzle_number"]
isOneToOne: false
      referencedRelation: "puzzles"
      referencedColumns: ["puzzle_number"]
    }
                  ]
                },"legacy_history": {
                  Row: {
                    "puzzle_number": number,"score": number,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "puzzle_number": number,"score": number,"status": string,"user_id": string
                  }
                  Update: {
                    "puzzle_number"?: number,"score"?: number,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "legacy_history_puzzle_number_fkey"
      columns: ["puzzle_number"]
isOneToOne: false
      referencedRelation: "puzzles"
      referencedColumns: ["puzzle_number"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"leaderboard_opt_out": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"leaderboard_opt_out"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"leaderboard_opt_out"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"puzzle_answers": {
                  Row: {
                    "cell": number,"puzzle_number": number,"trainee_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cell": number,"puzzle_number": number,"trainee_id": string
                  }
                  Update: {
                    "cell"?: number,"puzzle_number"?: number,"trainee_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "puzzle_answers_puzzle_number_fkey"
      columns: ["puzzle_number"]
isOneToOne: false
      referencedRelation: "puzzles"
      referencedColumns: ["puzzle_number"]
    },{
      foreignKeyName: "puzzle_answers_trainee_id_fkey"
      columns: ["trainee_id"]
isOneToOne: false
      referencedRelation: "trainees"
      referencedColumns: ["id"]
    }
                  ]
                },"puzzle_stats": {
                  Row: {
                    "finished_games": number,"puzzle_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "finished_games"?: number,"puzzle_number": number
                  }
                  Update: {
                    "finished_games"?: number,"puzzle_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "puzzle_stats_puzzle_number_fkey"
      columns: ["puzzle_number"]
isOneToOne: true
      referencedRelation: "puzzles"
      referencedColumns: ["puzzle_number"]
    }
                  ]
                },"puzzles": {
                  Row: {
                    "cols": (string)[],"data_version": string,"date": string,"puzzle_number": number,"rows": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "cols": (string)[],"data_version": string,"date": string,"puzzle_number": number,"rows": (string)[]
                  }
                  Update: {
                    "cols"?: (string)[],"data_version"?: string,"date"?: string,"puzzle_number"?: number,"rows"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"reserved_names": {
                  Row: {
                    "term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "term": string
                  }
                  Update: {
                    "term"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trainees": {
                  Row: {
                    "character_id": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "character_id": string,"id": string
                  }
                  Update: {
                    "character_id"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_daily":
{ Args: { "p_puzzle": number }; Returns: Json
                           },
"get_my_history":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_rarity":
{ Args: { "p_puzzle": number }; Returns: Json
                           },
"give_up":
{ Args: { "p_index": number,"p_puzzle": number }; Returns: Json
                           },
"import_local":
{ Args: { "p_history": Json,"p_sessions": Json }; Returns: Json
                           },
"record_guess":
{ Args: { "p_cell": number,"p_index": number,"p_puzzle": number,"p_trainee": string }; Returns: Json
                           },
"submit_guest_result":
{ Args: { "p_gave_up": boolean,"p_guesses": Json,"p_puzzle": number }; Returns: Json
                           },
"update_profile":
{ Args: { "p_display_name"?: string,"p_opt_out"?: boolean }; Returns: Json
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
