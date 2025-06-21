export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      client_ai_configs: {
        Row: {
          client_id: string
          created_at: string
          default_model: string
          id: string
          openai_api_key: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          default_model?: string
          id?: string
          openai_api_key: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          default_model?: string
          id?: string
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
          company: string | null
          created_at: string
          current_instances: number | null
          email: string
          id: string
          instance_id: string | null
          instance_status: string | null
          last_activity: string | null
          max_instances: number | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_type"] | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          current_instances?: number | null
          email: string
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          last_activity?: string | null
          max_instances?: number | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"] | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          current_instances?: number | null
          email?: string
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          last_activity?: string | null
          max_instances?: number | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"] | null
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
          assigned_assistant_id: string | null
          assigned_queue_id: string | null
          chat_id: string
          client_id: string
          closed_at: string | null
          created_at: string
          custom_fields: Json | null
          customer_id: string | null
          customer_satisfaction_score: number | null
          id: string
          instance_id: string
          internal_notes: Json | null
          is_archived: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          priority: number
          resolution_time_minutes: number | null
          status: string
          tags: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_assistant_id?: string | null
          assigned_queue_id?: string | null
          chat_id: string
          client_id: string
          closed_at?: string | null
          created_at?: string
          custom_fields?: Json | null
          customer_id?: string | null
          customer_satisfaction_score?: number | null
          id?: string
          instance_id: string
          internal_notes?: Json | null
          is_archived?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          priority?: number
          resolution_time_minutes?: number | null
          status?: string
          tags?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_assistant_id?: string | null
          assigned_queue_id?: string | null
          chat_id?: string
          client_id?: string
          closed_at?: string | null
          created_at?: string
          custom_fields?: Json | null
          customer_id?: string | null
          customer_satisfaction_score?: number | null
          id?: string
          instance_id?: string
          internal_notes?: Json | null
          is_archived?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          priority?: number
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
      queues: {
        Row: {
          assistant_id: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          assistant_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          assistant_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
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
        ]
      }
      ticket_messages: {
        Row: {
          ai_confidence_score: number | null
          content: string
          created_at: string
          from_me: boolean | null
          id: string
          is_ai_response: boolean | null
          is_internal_note: boolean | null
          media_url: string | null
          message_id: string
          message_type: string | null
          processing_status: string | null
          sender_name: string | null
          ticket_id: string
          timestamp: string
        }
        Insert: {
          ai_confidence_score?: number | null
          content: string
          created_at?: string
          from_me?: boolean | null
          id?: string
          is_ai_response?: boolean | null
          is_internal_note?: boolean | null
          media_url?: string | null
          message_id: string
          message_type?: string | null
          processing_status?: string | null
          sender_name?: string | null
          ticket_id: string
          timestamp: string
        }
        Update: {
          ai_confidence_score?: number | null
          content?: string
          created_at?: string
          from_me?: boolean | null
          id?: string
          is_ai_response?: boolean | null
          is_internal_note?: boolean | null
          media_url?: string | null
          message_id?: string
          message_type?: string | null
          processing_status?: string | null
          sender_name?: string | null
          ticket_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "conversation_tickets"
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
          client_id: string | null
          created_at: string
          has_qr_code: boolean | null
          id: string
          instance_id: string
          phone_number: string | null
          qr_code: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          has_qr_code?: boolean | null
          id?: string
          instance_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          has_qr_code?: boolean | null
          id?: string
          instance_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          chat_id: string
          created_at: string
          from_me: boolean | null
          id: string
          instance_id: string
          is_processed: boolean | null
          is_read: boolean | null
          message_id: string
          message_type: string | null
          processing_started_at: string | null
          read_at: string | null
          sender: string | null
          timestamp: string | null
        }
        Insert: {
          body?: string | null
          chat_id: string
          created_at?: string
          from_me?: boolean | null
          id?: string
          instance_id: string
          is_processed?: boolean | null
          is_read?: boolean | null
          message_id: string
          message_type?: string | null
          processing_started_at?: string | null
          read_at?: string | null
          sender?: string | null
          timestamp?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string
          created_at?: string
          from_me?: boolean | null
          id?: string
          instance_id?: string
          is_processed?: boolean | null
          is_read?: boolean | null
          message_id?: string
          message_type?: string | null
          processing_started_at?: string | null
          read_at?: string | null
          sender?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_max_instances_for_plan: {
        Args: { plan_name: Database["public"]["Enums"]["plan_type"] }
        Returns: number
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
