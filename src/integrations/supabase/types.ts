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
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          instance_id: string | null
          instance_status: string | null
          last_activity: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          last_activity?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          instance_id?: string | null
          instance_status?: string | null
          last_activity?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_chats: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          instance_id: string
          is_group: boolean | null
          last_message: string | null
          last_message_time: string | null
          name: string | null
          profile_pic_url: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          instance_id: string
          is_group?: boolean | null
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          profile_pic_url?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_group?: boolean | null
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          profile_pic_url?: string | null
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
          message_id: string
          message_type: string | null
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
          message_id: string
          message_type?: string | null
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
          message_id?: string
          message_type?: string | null
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
