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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          sender_user_id: string
          thread_id: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          sender_user_id: string
          thread_id: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_thread_reads: {
        Row: {
          created_at: string
          last_read_at: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_read_at?: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_read_at?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_thread_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          company_id: string
          created_at: string
          id: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      coc_certificates: {
        Row: {
          certificate_no: string | null
          certificate_number: string
          certificate_type: string | null
          company_id: string | null
          created_at: string | null
          customer_id: string
          data: Json | null
          expiry_date: string | null
          id: string
          issued_at: string | null
          issued_date: string
          job_card_id: string | null
          site_id: string | null
          status: string | null
          test_report: Json | null
          updated_at: string | null
        }
        Insert: {
          certificate_no?: string | null
          certificate_number?: string
          certificate_type?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_id: string
          data?: Json | null
          expiry_date?: string | null
          id?: string
          issued_at?: string | null
          issued_date: string
          job_card_id?: string | null
          site_id?: string | null
          status?: string | null
          test_report?: Json | null
          updated_at?: string | null
        }
        Update: {
          certificate_no?: string | null
          certificate_number?: string
          certificate_type?: string | null
          company_id?: string | null
          created_at?: string | null
          customer_id?: string
          data?: Json | null
          expiry_date?: string | null
          id?: string
          issued_at?: string | null
          issued_date?: string
          job_card_id?: string | null
          site_id?: string | null
          status?: string | null
          test_report?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          callout_fee_cents: string | null
          callout_radius_km: string | null
          compliance_progress: number
          compliance_status: string
          compliance_updated_at: string
          created_at: string
          id: string
          included_techs: number
          industry: string
          labour_overhead_percent: string | null
          logo_url: string | null
          name: string
          per_tech_price_cents: number
          phone: string | null
          profile_complete: boolean
          public_key: string
          subscription_status: string
          subscription_tier: string
          team_size: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          callout_fee_cents?: string | null
          callout_radius_km?: string | null
          compliance_progress?: number
          compliance_status?: string
          compliance_updated_at?: string
          created_at?: string
          id?: string
          included_techs?: number
          industry: string
          labour_overhead_percent?: string | null
          logo_url?: string | null
          name: string
          per_tech_price_cents?: number
          phone?: string | null
          profile_complete?: boolean
          public_key?: string
          subscription_status?: string
          subscription_tier?: string
          team_size?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          callout_fee_cents?: string | null
          callout_radius_km?: string | null
          compliance_progress?: number
          compliance_status?: string
          compliance_updated_at?: string
          created_at?: string
          id?: string
          included_techs?: number
          industry?: string
          labour_overhead_percent?: string | null
          logo_url?: string | null
          name?: string
          per_tech_price_cents?: number
          phone?: string | null
          profile_complete?: boolean
          public_key?: string
          subscription_status?: string
          subscription_tier?: string
          team_size?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_compliance_documents: {
        Row: {
          company_id: string
          created_at: string
          id: string
          industry: string | null
          kind: string
          label: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          industry?: string | null
          kind: string
          label: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          industry?: string | null
          kind?: string
          label?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_compliance_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          billing_email: string | null
          billing_phone: string | null
          billing_reference: string | null
          code: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: number | null
          phone: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_reference?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          billing_email?: string | null
          billing_phone?: string | null
          billing_reference?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          company_id: string
          created_at: string
          expiry_date: string | null
          id: string
          location: string | null
          name: string
          perishable: boolean
          quantity_on_hand: number
          reorder_point: number
          sku: string | null
          trade_id: string
          unit: Database["public"]["Enums"]["inventory_unit"]
          unit_cost_cents: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          location?: string | null
          name: string
          perishable?: boolean
          quantity_on_hand?: number
          reorder_point?: number
          sku?: string | null
          trade_id: string
          unit?: Database["public"]["Enums"]["inventory_unit"]
          unit_cost_cents?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          location?: string | null
          name?: string
          perishable?: boolean
          quantity_on_hand?: number
          reorder_point?: number
          sku?: string | null
          trade_id?: string
          unit?: Database["public"]["Enums"]["inventory_unit"]
          unit_cost_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          paid_at: string
          payment_method: string
          proof_storage_path: string | null
          reference: string | null
        }
        Insert: {
          amount_cents?: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          paid_at?: string
          payment_method?: string
          proof_storage_path?: string | null
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          paid_at?: string
          payment_method?: string
          proof_storage_path?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_cents: number
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          invoice_number: string
          job_card_id: string
          labour_minutes: number
          labour_rate_cents: number
          labour_total_cents: number
          line_items: Json
          notes: string | null
          parts_total_cents: number
          sent_at: string | null
          status: string
          subtotal_cents: number
          total_cents: number
          updated_at: string
          vat_cents: number
          vat_percent: number
        }
        Insert: {
          amount_paid_cents?: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_number: string
          job_card_id: string
          labour_minutes?: number
          labour_rate_cents?: number
          labour_total_cents?: number
          line_items?: Json
          notes?: string | null
          parts_total_cents?: number
          sent_at?: string | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          vat_cents?: number
          vat_percent?: number
        }
        Update: {
          amount_paid_cents?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_number?: string
          job_card_id?: string
          labour_minutes?: number
          labour_rate_cents?: number
          labour_total_cents?: number
          line_items?: Json
          notes?: string | null
          parts_total_cents?: number
          sent_at?: string | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          vat_cents?: number
          vat_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          checklist: Json
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          id: string
          notes: string | null
          priority: string
          revenue_cents: number | null
          scheduled_at: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["job_card_status"]
          technician_id: string | null
          title: string
          trade_id: string
          updated_at: string
        }
        Insert: {
          checklist?: Json
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: string
          revenue_cents?: number | null
          scheduled_at?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["job_card_status"]
          technician_id?: string | null
          title: string
          trade_id: string
          updated_at?: string
        }
        Update: {
          checklist?: Json
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          priority?: string
          revenue_cents?: number | null
          scheduled_at?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["job_card_status"]
          technician_id?: string | null
          title?: string
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          job_card_id: string
          kind: string
          storage_path: string
          taken_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          job_card_id: string
          kind?: string
          storage_path: string
          taken_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          job_card_id?: string
          kind?: string
          storage_path?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      job_time_entries: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          job_card_id: string
          minutes: number | null
          notes: string | null
          started_at: string
          technician_id: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_card_id: string
          minutes?: number | null
          notes?: string | null
          started_at?: string
          technician_id?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          job_card_id?: string
          minutes?: number | null
          notes?: string | null
          started_at?: string
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_time_entries_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_time_entries_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          status: string
          trade: string | null
          updated_at: string
          widget_installation_id: string | null
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
          widget_installation_id?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
          widget_installation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_widget_installation_id_fkey"
            columns: ["widget_installation_id"]
            isOneToOne: false
            referencedRelation: "widget_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_documents: {
        Row: {
          created_at: string
          id: string
          job_card_id: string | null
          kind: string
          metadata: Json | null
          site_id: string
          storage_path: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_card_id?: string | null
          kind?: string
          metadata?: Json | null
          site_id: string
          storage_path: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          job_card_id?: string | null
          kind?: string
          metadata?: Json | null
          site_id?: string
          storage_path?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_documents_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_documents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_material_usage: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          job_card_id: string
          notes: string | null
          quantity_used: number
          site_id: string
          used_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          job_card_id: string
          notes?: string | null
          quantity_used?: number
          site_id: string
          used_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          job_card_id?: string
          notes?: string | null
          quantity_used?: number
          site_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_material_usage_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_material_usage_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_material_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_team_assignments: {
        Row: {
          assigned_at: string
          company_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          notes: string | null
          site_id: string
          starts_at: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          company_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          site_id: string
          starts_at?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          company_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          site_id?: string
          starts_at?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          address: string | null
          billing_reference: string | null
          code: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string | null
          gps_lat: string | null
          gps_lng: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          scope_of_work: string | null
          scope_template: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_reference?: string | null
          code?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          gps_lat?: string | null
          gps_lng?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          scope_of_work?: string | null
          scope_template?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_reference?: string | null
          code?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string | null
          gps_lat?: string | null
          gps_lng?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          scope_of_work?: string | null
          scope_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_batteries: {
        Row: {
          capacity_kwh: number | null
          company_id: string
          created_at: string
          id: string
          manufacturer: string | null
          model: string | null
          notes: string | null
          serial: string
        }
        Insert: {
          capacity_kwh?: number | null
          company_id: string
          created_at?: string
          id?: string
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          serial: string
        }
        Update: {
          capacity_kwh?: number | null
          company_id?: string
          created_at?: string
          id?: string
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          serial?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_batteries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_panel_models: {
        Row: {
          company_id: string
          created_at: string
          id: string
          manufacturer: string | null
          model: string
          sku: string | null
          wattage: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          manufacturer?: string | null
          model: string
          sku?: string | null
          wattage?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          manufacturer?: string | null
          model?: string
          sku?: string | null
          wattage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_panel_models_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_project_batteries: {
        Row: {
          battery_id: string
          created_at: string
          id: string
          installed_at: string | null
          project_id: string
          removed_at: string | null
          status: string
        }
        Insert: {
          battery_id: string
          created_at?: string
          id?: string
          installed_at?: string | null
          project_id: string
          removed_at?: string | null
          status?: string
        }
        Update: {
          battery_id?: string
          created_at?: string
          id?: string
          installed_at?: string | null
          project_id?: string
          removed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_project_batteries_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "solar_batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_project_batteries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "solar_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_project_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          label: string
          project_id: string
          required: boolean
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label: string
          project_id: string
          required?: boolean
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "solar_project_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "solar_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_project_panels: {
        Row: {
          created_at: string
          id: string
          panel_model_id: string
          project_id: string
          quantity_allocated: number
          quantity_installed: number
        }
        Insert: {
          created_at?: string
          id?: string
          panel_model_id: string
          project_id: string
          quantity_allocated?: number
          quantity_installed?: number
        }
        Update: {
          created_at?: string
          id?: string
          panel_model_id?: string
          project_id?: string
          quantity_allocated?: number
          quantity_installed?: number
        }
        Relationships: [
          {
            foreignKeyName: "solar_project_panels_panel_model_id_fkey"
            columns: ["panel_model_id"]
            isOneToOne: false
            referencedRelation: "solar_panel_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_project_panels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "solar_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_project_signoffs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          project_id: string
          signed_at: string | null
          signed_by: string | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          step: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_project_signoffs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "solar_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_projects: {
        Row: {
          company_id: string
          created_at: string
          id: string
          notes: string | null
          site_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          site_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_projects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      technician_locations: {
        Row: {
          accuracy: number | null
          company_id: string | null
          created_at: string | null
          heading: string | null
          id: string
          job_card_id: string | null
          lat: string | null
          latitude: number
          lng: string | null
          longitude: number
          recorded_at: string | null
          site_id: string | null
          speed: string | null
          technician_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          company_id?: string | null
          created_at?: string | null
          heading?: string | null
          id?: string
          job_card_id?: string | null
          lat?: string | null
          latitude: number
          lng?: string | null
          longitude: number
          recorded_at?: string | null
          site_id?: string | null
          speed?: string | null
          technician_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          company_id?: string | null
          created_at?: string | null
          heading?: string | null
          id?: string
          job_card_id?: string | null
          lat?: string | null
          latitude?: number
          lng?: string | null
          longitude?: number
          recorded_at?: string | null
          site_id?: string | null
          speed?: string | null
          technician_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_technician"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          email: string | null
          hourly_bill_rate_cents: number | null
          hourly_cost_cents: number | null
          id: string
          invite_status: string
          name: string
          phone: string | null
          trades: string[]
          user_id: string | null
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          email?: string | null
          hourly_bill_rate_cents?: number | null
          hourly_cost_cents?: number | null
          id?: string
          invite_status?: string
          name: string
          phone?: string | null
          trades?: string[]
          user_id?: string | null
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          email?: string | null
          hourly_bill_rate_cents?: number | null
          hourly_cost_cents?: number | null
          id?: string
          invite_status?: string
          name?: string
          phone?: string | null
          trades?: string[]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          is_completed: boolean
          tutorial_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          is_completed?: boolean
          tutorial_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          is_completed?: boolean
          tutorial_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      widget_installations: {
        Row: {
          allowed_domains: string[]
          company_id: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          allowed_domains?: string[]
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          allowed_domains?: string[]
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_installations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_company: { Args: { _user_id: string }; Returns: boolean }
      create_company_for_current_user: {
        Args: { _industry: string; _name: string; _team_size?: string }
        Returns: string
      }
      ensure_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      generate_invoice_number: {
        Args: { _company_id: string }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_technician_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "office_staff" | "technician"
      inventory_unit: "each" | "meter" | "liter" | "kg" | "box"
      job_card_status:
        | "new"
        | "scheduled"
        | "in-progress"
        | "completed"
        | "invoiced"
        | "cancelled"
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
      app_role: ["owner", "admin", "office_staff", "technician"],
      inventory_unit: ["each", "meter", "liter", "kg", "box"],
      job_card_status: [
        "new",
        "scheduled",
        "in-progress",
        "completed",
        "invoiced",
        "cancelled",
      ],
    },
  },
} as const
