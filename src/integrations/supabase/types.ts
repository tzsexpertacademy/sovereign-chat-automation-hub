export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          client_id: string
          created_at: string
          created_by_assistant: boolean | null
          customer_id: string
          end_time: string
          google_event_id: string | null
          id: string
          notes: string | null
          price: number | null
          professional_id: string
          recurrence_end_date: string | null
          recurrence_type: Database["public"]["Enums"]["recurrence_type"] | null
          service_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          client_id: string
          created_at?: string
          created_by_assistant?: boolean | null
          customer_id: string
          end_time: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          professional_id: string
          recurrence_end_date?: string | null
          recurrence_type?:
            | Database["public"]["Enums"]["recurrence_type"]
            | null
          service_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          client_id?: string
          created_at?: string
          created_by_assistant?: boolean | null
          customer_id?: string
          end_time?: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          professional_id?: string
          recurrence_end_date?: string | null
          recurrence_type?:
            | Database["public"]["Enums"]["recurrence_type"]
            | null
          service_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_video_library: {
        Row: {
          assistant_id: string
          category: string
          created_at: string
          duration_seconds: number | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          original_name: string
          storage_path: string
          trigger_phrase: string
          updated_at: string
        }
        Insert: {
          assistant_id: string
          category?: string
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          storage_path: string
          trigger_phrase: string
          updated_at?: string
        }
        Update: {
          assistant_id?: string
          category?: string
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          storage_path?: string
          trigger_phrase?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistants: {
        Row: {
          advanced_settings: Json | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean | null
          model: string
          name: string
          prompt: string
          triggers: Json | null
          updated_at: string
        }
        Insert: {
          advanced_settings?: Json | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          model?: string
          name: string
          prompt: string
          triggers?: Json | null
          updated_at?: string
        }
        Update: {
          advanced_settings?: Json | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          model?: string
          name?: string
          prompt?: string
          triggers?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_campaigns: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          message_template: string
          name: string
          next_run_at: string | null
          queue_id: string | null
          schedule_config: Json | null
          send_count: number | null
          success_count: number | null
          target_filters: Json | null
          trigger_conditions: Json | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          message_template: string
          name: string
          next_run_at?: string | null
          queue_id?: string | null
          schedule_config?: Json | null
          send_count?: number | null
          success_count?: number | null
          target_filters?: Json | null
          trigger_conditions?: Json | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          message_template?: string
          name?: string
          next_run_at?: string | null
          queue_id?: string | null
          schedule_config?: Json | null
          send_count?: number | null
          success_count?: number | null
          target_filters?: Json | null
          trigger_conditions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automated_campaigns_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          advance_booking_days: number | null
          auto_confirm_appointments: boolean | null
          booking_window_end: string | null
          booking_window_start: string | null
          client_id: string
          created_at: string
          google_calendar_credentials: Json | null
          google_calendar_integration_enabled: boolean | null
          id: string
          reminder_hours_before: number | null
          same_day_booking_enabled: boolean | null
          send_confirmation_messages: boolean | null
          send_reminder_messages: boolean | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          advance_booking_days?: number | null
          auto_confirm_appointments?: boolean | null
          booking_window_end?: string | null
          booking_window_start?: string | null
          client_id: string
          created_at?: string
          google_calendar_credentials?: Json | null
          google_calendar_integration_enabled?: boolean | null
          id?: string
          reminder_hours_before?: number | null
          same_day_booking_enabled?: boolean | null
          send_confirmation_messages?: boolean | null
          send_reminder_messages?: boolean | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          advance_booking_days?: number | null
          auto_confirm_appointments?: boolean | null
          booking_window_end?: string | null
          booking_window_start?: string | null
          client_id?: string
          created_at?: string
          google_calendar_credentials?: Json | null
          google_calendar_integration_enabled?: boolean | null
          id?: string
          reminder_hours_before?: number | null
          same_day_booking_enabled?: boolean | null
          send_confirmation_messages?: boolean | null
          send_reminder_messages?: boolean | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      business_collections: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          position: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      business_products: {
        Row: {
          business_id: string
          collection_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          images: Json | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          position: number | null
          price: number | null
          sku: string | null
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          collection_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          position?: number | null
          price?: number | null
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          collection_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          position?: number | null
          price?: number | null
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "business_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ai_configs: {
        Row: {
          client_id: string
          created_at: string
          default_model: string
          id: string
          online_status_config: Json | null
          openai_api_key: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          default_model?: string
          id?: string
          online_status_config?: Json | null
          openai_api_key: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          default_model?: string
          id?: string
          online_status_config?: Json | null
          openai_api_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_ai_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          annual_plan: boolean | null
          avatar_url: string | null
          billing_address: Json | null
          brand_colors: Json | null
          business_id: string | null
          business_token: string | null
          company: string | null
          company_logo_url: string | null
          created_at: string
          current_instances: number | null
          custom_theme: Json | null
          email: string
          id: string
          instance_id: string | null
          instance_status: string | null
          last_activity: string | null
          max_instances: number | null
          mrr: number | null
          name: string
          payment_method: string | null
          phone: string | null
          plan: Database["public"]["Enums"]["plan_type"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_status: string | null
          trial_end_date: string | null
          updated_at: string
        }
        Insert: {
          annual_plan?: boolean | null
          avatar_url?: string | null
          billing_address?: Json | null
          brand_colors?: Json | null
          business_id?: string | null
          business_token?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          current_instances?: number | null
          custom_theme?: Json | null
          email: string
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          last_activity?: string | null
          max_instances?: number | null
          mrr?: number | null
          name: string
          payment_method?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Update: {
          annual_plan?: boolean | null
          avatar_url?: string | null
          billing_address?: Json | null
          brand_colors?: Json | null
          business_id?: string | null
          business_token?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          current_instances?: number | null
          custom_theme?: Json | null
          email?: string
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          last_activity?: string | null
          max_instances?: number | null
          mrr?: number | null
          name?: string
          payment_method?: string | null
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      codechat_businesses: {
        Row: {
          active: boolean
          business_id: string
          business_token: string
          client_id: string | null
          country: string
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          language: string
          name: string
          phone: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          business_token: string
          client_id?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          language?: string
          name: string
          phone: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          business_token?: string
          client_id?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          language?: string
          name?: string
          phone?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "codechat_businesses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      codechat_instance_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          instance_id: string | null
          jwt_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_id?: string | null
          jwt_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_id?: string | null
          jwt_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "codechat_instance_tokens_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_context: {
        Row: {
          chat_id: string
          client_id: string
          conversation_summary: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          instance_id: string
          key_information: Json | null
          last_topics: Json | null
          personality_notes: string | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          client_id: string
          conversation_summary?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          instance_id: string
          key_information?: Json | null
          last_topics?: Json | null
          personality_notes?: string | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          client_id?: string
          conversation_summary?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          instance_id?: string
          key_information?: Json | null
          last_topics?: Json | null
          personality_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversation_queue_states: {
        Row: {
          chat_id: string
          conversation_context: Json | null
          created_at: string
          current_queue_id: string | null
          id: string
          instance_id: string
          last_activity: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          conversation_context?: Json | null
          created_at?: string
          current_queue_id?: string | null
          id?: string
          instance_id: string
          last_activity?: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          conversation_context?: Json | null
          created_at?: string
          current_queue_id?: string | null
          id?: string
          instance_id?: string
          last_activity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_queue_states_current_queue_id_fkey"
            columns: ["current_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_queue_states_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tickets: {
        Row: {
          ai_processing_attempts: number | null
          assigned_assistant_id: string | null
          assigned_queue_id: string | null
          auto_close_at: string | null
          chat_id: string
          client_id: string
          closed_at: string | null
          created_at: string
          current_stage_id: string | null
          custom_fields: Json | null
          customer_id: string | null
          customer_satisfaction_score: number | null
          escalation_level: number | null
          first_response_at: string | null
          human_takeover_reason: string | null
          id: string
          instance_id: string
          internal_notes: Json | null
          is_archived: boolean | null
          last_activity_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          priority: number
          queue_assignment_history: Json | null
          resolution_time_minutes: number | null
          status: string
          tags: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_processing_attempts?: number | null
          assigned_assistant_id?: string | null
          assigned_queue_id?: string | null
          auto_close_at?: string | null
          chat_id: string
          client_id: string
          closed_at?: string | null
          created_at?: string
          current_stage_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_satisfaction_score?: number | null
          escalation_level?: number | null
          first_response_at?: string | null
          human_takeover_reason?: string | null
          id?: string
          instance_id: string
          internal_notes?: Json | null
          is_archived?: boolean | null
          last_activity_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          priority?: number
          queue_assignment_history?: Json | null
          resolution_time_minutes?: number | null
          status?: string
          tags?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_processing_attempts?: number | null
          assigned_assistant_id?: string | null
          assigned_queue_id?: string | null
          auto_close_at?: string | null
          chat_id?: string
          client_id?: string
          closed_at?: string | null
          created_at?: string
          current_stage_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          customer_satisfaction_score?: number | null
          escalation_level?: number | null
          first_response_at?: string | null
          human_takeover_reason?: string | null
          id?: string
          instance_id?: string
          internal_notes?: Json | null
          is_archived?: boolean | null
          last_activity_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          priority?: number
          queue_assignment_history?: Json | null
          resolution_time_minutes?: number | null
          status?: string
          tags?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tickets_assigned_assistant_id_fkey"
            columns: ["assigned_assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tickets_assigned_queue_id_fkey"
            columns: ["assigned_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tickets_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birth_date: string | null
          client_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          updated_at: string
          whatsapp_chat_id: string | null
        }
        Insert: {
          birth_date?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          whatsapp_chat_id?: string | null
        }
        Update: {
          birth_date?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          whatsapp_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      decrypted_audio_cache: {
        Row: {
          audio_format: string | null
          created_at: string
          decrypted_data: string
          expires_at: string | null
          id: string
          message_id: string
        }
        Insert: {
          audio_format?: string | null
          created_at?: string
          decrypted_data: string
          expires_at?: string | null
          id?: string
          message_id: string
        }
        Update: {
          audio_format?: string | null
          created_at?: string
          decrypted_data?: string
          expires_at?: string | null
          id?: string
          message_id?: string
        }
        Relationships: []
      }
      decrypted_document_cache: {
        Row: {
          created_at: string
          decrypted_data: string
          document_format: string
          expires_at: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          decrypted_data: string
          document_format?: string
          expires_at: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          decrypted_data?: string
          document_format?: string
          expires_at?: string
          id?: string
          message_id?: string
        }
        Relationships: []
      }
      decrypted_image_cache: {
        Row: {
          created_at: string
          decrypted_data: string
          expires_at: string
          id: string
          image_format: string
          message_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decrypted_data: string
          expires_at: string
          id?: string
          image_format?: string
          message_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decrypted_data?: string
          expires_at?: string
          id?: string
          image_format?: string
          message_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      decrypted_video_cache: {
        Row: {
          created_at: string
          decrypted_data: string
          expires_at: string
          id: string
          message_id: string
          video_format: string
        }
        Insert: {
          created_at?: string
          decrypted_data: string
          expires_at: string
          id?: string
          message_id: string
          video_format?: string
        }
        Update: {
          created_at?: string
          decrypted_data?: string
          expires_at?: string
          id?: string
          message_id?: string
          video_format?: string
        }
        Relationships: []
      }
      funnel_lead_history: {
        Row: {
          created_at: string
          from_stage_id: string | null
          id: string
          lead_id: string
          moved_by: string
          reason: string | null
          to_stage_id: string | null
        }
        Insert: {
          created_at?: string
          from_stage_id?: string | null
          id?: string
          lead_id: string
          moved_by?: string
          reason?: string | null
          to_stage_id?: string | null
        }
        Update: {
          created_at?: string
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          moved_by?: string
          reason?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_lead_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_lead_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_lead_tags: {
        Row: {
          assigned_by: string
          created_at: string
          id: string
          lead_id: string
          tag_id: string
        }
        Insert: {
          assigned_by?: string
          created_at?: string
          id?: string
          lead_id: string
          tag_id: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          id?: string
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "funnel_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_leads: {
        Row: {
          chat_id: string
          client_id: string
          conversion_probability: number | null
          created_at: string
          current_queue_id: string | null
          current_stage_id: string | null
          custom_fields: Json | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          instance_id: string
          is_active: boolean
          last_interaction: string
          lead_source: string
          lead_value: number | null
          notes: Json | null
          priority: number
          stage_entered_at: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          client_id: string
          conversion_probability?: number | null
          created_at?: string
          current_queue_id?: string | null
          current_stage_id?: string | null
          custom_fields?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          instance_id: string
          is_active?: boolean
          last_interaction?: string
          lead_source?: string
          lead_value?: number | null
          notes?: Json | null
          priority?: number
          stage_entered_at?: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          client_id?: string
          conversion_probability?: number | null
          created_at?: string
          current_queue_id?: string | null
          current_stage_id?: string | null
          custom_fields?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          instance_id?: string
          is_active?: boolean
          last_interaction?: string
          lead_source?: string
          lead_value?: number | null
          notes?: Json | null
          priority?: number
          stage_entered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_leads_current_queue_id_fkey"
            columns: ["current_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_leads_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          auto_move_conditions: Json | null
          client_id: string
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          auto_move_conditions?: Json | null
          client_id: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          auto_move_conditions?: Json | null
          client_id?: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_tags: {
        Row: {
          client_id: string
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          client_id: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_queue_connections: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          is_active: boolean | null
          queue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean | null
          queue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean | null
          queue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_queue_connections_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_queue_connections_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      media_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          message_id: string
          mime_type: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          media_type: string
          media_url: string
          message_id: string
          mime_type: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          message_id?: string
          mime_type?: string
        }
        Relationships: []
      }
      message_batches: {
        Row: {
          chat_id: string
          client_id: string
          created_at: string
          id: string
          instance_id: string
          last_updated: string
          messages: Json
          processing_by: string | null
          processing_started_at: string | null
        }
        Insert: {
          chat_id: string
          client_id: string
          created_at?: string
          id?: string
          instance_id: string
          last_updated?: string
          messages?: Json
          processing_by?: string | null
          processing_started_at?: string | null
        }
        Update: {
          chat_id?: string
          client_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          last_updated?: string
          messages?: Json
          processing_by?: string | null
          processing_started_at?: string | null
        }
        Relationships: []
      }
      personalization_comments: {
        Row: {
          attachments: Json | null
          comment: string
          created_at: string
          id: string
          request_id: string
          user_id: string
          user_type: string
        }
        Insert: {
          attachments?: Json | null
          comment: string
          created_at?: string
          id?: string
          request_id: string
          user_id: string
          user_type: string
        }
        Update: {
          attachments?: Json | null
          comment?: string
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalization_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "personalization_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      personalization_requests: {
        Row: {
          admin_notes: string | null
          attachments: Json | null
          budget_estimate: string | null
          business_impact: string | null
          category: string
          client_id: string
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string
          id: string
          priority: string
          status: string
          technical_requirements: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: Json | null
          budget_estimate?: string | null
          business_impact?: string | null
          category?: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          id?: string
          priority?: string
          status?: string
          technical_requirements?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: Json | null
          budget_estimate?: string | null
          business_impact?: string | null
          category?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          priority?: string
          status?: string
          technical_requirements?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalization_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_schedules: {
        Row: {
          break_end_time: string | null
          break_start_time: string | null
          created_at: string
          day_of_week: Database["public"]["Enums"]["weekday"]
          end_time: string
          id: string
          is_active: boolean | null
          professional_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string
          day_of_week: Database["public"]["Enums"]["weekday"]
          end_time: string
          id?: string
          is_active?: boolean | null
          professional_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["weekday"]
          end_time?: string
          id?: string
          is_active?: boolean | null
          professional_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_schedules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          created_at: string
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          client_id: string
          created_at: string
          description: string | null
          email: string | null
          google_calendar_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          specialty: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          email?: string | null
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          specialty?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          email?: string | null
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          specialty?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_metrics: {
        Row: {
          ai_success_rate: number | null
          avg_resolution_time_minutes: number | null
          avg_response_time_minutes: number | null
          created_at: string | null
          customer_satisfaction_avg: number | null
          date: string
          human_handoff_rate: number | null
          id: string
          queue_id: string
          tickets_received: number | null
          tickets_resolved: number | null
        }
        Insert: {
          ai_success_rate?: number | null
          avg_resolution_time_minutes?: number | null
          avg_response_time_minutes?: number | null
          created_at?: string | null
          customer_satisfaction_avg?: number | null
          date: string
          human_handoff_rate?: number | null
          id?: string
          queue_id: string
          tickets_received?: number | null
          tickets_resolved?: number | null
        }
        Update: {
          ai_success_rate?: number | null
          avg_resolution_time_minutes?: number | null
          avg_response_time_minutes?: number | null
          created_at?: string | null
          customer_satisfaction_avg?: number | null
          date?: string
          human_handoff_rate?: number | null
          id?: string
          queue_id?: string
          tickets_received?: number | null
          tickets_resolved?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_metrics_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_transfers: {
        Row: {
          created_at: string | null
          from_queue_id: string | null
          id: string
          initiated_by: string | null
          ticket_id: string
          to_queue_id: string | null
          transfer_reason: string
          transfer_type: string | null
        }
        Insert: {
          created_at?: string | null
          from_queue_id?: string | null
          id?: string
          initiated_by?: string | null
          ticket_id: string
          to_queue_id?: string | null
          transfer_reason: string
          transfer_type?: string | null
        }
        Update: {
          created_at?: string | null
          from_queue_id?: string | null
          id?: string
          initiated_by?: string | null
          ticket_id?: string
          to_queue_id?: string | null
          transfer_reason?: string
          transfer_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_transfers_from_queue_id_fkey"
            columns: ["from_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_transfers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "conversation_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_transfers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "queue_kanban_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_transfers_to_queue_id_fkey"
            columns: ["to_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          assistant_id: string | null
          auto_assignment: boolean | null
          client_id: string
          created_at: string
          description: string | null
          handoff_triggers: Json | null
          id: string
          is_active: boolean | null
          max_concurrent_tickets: number | null
          name: string
          priority_level: number | null
          updated_at: string
          working_hours: Json | null
        }
        Insert: {
          assistant_id?: string | null
          auto_assignment?: boolean | null
          client_id: string
          created_at?: string
          description?: string | null
          handoff_triggers?: Json | null
          id?: string
          is_active?: boolean | null
          max_concurrent_tickets?: number | null
          name: string
          priority_level?: number | null
          updated_at?: string
          working_hours?: Json | null
        }
        Update: {
          assistant_id?: string | null
          auto_assignment?: boolean | null
          client_id?: string
          created_at?: string
          description?: string | null
          handoff_triggers?: Json | null
          id?: string
          is_active?: boolean | null
          max_concurrent_tickets?: number | null
          name?: string
          priority_level?: number | null
          updated_at?: string
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          created_at: string
          end_datetime: string
          id: string
          is_recurring: boolean | null
          professional_id: string
          reason: string
          recurrence_pattern: Json | null
          start_datetime: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_datetime: string
          id?: string
          is_recurring?: boolean | null
          professional_id: string
          reason: string
          recurrence_pattern?: Json | null
          start_datetime: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_datetime?: string
          id?: string
          is_recurring?: boolean | null
          professional_id?: string
          reason?: string
          recurrence_pattern?: Json | null
          start_datetime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_instances: number
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_instances?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_instances?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          metadata: Json | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "conversation_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "queue_kanban_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          ai_confidence_score: number | null
          audio_base64: string | null
          content: string
          created_at: string
          direct_path: string | null
          document_base64: string | null
          file_enc_sha256: string | null
          file_sha256: string | null
          from_me: boolean | null
          id: string
          image_base64: string | null
          is_ai_response: boolean | null
          is_internal_note: boolean | null
          media_duration: number | null
          media_key: string | null
          media_mime_type: string | null
          media_transcription: string | null
          media_url: string | null
          message_id: string
          message_type: string | null
          processing_status: string | null
          sender_name: string | null
          ticket_id: string
          timestamp: string
          video_base64: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          audio_base64?: string | null
          content: string
          created_at?: string
          direct_path?: string | null
          document_base64?: string | null
          file_enc_sha256?: string | null
          file_sha256?: string | null
          from_me?: boolean | null
          id?: string
          image_base64?: string | null
          is_ai_response?: boolean | null
          is_internal_note?: boolean | null
          media_duration?: number | null
          media_key?: string | null
          media_mime_type?: string | null
          media_transcription?: string | null
          media_url?: string | null
          message_id: string
          message_type?: string | null
          processing_status?: string | null
          sender_name?: string | null
          ticket_id: string
          timestamp: string
          video_base64?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          audio_base64?: string | null
          content?: string
          created_at?: string
          direct_path?: string | null
          document_base64?: string | null
          file_enc_sha256?: string | null
          file_sha256?: string | null
          from_me?: boolean | null
          id?: string
          image_base64?: string | null
          is_ai_response?: boolean | null
          is_internal_note?: boolean | null
          media_duration?: number | null
          media_key?: string | null
          media_mime_type?: string | null
          media_transcription?: string | null
          media_url?: string | null
          message_id?: string
          message_type?: string | null
          processing_status?: string | null
          sender_name?: string | null
          ticket_id?: string
          timestamp?: string
          video_base64?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "conversation_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "queue_kanban_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chats: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          instance_id: string
          is_group: boolean | null
          is_recording: boolean | null
          is_typing: boolean | null
          last_message: string | null
          last_message_time: string | null
          name: string | null
          profile_pic_url: string | null
          typing_started_at: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          instance_id: string
          is_group?: boolean | null
          is_recording?: boolean | null
          is_typing?: boolean | null
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          profile_pic_url?: string | null
          typing_started_at?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_group?: boolean | null
          is_recording?: boolean | null
          is_typing?: boolean | null
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          profile_pic_url?: string | null
          typing_started_at?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          api_version: string | null
          auth_jwt: string | null
          auth_token: string | null
          business_business_id: string | null
          client_id: string | null
          codechat_business_id: string | null
          codechat_instance_name: string | null
          connection_state: string | null
          created_at: string
          custom_name: string | null
          has_qr_code: boolean | null
          id: string
          instance_id: string
          last_import_at: string | null
          phone_number: string | null
          proxy: string | null
          qr_code: string | null
          qr_expires_at: string | null
          status: string | null
          updated_at: string
          webhook_enabled: boolean | null
          yumer_instance_name: string | null
        }
        Insert: {
          api_version?: string | null
          auth_jwt?: string | null
          auth_token?: string | null
          business_business_id?: string | null
          client_id?: string | null
          codechat_business_id?: string | null
          codechat_instance_name?: string | null
          connection_state?: string | null
          created_at?: string
          custom_name?: string | null
          has_qr_code?: boolean | null
          id?: string
          instance_id: string
          last_import_at?: string | null
          phone_number?: string | null
          proxy?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          status?: string | null
          updated_at?: string
          webhook_enabled?: boolean | null
          yumer_instance_name?: string | null
        }
        Update: {
          api_version?: string | null
          auth_jwt?: string | null
          auth_token?: string | null
          business_business_id?: string | null
          client_id?: string | null
          codechat_business_id?: string | null
          codechat_instance_name?: string | null
          connection_state?: string | null
          created_at?: string
          custom_name?: string | null
          has_qr_code?: boolean | null
          id?: string
          instance_id?: string
          last_import_at?: string | null
          phone_number?: string | null
          proxy?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          status?: string | null
          updated_at?: string
          webhook_enabled?: boolean | null
          yumer_instance_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_codechat_business_id_fkey"
            columns: ["codechat_business_id"]
            isOneToOne: false
            referencedRelation: "codechat_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          chat_id: string
          client_id: string | null
          contact_name: string | null
          created_at: string
          direct_path: string | null
          file_enc_sha256: string | null
          file_sha256: string | null
          from_me: boolean | null
          id: string
          instance_id: string
          is_processed: boolean | null
          is_read: boolean | null
          media_duration: number | null
          media_key: string | null
          media_mime_type: string | null
          media_url: string | null
          message_id: string
          message_type: string | null
          phone_number: string | null
          processed_at: string | null
          processing_started_at: string | null
          raw_data: Json | null
          read_at: string | null
          sender: string | null
          source: string | null
          timestamp: string | null
        }
        Insert: {
          body?: string | null
          chat_id: string
          client_id?: string | null
          contact_name?: string | null
          created_at?: string
          direct_path?: string | null
          file_enc_sha256?: string | null
          file_sha256?: string | null
          from_me?: boolean | null
          id?: string
          instance_id: string
          is_processed?: boolean | null
          is_read?: boolean | null
          media_duration?: number | null
          media_key?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_id: string
          message_type?: string | null
          phone_number?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          raw_data?: Json | null
          read_at?: string | null
          sender?: string | null
          source?: string | null
          timestamp?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string
          client_id?: string | null
          contact_name?: string | null
          created_at?: string
          direct_path?: string | null
          file_enc_sha256?: string | null
          file_sha256?: string | null
          from_me?: boolean | null
          id?: string
          instance_id?: string
          is_processed?: boolean | null
          is_read?: boolean | null
          media_duration?: number | null
          media_key?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_id?: string
          message_type?: string | null
          phone_number?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          raw_data?: Json | null
          read_at?: string | null
          sender?: string | null
          source?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      queue_kanban_tickets: {
        Row: {
          assigned_queue_id: string | null
          chat_id: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string | null
          instance_id: string | null
          last_activity_at: string | null
          priority: number | null
          queue_name: string | null
          status: string | null
          title: string | null
          waiting_time_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tickets_assigned_queue_id_fkey"
            columns: ["assigned_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_assign_queue: {
        Args: {
          p_client_id: string
          p_instance_id: string
          p_message_content?: string
          p_current_queue_id?: string
        }
        Returns: string
      }
      calculate_waiting_time_minutes: {
        Args: { created_at: string }
        Returns: number
      }
      check_system_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_cron_conflicts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_expired_decrypted_audio: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_decrypted_documents: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_decrypted_images: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_decrypted_videos: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_media_cache: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_qr_codes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_orphaned_batches: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      emergency_message_recovery: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      fix_malformed_media_keys: {
        Args: Record<PropertyKey, never>
        Returns: {
          fixed_count: number
          total_checked: number
          error_messages: string[]
        }[]
      }
      force_cleanup_cron_jobs: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_audio_processing_stats: {
        Args: { p_client_id: string }
        Returns: {
          total_audio_messages: number
          processed_audio: number
          pending_decryption: number
          pending_transcription: number
          orphaned_audio: number
          processing_rate: number
        }[]
      }
      get_decrypted_audio: {
        Args: { p_message_id: string }
        Returns: {
          decrypted_data: string
          audio_format: string
        }[]
      }
      get_decrypted_document: {
        Args: { p_message_id: string }
        Returns: {
          decrypted_data: string
          document_format: string
        }[]
      }
      get_decrypted_image: {
        Args: { p_message_id: string }
        Returns: {
          decrypted_data: string
          image_format: string
        }[]
      }
      get_decrypted_video: {
        Args: { p_message_id: string }
        Returns: {
          decrypted_data: string
          video_format: string
        }[]
      }
      get_max_instances_for_plan: {
        Args:
          | { plan_name: Database["public"]["Enums"]["plan_type"] }
          | { plan_slug: string }
        Returns: number
      }
      get_queue_realtime_stats: {
        Args: { client_uuid: string }
        Returns: {
          queue_id: string
          queue_name: string
          active_tickets: number
          pending_tickets: number
          avg_waiting_time: number
          oldest_ticket_minutes: number
          workload_score: number
        }[]
      }
      manage_message_batch: {
        Args: {
          p_chat_id: string
          p_client_id: string
          p_instance_id: string
          p_message: Json
        }
        Returns: Json
      }
      manage_message_batch_immediate: {
        Args: {
          p_chat_id: string
          p_client_id: string
          p_instance_id: string
          p_message: Json
        }
        Returns: Json
      }
      manage_message_batch_v2: {
        Args: {
          p_chat_id: string
          p_client_id: string
          p_instance_id: string
          p_message: Json
        }
        Returns: Json
      }
      monitor_message_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      process_handoff_triggers: {
        Args: {
          p_message_content: string
          p_current_queue_id: string
          p_client_id: string
        }
        Returns: string
      }
      reprocess_orphaned_audio: {
        Args: { p_client_id: string }
        Returns: {
          reprocessed_count: number
          error_count: number
          message_ids: string[]
        }[]
      }
      save_ticket_message: {
        Args: {
          p_ticket_id: string
          p_message_id: string
          p_content: string
          p_message_type: string
          p_from_me: boolean
          p_timestamp: string
          p_sender_name?: string
          p_media_url?: string
          p_media_duration?: number
          p_media_key?: string
          p_file_enc_sha256?: string
          p_file_sha256?: string
          p_audio_base64?: string
        }
        Returns: string
      }
      schedule_immediate_batch_processing: {
        Args: { p_batch_id: string; p_timeout_seconds?: number }
        Returns: Json
      }
      upsert_conversation_ticket: {
        Args: {
          p_client_id: string
          p_chat_id: string
          p_instance_id: string
          p_customer_name: string
          p_customer_phone: string
          p_last_message: string
          p_last_message_at: string
        }
        Returns: string
      }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      plan_type: "basic" | "standard" | "premium" | "enterprise"
      recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly"
      weekday:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
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
      appointment_status: [
        "scheduled",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      plan_type: ["basic", "standard", "premium", "enterprise"],
      recurrence_type: ["none", "daily", "weekly", "monthly", "yearly"],
      weekday: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    },
  },
} as const
