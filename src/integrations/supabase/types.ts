export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      application_events: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          application_id: string
          created_at: string
          event_type: string
          from_value: string | null
          id: string
          to_value: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          event_type: string
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          event_type?: string
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          cover_note: string | null
          created_at: string
          current_company: string | null
          current_title: string | null
          email: string
          fit: string
          full_name: string
          honeypot: string | null
          id: string
          job_ad_id: string
          linkedin_url: string | null
          phone: string | null
          pipeline_status: string
          recruiter_notes: string | null
          resume_url: string | null
          screening_answers: Json
          shortlisted: boolean
          source: string
          stage_id: string | null
          updated_at: string
          years_of_experience: number | null
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          email: string
          fit?: string
          full_name: string
          honeypot?: string | null
          id?: string
          job_ad_id: string
          linkedin_url?: string | null
          phone?: string | null
          pipeline_status?: string
          recruiter_notes?: string | null
          resume_url?: string | null
          screening_answers?: Json
          shortlisted?: boolean
          source?: string
          stage_id?: string | null
          updated_at?: string
          years_of_experience?: number | null
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          email?: string
          fit?: string
          full_name?: string
          honeypot?: string | null
          id?: string
          job_ad_id?: string
          linkedin_url?: string | null
          phone?: string | null
          pipeline_status?: string
          recruiter_notes?: string | null
          resume_url?: string | null
          screening_answers?: Json
          shortlisted?: boolean
          source?: string
          stage_id?: string | null
          updated_at?: string
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_ad_id_fkey"
            columns: ["job_ad_id"]
            isOneToOne: false
            referencedRelation: "job_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "job_ad_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          auth_user_id: string | null
          contact_email: string | null
          contact_name: string | null
          contract_ad_allowance: number
          created_at: string
          id: string
          name: string
          notes: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contract_ad_allowance?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contract_ad_allowance?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_ad_stages: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          job_ad_id: string
          label: string
          legacy_status: string | null
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          job_ad_id: string
          label: string
          legacy_status?: string | null
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          job_ad_id?: string
          label?: string
          legacy_status?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_ad_stages_job_ad_id_fkey"
            columns: ["job_ad_id"]
            isOneToOne: false
            referencedRelation: "job_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      job_ads: {
        Row: {
          archived_at: string | null
          authorized_at: string | null
          authorized_by: string | null
          billing_triggered_at: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_billable: boolean
          jd_text: string | null
          jd_url: string | null
          linkedin_job_url: string | null
          posting_fee: number | null
          roles_count: number
          slug: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          authorized_at?: string | null
          authorized_by?: string | null
          billing_triggered_at?: string | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_billable?: boolean
          jd_text?: string | null
          jd_url?: string | null
          linkedin_job_url?: string | null
          posting_fee?: number | null
          roles_count?: number
          slug: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          authorized_at?: string | null
          authorized_by?: string | null
          billing_triggered_at?: string | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_billable?: boolean
          jd_text?: string | null
          jd_url?: string | null
          linkedin_job_url?: string | null
          posting_fee?: number | null
          roles_count?: number
          slug?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_ads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          currency: string
          id: string
          job_ad_id: string
          notes: string | null
          paid_at: string | null
          status: string
          triggered_by: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          job_ad_id: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          triggered_by?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          job_ad_id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          triggered_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_ad_id_fkey"
            columns: ["job_ad_id"]
            isOneToOne: false
            referencedRelation: "job_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_for_job: {
        Args: { _job_ad_id: string; _user_id: string }
        Returns: boolean
      }
      is_recruiter_or_admin: { Args: { _user_id: string }; Returns: boolean }
      slugify: { Args: { _input: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "member" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "recruiter", "member", "client"],
    },
  },
} as const
