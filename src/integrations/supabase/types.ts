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
      application_logs: {
        Row: {
          company_id: string | null
          context: Json | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_stack: string | null
          id: string
          level: string
          message: string
          request_id: string | null
          service: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          context?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_stack?: string | null
          id?: string
          level?: string
          message: string
          request_id?: string | null
          service: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          context?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_stack?: string | null
          id?: string
          level?: string
          message?: string
          request_id?: string | null
          service?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_imports: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_log: Json | null
          failed_records: number | null
          file_name: string
          file_url: string | null
          id: string
          imported_by: string | null
          mapping_config: Json | null
          processed_records: number | null
          status: string
          total_records: number | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          failed_records?: number | null
          file_name: string
          file_url?: string | null
          id?: string
          imported_by?: string | null
          mapping_config?: Json | null
          processed_records?: number | null
          status?: string
          total_records?: number | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          failed_records?: number | null
          file_name?: string
          file_url?: string | null
          id?: string
          imported_by?: string | null
          mapping_config?: Json | null
          processed_records?: number | null
          status?: string
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_summaries: {
        Row: {
          calculated_from: string | null
          calculated_to: string | null
          company_id: string
          created_at: string
          days_late: number
          days_present: number
          employee_id: string
          full_day_absents: number
          half_day_absents: number
          id: string
          is_locked: boolean
          late_minutes: number | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          overtime_hours: number
          paid_leave_days: number | null
          payroll_run_id: string | null
          period_end: string
          period_start: string
          total_working_days: number
          total_working_hours: number
          unpaid_leave_days: number | null
          updated_at: string
        }
        Insert: {
          calculated_from?: string | null
          calculated_to?: string | null
          company_id: string
          created_at?: string
          days_late?: number
          days_present?: number
          employee_id: string
          full_day_absents?: number
          half_day_absents?: number
          id?: string
          is_locked?: boolean
          late_minutes?: number | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          overtime_hours?: number
          paid_leave_days?: number | null
          payroll_run_id?: string | null
          period_end: string
          period_start: string
          total_working_days?: number
          total_working_hours?: number
          unpaid_leave_days?: number | null
          updated_at?: string
        }
        Update: {
          calculated_from?: string | null
          calculated_to?: string | null
          company_id?: string
          created_at?: string
          days_late?: number
          days_present?: number
          employee_id?: string
          full_day_absents?: number
          half_day_absents?: number
          id?: string
          is_locked?: boolean
          late_minutes?: number | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          overtime_hours?: number
          paid_leave_days?: number | null
          payroll_run_id?: string | null
          period_end?: string
          period_start?: string
          total_working_days?: number
          total_working_hours?: number
          unpaid_leave_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_summaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_summaries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_role: string | null
          company_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          severity: string | null
          table_name: string
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_role?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          severity?: string | null
          table_name: string
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_role?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          severity?: string | null
          table_name?: string
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_logs: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          currency: string | null
          event_type: string
          id: string
          metadata: Json | null
          plan_id: string | null
          previous_plan_id: string | null
          subscription_id: string | null
          triggered_by: string | null
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          currency?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          previous_plan_id?: string | null
          subscription_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          currency?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          previous_plan_id?: string | null
          subscription_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_logs_previous_plan_id_fkey"
            columns: ["previous_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "company_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_auth_config: {
        Row: {
          auth_enabled: boolean | null
          auth_methods: string[] | null
          company_id: string
          created_at: string
          google_enabled: boolean | null
          id: string
          linkedin_enabled: boolean | null
          magic_link_enabled: boolean | null
          require_login_to_apply: boolean | null
          social_login_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          auth_enabled?: boolean | null
          auth_methods?: string[] | null
          company_id: string
          created_at?: string
          google_enabled?: boolean | null
          id?: string
          linkedin_enabled?: boolean | null
          magic_link_enabled?: boolean | null
          require_login_to_apply?: boolean | null
          social_login_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          auth_enabled?: boolean | null
          auth_methods?: string[] | null
          company_id?: string
          created_at?: string
          google_enabled?: boolean | null
          id?: string
          linkedin_enabled?: boolean | null
          magic_link_enabled?: boolean | null
          require_login_to_apply?: boolean | null
          social_login_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_auth_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_screenings: {
        Row: {
          access_token: string
          answers: Json | null
          assigned_at: string
          assigned_by: string | null
          candidate_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          evaluation_notes: string | null
          expires_at: string
          id: string
          score: number | null
          screening_test_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["screening_status"]
          updated_at: string
        }
        Insert: {
          access_token?: string
          answers?: Json | null
          assigned_at?: string
          assigned_by?: string | null
          candidate_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluation_notes?: string | null
          expires_at: string
          id?: string
          score?: number | null
          screening_test_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["screening_status"]
          updated_at?: string
        }
        Update: {
          access_token?: string
          answers?: Json | null
          assigned_at?: string
          assigned_by?: string | null
          candidate_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evaluation_notes?: string | null
          expires_at?: string
          id?: string
          score?: number | null
          screening_test_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["screening_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_screenings_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_screenings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_screenings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_screenings_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_screenings_screening_test_id_fkey"
            columns: ["screening_test_id"]
            isOneToOne: false
            referencedRelation: "screening_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_timeline: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_timeline_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_timeline_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_timeline_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_users: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          linkedin_url: string | null
          phone: string | null
          profile_data: Json | null
          resume_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          profile_data?: Json | null
          resume_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          profile_data?: Json | null
          resume_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          availability_date: string | null
          candidate_user_id: string | null
          company_id: string
          cover_letter: string | null
          created_at: string
          current_stage_started_at: string | null
          email: string
          expected_salary: number | null
          expected_salary_currency: string | null
          first_name: string
          hired_employee_id: string | null
          id: string
          interview_notes: Json | null
          job_id: string
          last_name: string
          linkedin_url: string | null
          metadata: Json | null
          notes: Json | null
          notice_period_days: number | null
          overall_rating: number | null
          phone: string | null
          portfolio_url: string | null
          rating: number | null
          referral_employee_id: string | null
          rejected_reason: string | null
          resume_url: string | null
          source: string | null
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
        }
        Insert: {
          availability_date?: string | null
          candidate_user_id?: string | null
          company_id: string
          cover_letter?: string | null
          created_at?: string
          current_stage_started_at?: string | null
          email: string
          expected_salary?: number | null
          expected_salary_currency?: string | null
          first_name: string
          hired_employee_id?: string | null
          id?: string
          interview_notes?: Json | null
          job_id: string
          last_name: string
          linkedin_url?: string | null
          metadata?: Json | null
          notes?: Json | null
          notice_period_days?: number | null
          overall_rating?: number | null
          phone?: string | null
          portfolio_url?: string | null
          rating?: number | null
          referral_employee_id?: string | null
          rejected_reason?: string | null
          resume_url?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
        }
        Update: {
          availability_date?: string | null
          candidate_user_id?: string | null
          company_id?: string
          cover_letter?: string | null
          created_at?: string
          current_stage_started_at?: string | null
          email?: string
          expected_salary?: number | null
          expected_salary_currency?: string | null
          first_name?: string
          hired_employee_id?: string | null
          id?: string
          interview_notes?: Json | null
          job_id?: string
          last_name?: string
          linkedin_url?: string | null
          metadata?: Json | null
          notes?: Json | null
          notice_period_days?: number | null
          overall_rating?: number | null
          phone?: string | null
          portfolio_url?: string | null
          rating?: number | null
          referral_employee_id?: string | null
          rejected_reason?: string | null
          resume_url?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "candidate_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_hired_employee_id_fkey"
            columns: ["hired_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_referral_employee_id_fkey"
            columns: ["referral_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: Json | null
          created_at: string
          date_format: string | null
          email: string | null
          fiscal_year_start: number | null
          id: string
          industry: string | null
          is_active: boolean | null
          is_test_company: boolean | null
          logo_url: string | null
          name: string
          pf_employee_rate: number | null
          pf_employer_rate: number | null
          pf_enabled: boolean | null
          phone: string | null
          settings: Json | null
          size_range: string | null
          slug: string
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string
          date_format?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_test_company?: boolean | null
          logo_url?: string | null
          name: string
          pf_employee_rate?: number | null
          pf_employer_rate?: number | null
          pf_enabled?: boolean | null
          phone?: string | null
          settings?: Json | null
          size_range?: string | null
          slug: string
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string
          date_format?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_test_company?: boolean | null
          logo_url?: string | null
          name?: string
          pf_employee_rate?: number | null
          pf_employer_rate?: number | null
          pf_enabled?: boolean | null
          phone?: string | null
          settings?: Json | null
          size_range?: string | null
          slug?: string
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_creation_links: {
        Row: {
          billing_interval: string | null
          created_at: string | null
          created_by: string
          email: string | null
          enable_trial: boolean | null
          expires_at: string
          id: string
          max_uses: number | null
          modules: Json | null
          notes: string | null
          plan_id: string | null
          token: string
          trial_days: number | null
          used_at: string | null
          used_by_company_id: string | null
          uses: number | null
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          enable_trial?: boolean | null
          expires_at: string
          id?: string
          max_uses?: number | null
          modules?: Json | null
          notes?: string | null
          plan_id?: string | null
          token?: string
          trial_days?: number | null
          used_at?: string | null
          used_by_company_id?: string | null
          uses?: number | null
        }
        Update: {
          billing_interval?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          enable_trial?: boolean | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          modules?: Json | null
          notes?: string | null
          plan_id?: string | null
          token?: string
          trial_days?: number | null
          used_at?: string | null
          used_by_company_id?: string | null
          uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_creation_links_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_creation_links_used_by_company_id_fkey"
            columns: ["used_by_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_domains: {
        Row: {
          company_id: string
          created_at: string | null
          custom_domain: string | null
          hosting_provider: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          is_verified: boolean | null
          subdomain: string | null
          updated_at: string | null
          vercel_domain_id: string | null
          vercel_error: string | null
          vercel_status: string | null
          vercel_verified: boolean | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          custom_domain?: string | null
          hosting_provider?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          is_verified?: boolean | null
          subdomain?: string | null
          updated_at?: string | null
          vercel_domain_id?: string | null
          vercel_error?: string | null
          vercel_status?: string | null
          vercel_verified?: boolean | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          custom_domain?: string | null
          hosting_provider?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          is_verified?: boolean | null
          subdomain?: string | null
          updated_at?: string | null
          vercel_domain_id?: string | null
          vercel_error?: string | null
          vercel_status?: string | null
          vercel_verified?: boolean | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_email_settings: {
        Row: {
          api_key: string | null
          aws_access_key_id: string | null
          aws_region: string | null
          aws_secret_access_key: string | null
          company_id: string
          created_at: string
          from_email: string | null
          from_name: string | null
          id: string
          is_verified: boolean | null
          last_test_at: string | null
          last_test_result: Json | null
          provider: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_username: string | null
          updated_at: string
          use_platform_default: boolean
          verified_at: string | null
        }
        Insert: {
          api_key?: string | null
          aws_access_key_id?: string | null
          aws_region?: string | null
          aws_secret_access_key?: string | null
          company_id: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_verified?: boolean | null
          last_test_at?: string | null
          last_test_result?: Json | null
          provider?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          updated_at?: string
          use_platform_default?: boolean
          verified_at?: string | null
        }
        Update: {
          api_key?: string | null
          aws_access_key_id?: string | null
          aws_region?: string | null
          aws_secret_access_key?: string | null
          company_id?: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_verified?: boolean | null
          last_test_at?: string | null
          last_test_result?: Json | null
          provider?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          updated_at?: string
          use_platform_default?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_email_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_email_templates: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          display_name: string
          html_template: string | null
          id: string
          is_enabled: boolean | null
          plain_text_template: string | null
          sender_email: string | null
          sender_name: string | null
          subject_template: string | null
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          display_name: string
          html_template?: string | null
          id?: string
          is_enabled?: boolean | null
          plain_text_template?: string | null
          sender_email?: string | null
          sender_name?: string | null
          subject_template?: string | null
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          html_template?: string | null
          id?: string
          is_enabled?: boolean | null
          plain_text_template?: string | null
          sender_email?: string | null
          sender_name?: string | null
          subject_template?: string | null
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "company_email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_roles: {
        Row: {
          company_id: string
          created_at: string | null
          custom_name: string | null
          description: string | null
          id: string
          is_active: boolean | null
          permission_overrides: Json | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          custom_name?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          permission_overrides?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          custom_name?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          permission_overrides?: Json | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_roles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          billing_interval: Database["public"]["Enums"]["plan_interval"]
          canceled_at: string | null
          company_id: string
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          metadata: Json | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_total_days: number | null
          updated_at: string
        }
        Insert: {
          billing_interval?: Database["public"]["Enums"]["plan_interval"]
          canceled_at?: string | null
          company_id: string
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_total_days?: number | null
          updated_at?: string
        }
        Update: {
          billing_interval?: Database["public"]["Enums"]["plan_interval"]
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_total_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          is_primary: boolean | null
          joined_at: string | null
          permissions: Json | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          joined_at?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          is_primary?: boolean | null
          joined_at?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          company_id: string
          cost_center: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          cost_center?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          cost_center?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_departments_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          access_granted: boolean
          access_type: string
          accessed_by: string
          company_id: string
          created_at: string
          denial_reason: string | null
          document_id: string
          id: string
          ip_address_masked: string | null
          user_agent: string | null
        }
        Insert: {
          access_granted?: boolean
          access_type: string
          accessed_by: string
          company_id: string
          created_at?: string
          denial_reason?: string | null
          document_id: string
          id?: string
          ip_address_masked?: string | null
          user_agent?: string | null
        }
        Update: {
          access_granted?: boolean
          access_type?: string
          accessed_by?: string
          company_id?: string
          created_at?: string
          denial_reason?: string | null
          document_id?: string
          id?: string
          ip_address_masked?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_expiry_notifications: {
        Row: {
          company_id: string
          days_until_expiry: number | null
          document_id: string
          employee_id: string
          id: string
          notification_type: string
          sent_at: string | null
          sent_to: string
        }
        Insert: {
          company_id: string
          days_until_expiry?: number | null
          document_id: string
          employee_id: string
          id?: string
          notification_type: string
          sent_at?: string | null
          sent_to: string
        }
        Update: {
          company_id?: string
          days_until_expiry?: number | null
          document_id?: string
          employee_id?: string
          id?: string
          notification_type?: string
          sent_at?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_expiry_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_expiry_notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_expiry_notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          allowed_for_employee_upload: boolean | null
          allowed_mime_types: string[] | null
          code: string
          company_id: string
          created_at: string
          description: string | null
          has_expiry: boolean | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          max_file_size_mb: number | null
          name: string
          reminder_days: number | null
          updated_at: string
        }
        Insert: {
          allowed_for_employee_upload?: boolean | null
          allowed_mime_types?: string[] | null
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          has_expiry?: boolean | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_file_size_mb?: number | null
          name: string
          reminder_days?: number | null
          updated_at?: string
        }
        Update: {
          allowed_for_employee_upload?: boolean | null
          allowed_mime_types?: string[] | null
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          has_expiry?: boolean | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_file_size_mb?: number | null
          name?: string
          reminder_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bcc_emails: string[] | null
          cc_emails: string[] | null
          company_id: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          provider: string | null
          recipient_email: string
          recipient_name: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          subject: string
          template_type: string | null
          triggered_by: string | null
          triggered_from: string | null
          updated_at: string | null
        }
        Insert: {
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          company_id?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          provider?: string | null
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject: string
          template_type?: string | null
          triggered_by?: string | null
          triggered_from?: string | null
          updated_at?: string | null
        }
        Update: {
          bcc_emails?: string[] | null
          cc_emails?: string[] | null
          company_id?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          provider?: string | null
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_type?: string | null
          triggered_by?: string | null
          triggered_from?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          access_count: number | null
          company_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          document_type_id: string
          employee_id: string
          expiry_date: string | null
          expiry_notification_sent: boolean | null
          expiry_notification_sent_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_latest_version: boolean | null
          is_verified: boolean | null
          issue_date: string | null
          last_accessed_at: string | null
          last_accessed_by: string | null
          metadata: Json | null
          mime_type: string | null
          ocr_extracted_data: Json | null
          ocr_processed: boolean | null
          ocr_processed_at: string | null
          ocr_text: string | null
          parent_document_id: string | null
          rejection_reason: string | null
          title: string
          updated_at: string
          verification_status:
            | Database["public"]["Enums"]["document_verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
          version_number: number | null
        }
        Insert: {
          access_count?: number | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_type_id: string
          employee_id: string
          expiry_date?: string | null
          expiry_notification_sent?: boolean | null
          expiry_notification_sent_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_latest_version?: boolean | null
          is_verified?: boolean | null
          issue_date?: string | null
          last_accessed_at?: string | null
          last_accessed_by?: string | null
          metadata?: Json | null
          mime_type?: string | null
          ocr_extracted_data?: Json | null
          ocr_processed?: boolean | null
          ocr_processed_at?: string | null
          ocr_text?: string | null
          parent_document_id?: string | null
          rejection_reason?: string | null
          title: string
          updated_at?: string
          verification_status?:
            | Database["public"]["Enums"]["document_verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
          version_number?: number | null
        }
        Update: {
          access_count?: number | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          document_type_id?: string
          employee_id?: string
          expiry_date?: string | null
          expiry_notification_sent?: boolean | null
          expiry_notification_sent_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_latest_version?: boolean | null
          is_verified?: boolean | null
          issue_date?: string | null
          last_accessed_at?: string | null
          last_accessed_by?: string | null
          metadata?: Json | null
          mime_type?: string | null
          ocr_extracted_data?: Json | null
          ocr_processed?: boolean | null
          ocr_processed_at?: string | null
          ocr_text?: string | null
          parent_document_id?: string | null
          rejection_reason?: string | null
          title?: string
          updated_at?: string
          verification_status?:
            | Database["public"]["Enums"]["document_verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_education: {
        Row: {
          company_id: string
          created_at: string
          degree: string
          description: string | null
          employee_id: string
          end_date: string | null
          field_of_study: string | null
          grade: string | null
          id: string
          institution: string
          is_current: boolean | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          degree: string
          description?: string | null
          employee_id: string
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution: string
          is_current?: boolean | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          degree?: string
          description?: string | null
          employee_id?: string
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution?: string
          is_current?: boolean | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_education_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_education_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_experience: {
        Row: {
          company_id: string
          company_name: string
          created_at: string
          description: string | null
          employee_id: string
          end_date: string | null
          id: string
          is_current: boolean | null
          job_title: string
          location: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          company_id: string
          company_name: string
          created_at?: string
          description?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title: string
          location?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_name?: string
          created_at?: string
          description?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title?: string
          location?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_experience_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_experience_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shift_assignments: {
        Row: {
          assigned_by: string | null
          company_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_temporary: boolean
          reason: string | null
          shift_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          company_id: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_temporary?: boolean
          reason?: string | null
          shift_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          company_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_temporary?: boolean
          reason?: string | null
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shift_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: Json | null
          allowances: Json | null
          bank_details: Json | null
          benefits: Json | null
          certifications: Json | null
          company_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deductions: Json | null
          department_id: string | null
          email: string
          emergency_contact: Json | null
          employee_number: string
          employment_status: Database["public"]["Enums"]["employment_status"]
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          gender: string | null
          hire_date: string
          id: string
          job_title: string | null
          last_name: string
          manager_id: string | null
          metadata: Json | null
          national_id: string | null
          nationality: string | null
          personal_email: string | null
          phone: string | null
          probation_end_date: string | null
          salary: number | null
          salary_currency: string | null
          shift_end_time: string | null
          shift_schedule_type: string | null
          shift_start_time: string | null
          skills: string[] | null
          tax_info: Json | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string
          user_id: string | null
          weekly_off_days: string[] | null
          work_location: string | null
        }
        Insert: {
          address?: Json | null
          allowances?: Json | null
          bank_details?: Json | null
          benefits?: Json | null
          certifications?: Json | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deductions?: Json | null
          department_id?: string | null
          email: string
          emergency_contact?: Json | null
          employee_number: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          gender?: string | null
          hire_date: string
          id?: string
          job_title?: string | null
          last_name: string
          manager_id?: string | null
          metadata?: Json | null
          national_id?: string | null
          nationality?: string | null
          personal_email?: string | null
          phone?: string | null
          probation_end_date?: string | null
          salary?: number | null
          salary_currency?: string | null
          shift_end_time?: string | null
          shift_schedule_type?: string | null
          shift_start_time?: string | null
          skills?: string[] | null
          tax_info?: Json | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string | null
          weekly_off_days?: string[] | null
          work_location?: string | null
        }
        Update: {
          address?: Json | null
          allowances?: Json | null
          bank_details?: Json | null
          benefits?: Json | null
          certifications?: Json | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deductions?: Json | null
          department_id?: string | null
          email?: string
          emergency_contact?: Json | null
          employee_number?: string
          employment_status?: Database["public"]["Enums"]["employment_status"]
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          gender?: string | null
          hire_date?: string
          id?: string
          job_title?: string | null
          last_name?: string
          manager_id?: string | null
          metadata?: Json | null
          national_id?: string | null
          nationality?: string | null
          personal_email?: string | null
          phone?: string | null
          probation_end_date?: string | null
          salary?: number | null
          salary_currency?: string | null
          shift_end_time?: string | null
          shift_schedule_type?: string | null
          shift_start_time?: string | null
          skills?: string[] | null
          tax_info?: Json | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string | null
          weekly_off_days?: string[] | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_history: {
        Row: {
          change_type: string
          company_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          job_title: string
          notes: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          change_type?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          job_title: string
          notes?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          change_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          job_title?: string
          notes?: string | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          budget_limit: number | null
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          budget_limit?: number | null
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          budget_limit?: number | null
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string
          company_id: string
          created_at: string
          currency: string
          description: string
          employee_id: string
          expense_date: string
          id: string
          metadata: Json | null
          receipt_url: string | null
          reimbursed_at: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          company_id: string
          created_at?: string
          currency?: string
          description: string
          employee_id: string
          expense_date: string
          id?: string
          metadata?: Json | null
          receipt_url?: string | null
          reimbursed_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          company_id?: string
          created_at?: string
          currency?: string
          description?: string
          employee_id?: string
          expense_date?: string
          id?: string
          metadata?: Json | null
          receipt_url?: string | null
          reimbursed_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          employee_id: string
          id: string
          last_progress_update: string | null
          progress_notes: Json | null
          progress_percentage: number | null
          review_id: string | null
          status: string | null
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          last_progress_update?: string | null
          progress_notes?: Json | null
          progress_percentage?: number | null
          review_id?: string | null
          status?: string | null
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          last_progress_update?: string | null
          progress_notes?: Json | null
          progress_percentage?: number | null
          review_id?: string | null
          status?: string | null
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_logs: {
        Row: {
          action: string
          admin_user_id: string
          company_id: string
          company_name: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          company_id: string
          company_name: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          company_id?: string
          company_name?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_feedback: {
        Row: {
          communication_rating: number | null
          culture_fit_rating: number | null
          detailed_notes: string | null
          id: string
          interview_id: string
          overall_rating: number | null
          panelist_id: string
          recommendation:
            | Database["public"]["Enums"]["feedback_recommendation"]
            | null
          strengths: string | null
          submitted_at: string
          technical_rating: number | null
          weaknesses: string | null
        }
        Insert: {
          communication_rating?: number | null
          culture_fit_rating?: number | null
          detailed_notes?: string | null
          id?: string
          interview_id: string
          overall_rating?: number | null
          panelist_id: string
          recommendation?:
            | Database["public"]["Enums"]["feedback_recommendation"]
            | null
          strengths?: string | null
          submitted_at?: string
          technical_rating?: number | null
          weaknesses?: string | null
        }
        Update: {
          communication_rating?: number | null
          culture_fit_rating?: number | null
          detailed_notes?: string | null
          id?: string
          interview_id?: string
          overall_rating?: number | null
          panelist_id?: string
          recommendation?:
            | Database["public"]["Enums"]["feedback_recommendation"]
            | null
          strengths?: string | null
          submitted_at?: string
          technical_rating?: number | null
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_feedback_panelist_id_fkey"
            columns: ["panelist_id"]
            isOneToOne: false
            referencedRelation: "interview_panelists"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_panelists: {
        Row: {
          created_at: string
          employee_id: string
          feedback_submitted: boolean | null
          id: string
          interview_id: string
          is_required: boolean | null
          role: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          feedback_submitted?: boolean | null
          id?: string
          interview_id: string
          is_required?: boolean | null
          role?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          feedback_submitted?: boolean | null
          id?: string
          interview_id?: string
          is_required?: boolean | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_panelists_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_panelists_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          interview_type: Database["public"]["Enums"]["interview_type"]
          location: string | null
          meeting_link: string | null
          notes: string | null
          round_number: number
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          interview_type?: Database["public"]["Enums"]["interview_type"]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          round_number?: number
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          interview_type?: Database["public"]["Enums"]["interview_type"]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          round_number?: number
          scheduled_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      job_custom_fields: {
        Row: {
          company_id: string
          created_at: string
          display_order: number | null
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean | null
          job_id: string
          options: Json | null
          placeholder: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          display_order?: number | null
          field_label: string
          field_name: string
          field_type: string
          id?: string
          is_required?: boolean | null
          job_id: string
          options?: Json | null
          placeholder?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          display_order?: number | null
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          job_id?: string
          options?: Json | null
          placeholder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_custom_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_custom_fields_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          access_token: string
          additional_terms: string | null
          benefits: Json | null
          candidate_id: string
          candidate_response: string | null
          company_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          job_id: string
          negotiation_notes: Json | null
          offer_expiry_date: string
          reporting_to: string | null
          responded_at: string | null
          salary_currency: string
          salary_offered: number
          sent_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          access_token?: string
          additional_terms?: string | null
          benefits?: Json | null
          candidate_id: string
          candidate_response?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          job_id: string
          negotiation_notes?: Json | null
          offer_expiry_date: string
          reporting_to?: string | null
          responded_at?: string | null
          salary_currency?: string
          salary_offered: number
          sent_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          access_token?: string
          additional_terms?: string | null
          benefits?: Json | null
          candidate_id?: string
          candidate_response?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          job_id?: string
          negotiation_notes?: Json | null
          offer_expiry_date?: string
          reporting_to?: string | null
          responded_at?: string | null
          salary_currency?: string
          salary_offered?: number
          sent_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_reporting_to_fkey"
            columns: ["reporting_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          closes_at: string | null
          company_id: string
          created_at: string
          department_id: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          hiring_manager_id: string | null
          id: string
          is_remote: boolean | null
          location: string | null
          metadata: Json | null
          openings: number | null
          published_at: string | null
          requirements: string | null
          responsibilities: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          show_salary: boolean | null
          slug: string
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          company_id: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          hiring_manager_id?: string | null
          id?: string
          is_remote?: boolean | null
          location?: string | null
          metadata?: Json | null
          openings?: number | null
          published_at?: string | null
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          show_salary?: boolean | null
          slug: string
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          hiring_manager_id?: string | null
          id?: string
          is_remote?: boolean | null
          location?: string | null
          metadata?: Json | null
          openings?: number | null
          published_at?: string | null
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          show_salary?: boolean | null
          slug?: string
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_approval_config: {
        Row: {
          approval_chain: string[]
          auto_approve_if_no_manager: boolean | null
          company_id: string
          created_at: string
          hr_self_approval_enabled: boolean | null
          id: string
          manager_self_approval_enabled: boolean | null
          skip_hr_for_less_than_days: number | null
          updated_at: string
        }
        Insert: {
          approval_chain?: string[]
          auto_approve_if_no_manager?: boolean | null
          company_id: string
          created_at?: string
          hr_self_approval_enabled?: boolean | null
          id?: string
          manager_self_approval_enabled?: boolean | null
          skip_hr_for_less_than_days?: number | null
          updated_at?: string
        }
        Update: {
          approval_chain?: string[]
          auto_approve_if_no_manager?: boolean | null
          company_id?: string
          created_at?: string
          hr_self_approval_enabled?: boolean | null
          id?: string
          manager_self_approval_enabled?: boolean | null
          skip_hr_for_less_than_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_approval_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_approval_history: {
        Row: {
          action: string
          approver_id: string | null
          approver_role: string
          comments: string | null
          company_id: string
          created_at: string
          id: string
          leave_request_id: string
        }
        Insert: {
          action: string
          approver_id?: string | null
          approver_role: string
          comments?: string | null
          company_id: string
          created_at?: string
          id?: string
          leave_request_id: string
        }
        Update: {
          action?: string
          approver_id?: string | null
          approver_role?: string
          comments?: string | null
          company_id?: string
          created_at?: string
          id?: string
          leave_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_approval_history_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_approval_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_approval_history_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          adjustment_days: number
          adjustment_reason: string | null
          allocated_days: number
          carried_over_days: number
          company_id: string
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          pending_days: number
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          adjustment_days?: number
          adjustment_reason?: string | null
          allocated_days?: number
          carried_over_days?: number
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          leave_type_id: string
          pending_days?: number
          updated_at?: string
          used_days?: number
          year: number
        }
        Update: {
          adjustment_days?: number
          adjustment_reason?: string | null
          allocated_days?: number
          carried_over_days?: number
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          leave_type_id?: string
          pending_days?: number
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_days: {
        Row: {
          company_id: string
          created_at: string
          date: string
          day_type: string
          id: string
          leave_request_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          day_type?: string
          id?: string
          leave_request_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          day_type?: string
          id?: string
          leave_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_days_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_request_days_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_status: Json | null
          company_id: string
          created_at: string
          current_approval_level: number | null
          document_urls: string[] | null
          employee_id: string
          end_date: string
          end_half_day: boolean | null
          id: string
          leave_type_id: string
          metadata: Json | null
          reason: string | null
          requires_hr_approval: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          start_half_day: boolean | null
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
        }
        Insert: {
          approval_status?: Json | null
          company_id: string
          created_at?: string
          current_approval_level?: number | null
          document_urls?: string[] | null
          employee_id: string
          end_date: string
          end_half_day?: boolean | null
          id?: string
          leave_type_id: string
          metadata?: Json | null
          reason?: string | null
          requires_hr_approval?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          start_half_day?: boolean | null
          status?: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at?: string
        }
        Update: {
          approval_status?: Json | null
          company_id?: string
          created_at?: string
          current_approval_level?: number | null
          document_urls?: string[] | null
          employee_id?: string
          end_date?: string
          end_half_day?: boolean | null
          id?: string
          leave_type_id?: string
          metadata?: Json | null
          reason?: string | null
          requires_hr_approval?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          start_half_day?: boolean | null
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_rate: number | null
          carry_over_limit: number | null
          code: string
          color: string | null
          company_id: string
          created_at: string
          default_days: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_paid: boolean | null
          max_consecutive_days: number | null
          min_notice_days: number | null
          name: string
          requires_approval: boolean | null
          requires_document: boolean | null
          updated_at: string
        }
        Insert: {
          accrual_rate?: number | null
          carry_over_limit?: number | null
          code: string
          color?: string | null
          company_id: string
          created_at?: string
          default_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          max_consecutive_days?: number | null
          min_notice_days?: number | null
          name: string
          requires_approval?: boolean | null
          requires_document?: boolean | null
          updated_at?: string
        }
        Update: {
          accrual_rate?: number | null
          carry_over_limit?: number | null
          code?: string
          color?: string | null
          company_id?: string
          created_at?: string
          default_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_paid?: boolean | null
          max_consecutive_days?: number | null
          min_notice_days?: number | null
          name?: string
          requires_approval?: boolean | null
          requires_document?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      multi_company_requests: {
        Row: {
          created_at: string
          id: string
          reason: string
          requested_count: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          requested_count?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          requested_count?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          company_id: string | null
          created_at: string
          employee_id: string | null
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          metadata: Json | null
          notification_channels: string[] | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          employee_id?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          metadata?: Json | null
          notification_channels?: string[] | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          employee_id?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          metadata?: Json | null
          notification_channels?: string[] | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_logs: {
        Row: {
          company_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          link_id: string | null
          metadata: Json | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          link_id?: string | null
          metadata?: Json | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          link_id?: string | null
          metadata?: Json | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_logs_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "company_creation_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          allowances: Json | null
          base_salary: number
          benefits_deductions: number | null
          bonuses: number | null
          commissions: number | null
          company_id: string
          created_at: string
          days_absent: number | null
          days_late: number | null
          days_present: number | null
          employee_id: string
          employer_contributions: Json | null
          gross_pay: number
          half_days: number | null
          hours_worked: number | null
          id: string
          metadata: Json | null
          net_pay: number
          notes: string | null
          other_deductions: Json | null
          overtime_hours: number | null
          overtime_pay: number | null
          payroll_run_id: string
          pf_deduction: number | null
          tax_deductions: number | null
          total_deductions: number | null
          total_employer_cost: number | null
          total_late_minutes: number | null
          updated_at: string
        }
        Insert: {
          allowances?: Json | null
          base_salary?: number
          benefits_deductions?: number | null
          bonuses?: number | null
          commissions?: number | null
          company_id: string
          created_at?: string
          days_absent?: number | null
          days_late?: number | null
          days_present?: number | null
          employee_id: string
          employer_contributions?: Json | null
          gross_pay?: number
          half_days?: number | null
          hours_worked?: number | null
          id?: string
          metadata?: Json | null
          net_pay?: number
          notes?: string | null
          other_deductions?: Json | null
          overtime_hours?: number | null
          overtime_pay?: number | null
          payroll_run_id: string
          pf_deduction?: number | null
          tax_deductions?: number | null
          total_deductions?: number | null
          total_employer_cost?: number | null
          total_late_minutes?: number | null
          updated_at?: string
        }
        Update: {
          allowances?: Json | null
          base_salary?: number
          benefits_deductions?: number | null
          bonuses?: number | null
          commissions?: number | null
          company_id?: string
          created_at?: string
          days_absent?: number | null
          days_late?: number | null
          days_present?: number | null
          employee_id?: string
          employer_contributions?: Json | null
          gross_pay?: number
          half_days?: number | null
          hours_worked?: number | null
          id?: string
          metadata?: Json | null
          net_pay?: number
          notes?: string | null
          other_deductions?: Json | null
          overtime_hours?: number | null
          overtime_pay?: number | null
          payroll_run_id?: string
          pf_deduction?: number | null
          tax_deductions?: number | null
          total_deductions?: number | null
          total_employer_cost?: number | null
          total_late_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          currency: string | null
          employee_count: number | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          pay_date: string
          period_end: string
          period_start: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          total_deductions: number | null
          total_employer_cost: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          currency?: string | null
          employee_count?: number | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          pay_date: string
          period_end: string
          period_start: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number | null
          total_employer_cost?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          currency?: string | null
          employee_count?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          pay_date?: string
          period_end?: string
          period_start?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number | null
          total_employer_cost?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          areas_for_improvement: string | null
          company_id: string
          competencies: Json | null
          completed_at: string | null
          created_at: string
          development_plan: string | null
          employee_comments: string | null
          employee_id: string
          goals: Json | null
          id: string
          lifecycle_state: string | null
          manager_assessment: string | null
          manager_review_completed_at: string | null
          metadata: Json | null
          next_review_date: string | null
          overall_rating: number | null
          review_period_end: string
          review_period_start: string
          review_type: string | null
          reviewer_id: string
          self_assessment: string | null
          self_review_completed_at: string | null
          status: Database["public"]["Enums"]["review_status"]
          strengths: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          areas_for_improvement?: string | null
          company_id: string
          competencies?: Json | null
          completed_at?: string | null
          created_at?: string
          development_plan?: string | null
          employee_comments?: string | null
          employee_id: string
          goals?: Json | null
          id?: string
          lifecycle_state?: string | null
          manager_assessment?: string | null
          manager_review_completed_at?: string | null
          metadata?: Json | null
          next_review_date?: string | null
          overall_rating?: number | null
          review_period_end: string
          review_period_start: string
          review_type?: string | null
          reviewer_id: string
          self_assessment?: string | null
          self_review_completed_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          areas_for_improvement?: string | null
          company_id?: string
          competencies?: Json | null
          completed_at?: string | null
          created_at?: string
          development_plan?: string | null
          employee_comments?: string | null
          employee_id?: string
          goals?: Json | null
          id?: string
          lifecycle_state?: string | null
          manager_assessment?: string | null
          manager_review_completed_at?: string | null
          metadata?: Json | null
          next_review_date?: string | null
          overall_rating?: number | null
          review_period_end?: string
          review_period_start?: string
          review_type?: string | null
          reviewer_id?: string
          self_assessment?: string | null
          self_review_completed_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          strengths?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at: string
          description: string | null
          id: string
          module: Database["public"]["Enums"]["permission_module"]
          name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          created_at?: string
          description?: string | null
          id?: string
          module: Database["public"]["Enums"]["permission_module"]
          name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          created_at?: string
          description?: string | null
          id?: string
          module?: Database["public"]["Enums"]["permission_module"]
          name?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          max_employees: number | null
          max_storage_gb: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number | null
          trial_default_days: number | null
          trial_enabled: boolean | null
          trial_restrictions: Json | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_employees?: number | null
          max_storage_gb?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number | null
          trial_default_days?: number | null
          trial_enabled?: boolean | null
          trial_restrictions?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_employees?: number | null
          max_storage_gb?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number | null
          trial_default_days?: number | null
          trial_enabled?: boolean | null
          trial_restrictions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          failed_login_attempts: number | null
          first_name: string | null
          force_password_change: boolean | null
          id: string
          is_first_login: boolean | null
          last_login_at: string | null
          last_name: string | null
          locale: string | null
          locked_until: string | null
          login_type: string | null
          max_companies: number
          metadata: Json | null
          password_changed_at: string | null
          password_expires_at: string | null
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          failed_login_attempts?: number | null
          first_name?: string | null
          force_password_change?: boolean | null
          id: string
          is_first_login?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          locale?: string | null
          locked_until?: string | null
          login_type?: string | null
          max_companies?: number
          metadata?: Json | null
          password_changed_at?: string | null
          password_expires_at?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          failed_login_attempts?: number | null
          first_name?: string | null
          force_password_change?: boolean | null
          id?: string
          is_first_login?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          locale?: string | null
          locked_until?: string | null
          login_type?: string | null
          max_companies?: number
          metadata?: Json | null
          password_changed_at?: string | null
          password_expires_at?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_cycles: {
        Row: {
          auto_create_reviews: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          cycle_type: string
          description: string | null
          end_date: string
          escalation_days: number | null
          id: string
          name: string
          reminder_days: number[] | null
          review_period_end: string
          review_period_start: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          auto_create_reviews?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          cycle_type?: string
          description?: string | null
          end_date: string
          escalation_days?: number | null
          id?: string
          name: string
          reminder_days?: number[] | null
          review_period_end: string
          review_period_start: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          auto_create_reviews?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          cycle_type?: string
          description?: string | null
          end_date?: string
          escalation_days?: number | null
          id?: string
          name?: string
          reminder_days?: number[] | null
          review_period_end?: string
          review_period_start?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reminders: {
        Row: {
          company_id: string
          days_remaining: number | null
          id: string
          reminder_type: string
          review_id: string
          sent_at: string | null
          sent_to: string
        }
        Insert: {
          company_id: string
          days_remaining?: number | null
          id?: string
          reminder_type: string
          review_id: string
          sent_at?: string | null
          sent_to: string
        }
        Update: {
          company_id?: string
          days_remaining?: number | null
          id?: string
          reminder_type?: string
          review_id?: string
          sent_at?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reminders_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          name: string
          permissions_config: Json | null
          plan_tier: string | null
          sort_order: number | null
        }
        Insert: {
          base_role: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          name: string
          permissions_config?: Json | null
          plan_tier?: string | null
          sort_order?: number | null
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          name?: string
          permissions_config?: Json | null
          plan_tier?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      salary_history: {
        Row: {
          base_salary: number
          company_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          reason: string | null
          salary_currency: string
          salary_structure: Json | null
          updated_at: string
        }
        Insert: {
          base_salary: number
          company_id: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          reason?: string | null
          salary_currency?: string
          salary_structure?: Json | null
          updated_at?: string
        }
        Update: {
          base_salary?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          reason?: string | null
          salary_currency?: string
          salary_structure?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_tests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          is_template: boolean | null
          job_id: string | null
          passing_score: number
          questions: Json
          test_type: Database["public"]["Enums"]["screening_test_type"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          job_id?: string | null
          passing_score?: number
          questions?: Json
          test_type?: Database["public"]["Enums"]["screening_test_type"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          job_id?: string | null
          passing_score?: number
          questions?: Json
          test_type?: Database["public"]["Enums"]["screening_test_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_tests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_tests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          ip_address: unknown
          ip_address_masked: string | null
          is_resolved: boolean | null
          location: Json | null
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          user_agent: string | null
          user_agent_truncated: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: unknown
          ip_address_masked?: string | null
          is_resolved?: boolean | null
          location?: Json | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          user_agent?: string | null
          user_agent_truncated?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          ip_address?: unknown
          ip_address_masked?: string | null
          is_resolved?: boolean | null
          location?: Json | null
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          user_agent?: string | null
          user_agent_truncated?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          applicable_days: string[]
          break_duration_minutes: number
          company_id: string
          created_at: string
          created_by: string | null
          end_time: string
          grace_period_minutes: number
          id: string
          is_active: boolean
          is_default: boolean
          min_hours_full_day: number
          min_hours_half_day: number
          name: string
          overtime_after_minutes: number | null
          start_time: string
          updated_at: string
        }
        Insert: {
          applicable_days?: string[]
          break_duration_minutes?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          min_hours_full_day?: number
          min_hours_half_day?: number
          name: string
          overtime_after_minutes?: number | null
          start_time: string
          updated_at?: string
        }
        Update: {
          applicable_days?: string[]
          break_duration_minutes?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          min_hours_full_day?: number
          min_hours_half_day?: number
          name?: string
          overtime_after_minutes?: number | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subdomain_change_requests: {
        Row: {
          company_id: string
          created_at: string
          current_subdomain: string
          id: string
          reason: string | null
          requested_by: string
          requested_subdomain: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["subdomain_request_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_subdomain: string
          id?: string
          reason?: string | null
          requested_by: string
          requested_subdomain: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["subdomain_request_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_subdomain?: string
          id?: string
          reason?: string | null
          requested_by?: string
          requested_subdomain?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["subdomain_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subdomain_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_access: {
        Row: {
          access_level: string | null
          access_log: Json | null
          access_reason: string | null
          accessed_resources: Json | null
          company_id: string
          created_at: string
          expires_at: string
          granted_by: string
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          starts_at: string
          support_user_id: string | null
          updated_at: string
        }
        Insert: {
          access_level?: string | null
          access_log?: Json | null
          access_reason?: string | null
          accessed_resources?: Json | null
          company_id: string
          created_at?: string
          expires_at: string
          granted_by: string
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          support_user_id?: string | null
          updated_at?: string
        }
        Update: {
          access_level?: string | null
          access_log?: Json | null
          access_reason?: string | null
          accessed_resources?: Json | null
          company_id?: string
          created_at?: string
          expires_at?: string
          granted_by?: string
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          support_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_correction_requests: {
        Row: {
          company_id: string
          correction_date: string
          created_at: string
          employee_id: string
          id: string
          original_entry_id: string | null
          reason: string
          requested_break_minutes: number | null
          requested_clock_in: string | null
          requested_clock_out: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supporting_document_url: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          correction_date: string
          created_at?: string
          employee_id: string
          id?: string
          original_entry_id?: string | null
          reason: string
          requested_break_minutes?: number | null
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supporting_document_url?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          correction_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          original_entry_id?: string | null
          reason?: string
          requested_break_minutes?: number | null
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supporting_document_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_correction_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_correction_requests_original_entry_id_fkey"
            columns: ["original_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          break_minutes: number | null
          clock_in: string | null
          clock_in_location: Json | null
          clock_out: string | null
          clock_out_location: Json | null
          company_id: string
          corrected_at: string | null
          corrected_by: string | null
          correction_id: string | null
          correction_reason: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          is_approved: boolean | null
          is_corrected: boolean | null
          late_minutes: number | null
          location: Json | null
          metadata: Json | null
          notes: string | null
          original_clock_in: string | null
          original_clock_out: string | null
          overtime_hours: number | null
          total_hours: number | null
          under_time_minutes: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_status?: string | null
          break_minutes?: number | null
          clock_in?: string | null
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_location?: Json | null
          company_id: string
          corrected_at?: string | null
          corrected_by?: string | null
          correction_id?: string | null
          correction_reason?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          is_approved?: boolean | null
          is_corrected?: boolean | null
          late_minutes?: number | null
          location?: Json | null
          metadata?: Json | null
          notes?: string | null
          original_clock_in?: string | null
          original_clock_out?: string | null
          overtime_hours?: number | null
          total_hours?: number | null
          under_time_minutes?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_status?: string | null
          break_minutes?: number | null
          clock_in?: string | null
          clock_in_location?: Json | null
          clock_out?: string | null
          clock_out_location?: Json | null
          company_id?: string
          corrected_at?: string | null
          corrected_by?: string | null
          correction_id?: string | null
          correction_reason?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_approved?: boolean | null
          is_corrected?: boolean | null
          late_minutes?: number | null
          location?: Json | null
          metadata?: Json | null
          notes?: string | null
          original_clock_in?: string | null
          original_clock_out?: string | null
          overtime_hours?: number | null
          total_hours?: number | null
          under_time_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_correction_id_fkey"
            columns: ["correction_id"]
            isOneToOne: false
            referencedRelation: "time_correction_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_breaks: {
        Row: {
          break_end: string | null
          break_start: string
          break_type: string | null
          company_id: string
          created_at: string
          duration_minutes: number | null
          employee_id: string
          id: string
          notes: string | null
          time_entry_id: string
          updated_at: string
        }
        Insert: {
          break_end?: string | null
          break_start: string
          break_type?: string | null
          company_id: string
          created_at?: string
          duration_minutes?: number | null
          employee_id: string
          id?: string
          notes?: string | null
          time_entry_id: string
          updated_at?: string
        }
        Update: {
          break_end?: string | null
          break_start?: string
          break_type?: string | null
          company_id?: string
          created_at?: string
          duration_minutes?: number | null
          employee_id?: string
          id?: string
          notes?: string | null
          time_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_breaks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_breaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_breaks_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_email_logs: {
        Row: {
          company_id: string
          days_remaining: number
          email_type: string
          id: string
          recipient_email: string
          sent_at: string
          sent_date: string
        }
        Insert: {
          company_id: string
          days_remaining: number
          email_type: string
          id?: string
          recipient_email: string
          sent_at?: string
          sent_date?: string
        }
        Update: {
          company_id?: string
          days_remaining?: number
          email_type?: string
          id?: string
          recipient_email?: string
          sent_at?: string
          sent_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_extension_requests: {
        Row: {
          company_id: string
          created_at: string
          extension_number: number
          id: string
          reason: string
          requested_by: string
          requested_days: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          extension_number?: number
          id?: string
          reason: string
          requested_by: string
          requested_days?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          extension_number?: number
          id?: string
          reason?: string
          requested_by?: string
          requested_days?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_extension_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          browser: string | null
          created_at: string
          device_fingerprint: string
          device_name: string
          first_seen_at: string
          id: string
          is_current: boolean | null
          is_trusted: boolean | null
          last_used_at: string
          metadata: Json | null
          os: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          device_name: string
          first_seen_at?: string
          id?: string
          is_current?: boolean | null
          is_trusted?: boolean | null
          last_used_at?: string
          metadata?: Json | null
          os?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          device_name?: string
          first_seen_at?: string
          id?: string
          is_current?: boolean | null
          is_trusted?: boolean | null
          last_used_at?: string
          metadata?: Json | null
          os?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          granted: boolean
          id: string
          permission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          permission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          granted?: boolean
          id?: string
          permission_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          attempt_number: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempt_number?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempt_number?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number | null
          headers: Json | null
          id: string
          is_active: boolean
          last_status: number | null
          last_triggered_at: string | null
          name: string
          retry_count: number | null
          secret: string
          timeout_seconds: number | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number | null
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_status?: number | null
          last_triggered_at?: string | null
          name: string
          retry_count?: number | null
          secret?: string
          timeout_seconds?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number | null
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_status?: number | null
          last_triggered_at?: string | null
          name?: string
          retry_count?: number | null
          secret?: string
          timeout_seconds?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          break_minutes: number
          company_id: string
          created_at: string
          day_of_week: number
          employee_id: string | null
          expected_end: string
          expected_hours: number
          expected_start: string
          id: string
          is_active: boolean
          is_working_day: boolean
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          company_id: string
          created_at?: string
          day_of_week: number
          employee_id?: string | null
          expected_end?: string
          expected_hours?: number
          expected_start?: string
          id?: string
          is_active?: boolean
          is_working_day?: boolean
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          company_id?: string
          created_at?: string
          day_of_week?: number
          employee_id?: string | null
          expected_end?: string
          expected_hours?: number
          expected_start?: string
          id?: string
          is_active?: boolean
          is_working_day?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_document_stats: {
        Row: {
          company_id: string | null
          employees_with_documents: number | null
          expired_documents: number | null
          pending_documents: number | null
          total_documents: number | null
          total_storage_bytes: number | null
          verified_documents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_job_offer: {
        Args: {
          _access_token: string
          _offer_id: string
          _response_notes?: string
        }
        Returns: Json
      }
      accrue_leave_balances: {
        Args: { _company_id: string; _year?: number }
        Returns: {
          balances_created: number
          employees_processed: number
          errors: string[]
        }[]
      }
      adjust_leave_balance: {
        Args: {
          _adjustment_days: number
          _employee_id: string
          _leave_type_id: string
          _reason: string
        }
        Returns: {
          adjustment_days: number
          adjustment_reason: string | null
          allocated_days: number
          carried_over_days: number
          company_id: string
          created_at: string
          employee_id: string
          id: string
          leave_type_id: string
          pending_days: number
          updated_at: string
          used_days: number
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_link_users_to_employees: {
        Args: { _company_id: string }
        Returns: {
          linked_count: number
          unlinked_employees: number
          unlinked_users: number
        }[]
      }
      calculate_payroll_from_attendance: {
        Args: {
          _employee_id: string
          _period_end: string
          _period_start: string
        }
        Returns: {
          base_salary: number
          daily_rate: number
          days_absent: number
          days_worked: number
          deductions: number
          overtime_hours: number
          overtime_pay: number
          prorated_salary: number
          unpaid_leave_days: number
        }[]
      }
      can_access_document: {
        Args: { _action: string; _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_users: { Args: { _company_id: string }; Returns: boolean }
      can_perform_action: {
        Args: { _action?: string; _company_id: string; _module: string }
        Returns: boolean
      }
      can_process_document_ocr: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_documents: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_leave: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_module: {
        Args: { _company_id: string; _module: string; _user_id: string }
        Returns: boolean
      }
      can_use_payroll: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_performance: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_recruitment: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_use_time_tracking: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_employee_payroll: {
        Args: { _company_id: string; _employee_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_employee_personal: {
        Args: { _company_id: string; _employee_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_reports: { Args: { _company_id: string }; Returns: boolean }
      can_write_action: { Args: { _company_id: string }; Returns: boolean }
      check_document_limits: {
        Args: { _company_id: string; _employee_id: string }
        Returns: Json
      }
      check_leave_balance: {
        Args: {
          _days: number
          _employee_id: string
          _exclude_request_id?: string
          _leave_type_id: string
        }
        Returns: {
          available_days: number
          has_balance: boolean
          message: string
        }[]
      }
      check_subdomain_availability: {
        Args: { subdomain_to_check: string }
        Returns: boolean
      }
      company_can_add_employee: {
        Args: { _company_id: string }
        Returns: boolean
      }
      company_has_active_subscription: {
        Args: { _company_id: string }
        Returns: boolean
      }
      company_has_module: {
        Args: { _company_id: string; _module: string }
        Returns: boolean
      }
      company_has_ocr: { Args: { _company_id: string }; Returns: boolean }
      convert_candidate_to_employee: {
        Args: {
          _candidate_id: string
          _create_login?: boolean
          _offer_id: string
        }
        Returns: string
      }
      create_company_with_admin: {
        Args: {
          _industry?: string
          _name: string
          _size_range?: string
          _slug: string
        }
        Returns: string
      }
      create_reviews_for_cycle: { Args: { _cycle_id: string }; Returns: number }
      current_company_id: { Args: never; Returns: string }
      current_employee_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      decline_job_offer: {
        Args: { _access_token: string; _offer_id: string; _reason?: string }
        Returns: Json
      }
      delete_test_company: { Args: { _company_id: string }; Returns: boolean }
      generate_attendance_summary: {
        Args: {
          _company_id: string
          _period_end: string
          _period_start: string
        }
        Returns: {
          days_late: number
          days_present: number
          employee_id: string
          full_day_absents: number
          half_day_absents: number
          late_minutes: number
          overtime_hours: number
          paid_leave_days: number
          summary_id: string
          total_working_hours: number
          unpaid_leave_days: number
        }[]
      }
      generate_employee_number: {
        Args: { _company_id: string }
        Returns: string
      }
      get_attendance_summary: {
        Args: {
          _employee_id: string
          _period_end: string
          _period_start: string
        }
        Returns: {
          calculated_from: string | null
          calculated_to: string | null
          company_id: string
          created_at: string
          days_late: number
          days_present: number
          employee_id: string
          full_day_absents: number
          half_day_absents: number
          id: string
          is_locked: boolean
          late_minutes: number | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          overtime_hours: number
          paid_leave_days: number | null
          payroll_run_id: string | null
          period_end: string
          period_start: string
          total_working_days: number
          total_working_hours: number
          unpaid_leave_days: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_company_branding_for_domain: {
        Args: { hostname: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          slug: string
        }[]
      }
      get_company_id_by_slug: {
        Args: { company_slug: string }
        Returns: string
      }
      get_company_primary_domain: {
        Args: { _company_id: string }
        Returns: {
          domain_type: string
          domain_url: string
        }[]
      }
      get_current_employee: { Args: { _company_id: string }; Returns: string }
      get_documents_needing_expiry_notification: {
        Args: { _days_before?: number }
        Returns: {
          company_id: string
          days_until_expiry: number
          document_id: string
          document_title: string
          document_type_name: string
          employee_email: string
          employee_id: string
          employee_name: string
          expiry_date: string
        }[]
      }
      get_effective_subscription_status: {
        Args: { _company_id: string }
        Returns: string
      }
      get_employee_login_info: {
        Args: { p_company_id: string; p_employee_number: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_employee_shift_for_date: {
        Args: { _date: string; _employee_id: string }
        Returns: string
      }
      get_expired_documents: {
        Args: never
        Returns: {
          company_id: string
          days_expired: number
          document_id: string
          document_title: string
          document_type_name: string
          employee_id: string
          expiry_date: string
        }[]
      }
      get_expiring_documents: {
        Args: { _days_threshold?: number }
        Returns: {
          company_id: string
          days_until_expiry: number
          document_id: string
          document_title: string
          document_type_name: string
          employee_email: string
          employee_id: string
          employee_name: string
          employee_user_id: string
          expiry_date: string
          manager_email: string
          manager_user_id: string
        }[]
      }
      get_expiring_trials: {
        Args: { _days_threshold?: number }
        Returns: {
          admin_emails: string[]
          company_id: string
          company_name: string
          days_remaining: number
          trial_ends_at: string
        }[]
      }
      get_leave_balance: {
        Args: { _employee_id: string; _leave_type_id: string; _year?: number }
        Returns: number
      }
      get_platform_admin_role: { Args: { _user_id: string }; Returns: string }
      get_registration_settings: { Args: never; Returns: Json }
      get_reviews_needing_escalation: {
        Args: { _escalation_days?: number }
        Returns: {
          company_id: string
          days_overdue: number
          employee_id: string
          manager_of_reviewer: string
          review_id: string
          reviewer_id: string
        }[]
      }
      get_reviews_needing_reminders: {
        Args: never
        Returns: {
          company_id: string
          days_until_due: number
          employee_name: string
          review_id: string
          review_period_end: string
          reviewer_email: string
          reviewer_id: string
          reviewer_name: string
          reviewer_user_id: string
          status: string
        }[]
      }
      get_role_permissions: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          action: Database["public"]["Enums"]["permission_action"]
          is_granted: boolean
          module: Database["public"]["Enums"]["permission_module"]
          name: string
          permission_id: string
        }[]
      }
      get_trial_info: {
        Args: { _company_id: string }
        Returns: {
          effective_status: string
          is_trial_expired: boolean
          is_trialing: boolean
          trial_days_remaining: number
          trial_ends_at: string
          trial_total_days: number
        }[]
      }
      get_user_companies: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          company_slug: string
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_context: { Args: never; Returns: Json }
      get_user_employee_id: {
        Args: { _company_id: string; _user_id: string }
        Returns: string
      }
      get_user_permissions: {
        Args: { _company_id: string; _user_id: string }
        Returns: {
          action: Database["public"]["Enums"]["permission_action"]
          has_permission: boolean
          module: Database["public"]["Enums"]["permission_module"]
          name: string
          permission_id: string
          source: string
        }[]
      }
      get_user_role: {
        Args: { _company_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      guard_write_operation: { Args: { _company_id: string }; Returns: boolean }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _company_id: string
          _module: Database["public"]["Enums"]["permission_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_valid_support_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      initialize_company_permissions: {
        Args: { _company_id: string }
        Returns: undefined
      }
      initialize_company_settings: {
        Args: { _company_id: string }
        Returns: undefined
      }
      invite_user_to_company: {
        Args: {
          _company_id: string
          _email: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      is_account_locked: { Args: { _user_id: string }; Returns: boolean }
      is_active_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_active_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_active_hr_or_above: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_active_manager_or_above: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_active: { Args: { _company_id: string }; Returns: boolean }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_owner: { Args: { _company_id: string }; Returns: boolean }
      is_hr_or_above: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_interview_panelist: {
        Args: { _interview_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_of_employee: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_own_employee_record: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      is_trial_expired: { Args: { _company_id: string }; Returns: boolean }
      link_user_to_employee: {
        Args: { _company_id: string; _employee_id: string; _user_id: string }
        Returns: boolean
      }
      lock_attendance_for_payroll: {
        Args: { _payroll_run_id: string }
        Returns: number
      }
      log_application_event: {
        Args: {
          _company_id?: string
          _context?: Json
          _duration_ms?: number
          _error_code?: string
          _error_stack?: string
          _level: string
          _message: string
          _request_id?: string
          _service: string
          _user_id?: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          _action: Database["public"]["Enums"]["audit_action"]
          _actor_role?: string
          _company_id: string
          _metadata?: Json
          _new_values?: Json
          _old_values?: Json
          _record_id?: string
          _table_name: string
          _target_type?: string
          _user_id: string
        }
        Returns: string
      }
      log_billing_event: {
        Args: {
          _amount?: number
          _company_id: string
          _currency?: string
          _event_type: string
          _metadata?: Json
          _plan_id?: string
          _previous_plan_id?: string
          _subscription_id?: string
          _triggered_by?: string
        }
        Returns: string
      }
      log_document_access: {
        Args: {
          _access_type: string
          _document_id: string
          _ip_address?: string
          _user_agent?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          _company_id: string
          _description?: string
          _event_type: Database["public"]["Enums"]["security_event_type"]
          _ip_address?: string
          _metadata?: Json
          _severity?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      log_sensitive_access: {
        Args: {
          _access_type?: string
          _company_id: string
          _field_type: string
          _record_id: string
          _table_name: string
          _user_id: string
        }
        Returns: undefined
      }
      mark_expiry_notification_sent: {
        Args: { _document_id: string }
        Returns: undefined
      }
      mask_ip_address: { Args: { ip_addr: string }; Returns: string }
      process_expired_documents: { Args: never; Returns: number }
      process_expired_trials: {
        Args: { _freeze_after_days?: number }
        Returns: {
          action_taken: string
          company_id: string
          company_name: string
        }[]
      }
      record_failed_login: { Args: { _user_id: string }; Returns: undefined }
      record_successful_login: {
        Args: { _user_id: string }
        Returns: undefined
      }
      reset_role_permissions_to_defaults: {
        Args: { _company_id: string }
        Returns: undefined
      }
      set_primary_company: { Args: { _company_id: string }; Returns: boolean }
      set_role_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _company_id: string
          _grant: boolean
          _module: Database["public"]["Enums"]["permission_module"]
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      set_user_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _company_id: string
          _granted: boolean
          _module: Database["public"]["Enums"]["permission_module"]
          _target_user_id: string
        }
        Returns: boolean
      }
      set_user_permissions_batch: {
        Args: {
          _company_id: string
          _permissions: Json
          _target_user_id: string
        }
        Returns: boolean
      }
      soft_delete_document: {
        Args: { _document_id: string; _employee_id: string }
        Returns: boolean
      }
      transition_expired_trials: { Args: never; Returns: number }
      truncate_user_agent: { Args: { ua: string }; Returns: string }
      validate_company_creation_link: {
        Args: { _token: string }
        Returns: {
          billing_interval: string
          email: string
          error_message: string
          is_valid: boolean
          link_id: string
          modules: Json
          plan_id: string
          plan_name: string
          trial_days: number
        }[]
      }
      validate_tenant_access: {
        Args: { _company_id: string }
        Returns: boolean
      }
      verify_document: {
        Args: {
          _document_id: string
          _rejection_reason?: string
          _status: Database["public"]["Enums"]["document_verification_status"]
          _verifier_employee_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "hr_manager"
        | "manager"
        | "employee"
      audit_action:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "export"
        | "import"
      candidate_status:
        | "applied"
        | "screening"
        | "interviewing"
        | "offered"
        | "hired"
        | "rejected"
        | "withdrawn"
      document_verification_status:
        | "pending"
        | "verified"
        | "rejected"
        | "expired"
      employment_status: "active" | "on_leave" | "terminated" | "suspended"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "intern"
        | "temporary"
      feedback_recommendation:
        | "strong_hire"
        | "hire"
        | "neutral"
        | "no_hire"
        | "strong_no_hire"
      interview_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "rescheduled"
        | "no_show"
      interview_type: "phone" | "video" | "onsite" | "panel" | "technical"
      job_status: "draft" | "open" | "closed" | "on_hold"
      leave_status: "pending" | "approved" | "rejected" | "canceled"
      log_severity: "low" | "medium" | "high" | "critical"
      offer_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "sent"
        | "accepted"
        | "declined"
        | "negotiating"
        | "expired"
        | "withdrawn"
      payroll_status: "draft" | "processing" | "completed" | "failed"
      permission_action:
        | "read"
        | "create"
        | "update"
        | "delete"
        | "approve"
        | "process"
        | "verify"
        | "export"
        | "manage"
        | "lock"
      permission_module:
        | "dashboard"
        | "employees"
        | "departments"
        | "leave"
        | "time_tracking"
        | "documents"
        | "recruitment"
        | "performance"
        | "payroll"
        | "expenses"
        | "compliance"
        | "audit"
        | "integrations"
        | "settings"
        | "users"
        | "shifts"
        | "attendance"
        | "my_team"
      plan_interval: "monthly" | "yearly"
      review_status: "draft" | "in_progress" | "completed" | "acknowledged"
      screening_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "expired"
        | "passed"
        | "failed"
      screening_test_type: "questionnaire" | "coding" | "personality" | "skills"
      security_event_type:
        | "login_success"
        | "login_failure"
        | "password_change"
        | "mfa_enabled"
        | "mfa_disabled"
        | "suspicious_activity"
        | "permission_denied"
        | "data_export"
      subdomain_request_status: "pending" | "approved" | "rejected"
      subscription_status:
        | "active"
        | "past_due"
        | "canceled"
        | "trialing"
        | "trial_expired"
        | "paused"
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
      app_role: [
        "super_admin",
        "company_admin",
        "hr_manager",
        "manager",
        "employee",
      ],
      audit_action: [
        "create",
        "read",
        "update",
        "delete",
        "login",
        "logout",
        "export",
        "import",
      ],
      candidate_status: [
        "applied",
        "screening",
        "interviewing",
        "offered",
        "hired",
        "rejected",
        "withdrawn",
      ],
      document_verification_status: [
        "pending",
        "verified",
        "rejected",
        "expired",
      ],
      employment_status: ["active", "on_leave", "terminated", "suspended"],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "intern",
        "temporary",
      ],
      feedback_recommendation: [
        "strong_hire",
        "hire",
        "neutral",
        "no_hire",
        "strong_no_hire",
      ],
      interview_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "rescheduled",
        "no_show",
      ],
      interview_type: ["phone", "video", "onsite", "panel", "technical"],
      job_status: ["draft", "open", "closed", "on_hold"],
      leave_status: ["pending", "approved", "rejected", "canceled"],
      log_severity: ["low", "medium", "high", "critical"],
      offer_status: [
        "draft",
        "pending_approval",
        "approved",
        "sent",
        "accepted",
        "declined",
        "negotiating",
        "expired",
        "withdrawn",
      ],
      payroll_status: ["draft", "processing", "completed", "failed"],
      permission_action: [
        "read",
        "create",
        "update",
        "delete",
        "approve",
        "process",
        "verify",
        "export",
        "manage",
        "lock",
      ],
      permission_module: [
        "dashboard",
        "employees",
        "departments",
        "leave",
        "time_tracking",
        "documents",
        "recruitment",
        "performance",
        "payroll",
        "expenses",
        "compliance",
        "audit",
        "integrations",
        "settings",
        "users",
        "shifts",
        "attendance",
        "my_team",
      ],
      plan_interval: ["monthly", "yearly"],
      review_status: ["draft", "in_progress", "completed", "acknowledged"],
      screening_status: [
        "pending",
        "in_progress",
        "completed",
        "expired",
        "passed",
        "failed",
      ],
      screening_test_type: ["questionnaire", "coding", "personality", "skills"],
      security_event_type: [
        "login_success",
        "login_failure",
        "password_change",
        "mfa_enabled",
        "mfa_disabled",
        "suspicious_activity",
        "permission_denied",
        "data_export",
      ],
      subdomain_request_status: ["pending", "approved", "rejected"],
      subscription_status: [
        "active",
        "past_due",
        "canceled",
        "trialing",
        "trial_expired",
        "paused",
      ],
    },
  },
} as const
