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
          city: string | null
          created_at: string
          customer_id: string | null
          id: string
          name: string
          pic_contact: string
          pic_email: string
          pic_name: string
          region: string
          sales_id: string
          segment: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          name: string
          pic_contact?: string
          pic_email?: string
          pic_name?: string
          region?: string
          sales_id: string
          segment?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          name?: string
          pic_contact?: string
          pic_email?: string
          pic_name?: string
          region?: string
          sales_id?: string
          segment?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      deal_deletion_requests: {
        Row: {
          created_at: string
          deal_id: string
          deal_snapshot: Json
          id: string
          reason: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          deal_snapshot?: Json
          id?: string
          reason: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          deal_snapshot?: Json
          id?: string
          reason?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_deletion_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_products: {
        Row: {
          category: string
          created_at: string
          deal_id: string
          id: string
          other_cost: number
          price_per_unit: number
          product_name: string
          qty: number
          unit: string
        }
        Insert: {
          category?: string
          created_at?: string
          deal_id: string
          id?: string
          other_cost?: number
          price_per_unit?: number
          product_name?: string
          qty?: number
          unit?: string
        }
        Update: {
          category?: string
          created_at?: string
          deal_id?: string
          id?: string
          other_cost?: number
          price_per_unit?: number
          product_name?: string
          qty?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          account_id: string
          created_at: string
          days_in_stage: number
          expected_close_date: string
          expected_margin: number | null
          id: string
          location: string | null
          name: string
          notes: string | null
          po_number: string | null
          probability: number
          revenue_date: string | null
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
          expected_margin?: number | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          po_number?: string | null
          probability?: number
          revenue_date?: string | null
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
          expected_margin?: number | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          po_number?: string | null
          probability?: number
          revenue_date?: string | null
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
      kpi_master: {
        Row: {
          calculation_type: string
          created_at: string
          default_cap: number | null
          definition_notes: string | null
          direction: string
          green_threshold_pct: number
          id: string
          is_active: boolean
          kpi_category: Database["public"]["Enums"]["kpi_category"] | null
          kpi_code: string
          kpi_name: string
          red_threshold_pct: number
          score_cap_pct: number
          threshold_green: number
          threshold_red: number
          threshold_yellow: number
          unit_type: string
          updated_at: string
          yellow_threshold_pct: number
        }
        Insert: {
          calculation_type?: string
          created_at?: string
          default_cap?: number | null
          definition_notes?: string | null
          direction?: string
          green_threshold_pct?: number
          id?: string
          is_active?: boolean
          kpi_category?: Database["public"]["Enums"]["kpi_category"] | null
          kpi_code: string
          kpi_name: string
          red_threshold_pct?: number
          score_cap_pct?: number
          threshold_green?: number
          threshold_red?: number
          threshold_yellow?: number
          unit_type?: string
          updated_at?: string
          yellow_threshold_pct?: number
        }
        Update: {
          calculation_type?: string
          created_at?: string
          default_cap?: number | null
          definition_notes?: string | null
          direction?: string
          green_threshold_pct?: number
          id?: string
          is_active?: boolean
          kpi_category?: Database["public"]["Enums"]["kpi_category"] | null
          kpi_code?: string
          kpi_name?: string
          red_threshold_pct?: number
          score_cap_pct?: number
          threshold_green?: number
          threshold_red?: number
          threshold_yellow?: number
          unit_type?: string
          updated_at?: string
          yellow_threshold_pct?: number
        }
        Relationships: []
      }
      kpi_monthly_targets: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kpi_id: string
          month: number
          source: Database["public"]["Enums"]["kpi_target_source"]
          target_pct: number | null
          target_value: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kpi_id: string
          month: number
          source?: Database["public"]["Enums"]["kpi_target_source"]
          target_pct?: number | null
          target_value?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kpi_id?: string
          month?: number
          source?: Database["public"]["Enums"]["kpi_target_source"]
          target_pct?: number | null
          target_value?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_monthly_targets_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_results_monthly: {
        Row: {
          achievement_pct: number | null
          achievement_ratio: number | null
          actual_pct: number | null
          actual_value: number | null
          calculated_at: string
          id: string
          kpi_id: string
          month: number
          status: Database["public"]["Enums"]["kpi_result_status"] | null
          target_pct: number | null
          target_value: number | null
          user_id: string
          weight_pct: number | null
          weighted_score: number | null
          year: number
        }
        Insert: {
          achievement_pct?: number | null
          achievement_ratio?: number | null
          actual_pct?: number | null
          actual_value?: number | null
          calculated_at?: string
          id?: string
          kpi_id: string
          month: number
          status?: Database["public"]["Enums"]["kpi_result_status"] | null
          target_pct?: number | null
          target_value?: number | null
          user_id: string
          weight_pct?: number | null
          weighted_score?: number | null
          year: number
        }
        Update: {
          achievement_pct?: number | null
          achievement_ratio?: number | null
          actual_pct?: number | null
          actual_value?: number | null
          calculated_at?: string
          id?: string
          kpi_id?: string
          month?: number
          status?: Database["public"]["Enums"]["kpi_result_status"] | null
          target_pct?: number | null
          target_value?: number | null
          user_id?: string
          weight_pct?: number | null
          weighted_score?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_results_monthly_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_submissions: {
        Row: {
          created_at: string
          evidence_url: string | null
          id: string
          kpi_id: string
          month: number
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_value: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          kpi_id: string
          month: number
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_value?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          kpi_id?: string
          month?: number
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_value?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_submissions_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_template_items: {
        Row: {
          baseline_annual_target_pct: number | null
          baseline_annual_target_value: number | null
          created_at: string
          id: string
          kpi_id: string
          notes: string | null
          template_id: string
          weight_pct: number
        }
        Insert: {
          baseline_annual_target_pct?: number | null
          baseline_annual_target_value?: number | null
          created_at?: string
          id?: string
          kpi_id: string
          notes?: string | null
          template_id: string
          weight_pct?: number
        }
        Update: {
          baseline_annual_target_pct?: number | null
          baseline_annual_target_value?: number | null
          created_at?: string
          id?: string
          kpi_id?: string
          notes?: string | null
          template_id?: string
          weight_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_template_items_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kpi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position_id: string
          template_name: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position_id: string
          template_name: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position_id?: string
          template_name?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_templates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_total_score_monthly: {
        Row: {
          calculated_at: string
          id: string
          month: number
          status: Database["public"]["Enums"]["kpi_total_status"] | null
          total_score: number | null
          user_id: string
          year: number
        }
        Insert: {
          calculated_at?: string
          id?: string
          month: number
          status?: Database["public"]["Enums"]["kpi_total_status"] | null
          total_score?: number | null
          user_id: string
          year: number
        }
        Update: {
          calculated_at?: string
          id?: string
          month?: number
          status?: Database["public"]["Enums"]["kpi_total_status"] | null
          total_score?: number | null
          user_id?: string
          year?: number
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
      notification_preferences: {
        Row: {
          browser_push: boolean
          created_at: string
          deletion_alerts: boolean
          id: string
          low_activity: boolean
          low_margin: boolean
          overdue_invoice: boolean
          sound_enabled: boolean
          stagnant_deal: boolean
          updated_at: string
          user_id: string
          volume_level: string
        }
        Insert: {
          browser_push?: boolean
          created_at?: string
          deletion_alerts?: boolean
          id?: string
          low_activity?: boolean
          low_margin?: boolean
          overdue_invoice?: boolean
          sound_enabled?: boolean
          stagnant_deal?: boolean
          updated_at?: string
          user_id: string
          volume_level?: string
        }
        Update: {
          browser_push?: boolean
          created_at?: string
          deletion_alerts?: boolean
          id?: string
          low_activity?: boolean
          low_margin?: boolean
          overdue_invoice?: boolean
          sound_enabled?: boolean
          stagnant_deal?: boolean
          updated_at?: string
          user_id?: string
          volume_level?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          position_code: string
          position_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          position_code: string
          position_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          position_code?: string
          position_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
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
          purchase_price: number | null
          selling_price: number | null
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
          purchase_price?: number | null
          selling_price?: number | null
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
          purchase_price?: number | null
          selling_price?: number | null
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
          division: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          position_id: string | null
          region: string | null
          segment: string | null
          supervisor_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          division?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          position_id?: string | null
          region?: string | null
          segment?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          division?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          position_id?: string | null
          region?: string | null
          segment?: string | null
          supervisor_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_activities: {
        Row: {
          account_id: string | null
          activity_date: string
          cost: number | null
          created_at: string
          evidence_url: string | null
          id: string
          next_action_date: string | null
          notes: string | null
          outcome: string | null
          purpose: string | null
          sales_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          activity_date?: string
          cost?: number | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          purpose?: string | null
          sales_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          activity_date?: string
          cost?: number | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          next_action_date?: string | null
          notes?: string | null
          outcome?: string | null
          purpose?: string | null
          sales_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_activities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
      units: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
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
      get_active_sales_profiles: {
        Args: never
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_all_deal_products_pipeline: {
        Args: never
        Returns: {
          category: string
          created_at: string
          deal_id: string
          id: string
          other_cost: number
          price_per_unit: number
          product_name: string
          qty: number
          unit: string
        }[]
        SetofOptions: {
          from: "*"
          to: "deal_products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_all_deals_pipeline: {
        Args: never
        Returns: {
          account_id: string
          created_at: string
          days_in_stage: number
          expected_close_date: string
          expected_margin: number | null
          id: string
          location: string | null
          name: string
          notes: string | null
          po_number: string | null
          probability: number
          revenue_date: string | null
          sales_id: string
          segment: string
          stage: Database["public"]["Enums"]["deal_stage"]
          updated_at: string
          value: number
        }[]
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_executive_summary_kpis: {
        Args: { _current_month: number; _current_year: number }
        Returns: Json
      }
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
      is_supervisor_of: {
        Args: { _supervisor_user_id: string; _target_user_id: string }
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
        | "quotation"
        | "po_secured"
        | "invoice_issued"
        | "canceled"
        | "lost"
      kpi_category:
        | "GROWTH"
        | "PROFITABILITY"
        | "COMPLIANCE"
        | "PRODUCTIVITY"
        | "DISCIPLINE"
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
      kpi_result_status: "GREEN" | "YELLOW" | "RED"
      kpi_target_source: "MANUAL" | "IMPORT" | "AUTO"
      kpi_total_status: "EXCELLENT" | "ON_TRACK" | "NEED_IMPROVEMENT"
      org_role:
        | "sales_manager"
        | "supervisor"
        | "sales_person"
        | "representative_management"
        | "ceo_director"
        | "commissioner"
        | "manager"
        | "staff_operational"
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
        "quotation",
        "po_secured",
        "invoice_issued",
        "canceled",
        "lost",
      ],
      kpi_category: [
        "GROWTH",
        "PROFITABILITY",
        "COMPLIANCE",
        "PRODUCTIVITY",
        "DISCIPLINE",
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
      kpi_result_status: ["GREEN", "YELLOW", "RED"],
      kpi_target_source: ["MANUAL", "IMPORT", "AUTO"],
      kpi_total_status: ["EXCELLENT", "ON_TRACK", "NEED_IMPROVEMENT"],
      org_role: [
        "sales_manager",
        "supervisor",
        "sales_person",
        "representative_management",
        "ceo_director",
        "commissioner",
        "manager",
        "staff_operational",
      ],
      system_role: ["super_admin", "admin", "staff", "viewer"],
    },
  },
} as const
