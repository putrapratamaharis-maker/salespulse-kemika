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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string
          sales_id: string
          segment: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region?: string
          sales_id: string
          segment?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string
          sales_id?: string
          segment?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          account_id: string
          created_at: string
          days_in_stage: number
          expected_close_date: string
          id: string
          name: string
          probability: number
          sales_id: string
          segment: string
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
          value: number
        }
        Insert: {
          account_id: string
          created_at?: string
          days_in_stage?: number
          expected_close_date: string
          id?: string
          name: string
          probability?: number
          sales_id: string
          segment?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          value?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          days_in_stage?: number
          expected_close_date?: string
          id?: string
          name?: string
          probability?: number
          sales_id?: string
          segment?: string
          stage?: Database["public"]["Enums"]["deal_stage"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string
          created_at: string
          due_date: string
          gross_profit: number
          id: string
          invoice_number: string
          issue_date: string
          net_sales: number
          paid_date: string | null
          sales_id: string
          segment: string
        }
        Insert: {
          account_id: string
          created_at?: string
          due_date: string
          gross_profit?: number
          id?: string
          invoice_number: string
          issue_date: string
          net_sales?: number
          paid_date?: string | null
          sales_id: string
          segment?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          due_date?: string
          gross_profit?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          net_sales?: number
          paid_date?: string | null
          sales_id?: string
          segment?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          created_at: string
          data_source: Database["public"]["Enums"]["kpi_data_source"]
          default_target: number
          default_weight: number
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          org_role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          created_at?: string
          data_source: Database["public"]["Enums"]["kpi_data_source"]
          default_target?: number
          default_weight?: number
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          org_role: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          created_at?: string
          data_source?: Database["public"]["Enums"]["kpi_data_source"]
          default_target?: number
          default_weight?: number
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          org_role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: []
      }
      kpi_user_configs: {
        Row: {
          created_at: string
          id: string
          kpi_definition_id: string
          month: string
          target: number | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_definition_id: string
          month: string
          target?: number | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kpi_definition_id?: string
          month?: string
          target?: number | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_user_configs_kpi_definition_id_fkey"
            columns: ["kpi_definition_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          created_at: string
          id: string
          month: string
          product_id: string
          revenue: number
          segment: string | null
          units_sold: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          product_id: string
          revenue?: number
          segment?: string | null
          units_sold?: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          product_id?: string
          revenue?: number
          segment?: string | null
          units_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sku: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sku?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sku?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          region: string | null
          segment: string | null
          supervisor_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          region?: string | null
          segment?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          region?: string | null
          segment?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          created_at: string
          id: string
          margin_target: number
          month: string
          revenue_target: number
          segment: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          margin_target?: number
          month: string
          revenue_target?: number
          segment?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          margin_target?: number
          month?: string
          revenue_target?: number
          segment?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          org_role: Database["public"]["Enums"]["org_role"]
          system_role: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          system_role?: Database["public"]["Enums"]["system_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          system_role?: Database["public"]["Enums"]["system_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_user_system_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["system_role"]
      }
      has_system_role: {
        Args: {
          _role: Database["public"]["Enums"]["system_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      deal_stage:
        | "prospect"
        | "qualification"
        | "proposal"
        | "negotiation"
        | "closed_won"
        | "closed_lost"
      kpi_data_source:
        | "revenue_achievement"
        | "margin_compliance"
        | "win_rate"
        | "pipeline_health"
        | "activity_count"
        | "team_activity_compliance"
        | "coaching_notes_given"
        | "rep_coverage"
        | "deal_volume"
        | "avg_deal_size"
        | "collection_rate"
        | "segment_specific"
      org_role:
        | "sales_manager"
        | "supervisor"
        | "sales_person"
        | "representative_management"
      system_role: "super_admin" | "admin" | "staff" | "viewer"
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
      deal_stage: [
        "prospect",
        "qualification",
        "proposal",
        "negotiation",
        "closed_won",
        "closed_lost",
      ],
      kpi_data_source: [
        "revenue_achievement",
        "margin_compliance",
        "win_rate",
        "pipeline_health",
        "activity_count",
        "team_activity_compliance",
        "coaching_notes_given",
        "rep_coverage",
        "deal_volume",
        "avg_deal_size",
        "collection_rate",
        "segment_specific",
      ],
      org_role: [
        "sales_manager",
        "supervisor",
        "sales_person",
        "representative_management",
      ],
      system_role: ["super_admin", "admin", "staff", "viewer"],
    },
  },
} as const
