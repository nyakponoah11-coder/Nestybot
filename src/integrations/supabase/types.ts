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
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          status: string
          unread_for_support: number
          unread_for_visitor: number
          updated_at: string
          visitor_name: string | null
          visitor_phone: string | null
          visitor_session: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          unread_for_support?: number
          unread_for_visitor?: number
          updated_at?: string
          visitor_name?: string | null
          visitor_phone?: string | null
          visitor_session: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          unread_for_support?: number
          unread_for_visitor?: number
          updated_at?: string
          visitor_name?: string | null
          visitor_phone?: string | null
          visitor_session?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      checker_orders: {
        Row: {
          amount: number
          checker_type: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string
          datamart_reference: string | null
          delivery_status: string
          error_message: string | null
          id: string
          payment_status: string
          pin: string | null
          reference: string
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          checker_type: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone: string
          datamart_reference?: string | null
          delivery_status?: string
          error_message?: string | null
          id?: string
          payment_status?: string
          pin?: string | null
          reference: string
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          checker_type?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string
          datamart_reference?: string | null
          delivery_status?: string
          error_message?: string | null
          id?: string
          payment_status?: string
          pin?: string | null
          reference?: string
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          capacity: string
          created_at: string
          customer_email: string
          datamart_reference: string | null
          delivery_status: string
          error_message: string | null
          id: string
          mb: number
          network: string
          payment_status: string
          product_id: string | null
          recipient_phone: string
          reference: string
          updated_at: string
        }
        Insert: {
          amount: number
          capacity: string
          created_at?: string
          customer_email: string
          datamart_reference?: string | null
          delivery_status?: string
          error_message?: string | null
          id?: string
          mb: number
          network: string
          payment_status?: string
          product_id?: string | null
          recipient_phone: string
          reference: string
          updated_at?: string
        }
        Update: {
          amount?: number
          capacity?: string
          created_at?: string
          customer_email?: string
          datamart_reference?: string | null
          delivery_status?: string
          error_message?: string | null
          id?: string
          mb?: number
          network?: string
          payment_status?: string
          product_id?: string | null
          recipient_phone?: string
          reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          capacity: string
          created_at: string
          id: string
          in_stock: boolean
          mb: number
          name: string | null
          network: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          capacity: string
          created_at?: string
          id?: string
          in_stock?: boolean
          mb: number
          name?: string | null
          network: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capacity?: string
          created_at?: string
          id?: string
          in_stock?: boolean
          mb?: number
          name?: string | null
          network?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      referral_redemptions: {
        Row: {
          created_at: string
          friend_phone: string
          id: string
          order_reference: string
          referral_id: string
        }
        Insert: {
          created_at?: string
          friend_phone: string
          id?: string
          order_reference: string
          referral_id: string
        }
        Update: {
          created_at?: string
          friend_phone?: string
          id?: string
          order_reference?: string
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_redemptions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          owner_phone: string
          redemptions_count: number
          reward_reference: string | null
          reward_sent: boolean
          reward_sent_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          owner_phone: string
          redemptions_count?: number
          reward_reference?: string | null
          reward_sent?: boolean
          reward_sent_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          owner_phone?: string
          redemptions_count?: number
          reward_reference?: string | null
          reward_sent?: boolean
          reward_sent_at?: string | null
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          amount: number
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_phone: string
          delivery_status: string
          id: string
          netflix_last_code: string | null
          netflix_last_code_at: string | null
          netflix_login_expires_at: string | null
          notes: string | null
          payment_status: string
          reference: string
          service: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_phone: string
          delivery_status?: string
          id?: string
          netflix_last_code?: string | null
          netflix_last_code_at?: string | null
          netflix_login_expires_at?: string | null
          notes?: string | null
          payment_status?: string
          reference: string
          service: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string
          delivery_status?: string
          id?: string
          netflix_last_code?: string | null
          netflix_last_code_at?: string | null
          netflix_login_expires_at?: string | null
          notes?: string | null
          payment_status?: string
          reference?: string
          service?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      spin_redemptions: {
        Row: {
          buyer_phone: string
          created_at: string
          id: string
          order_reference: string
          spin_id: string
        }
        Insert: {
          buyer_phone: string
          created_at?: string
          id?: string
          order_reference: string
          spin_id: string
        }
        Update: {
          buyer_phone?: string
          created_at?: string
          id?: string
          order_reference?: string
          spin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spin_redemptions_spin_id_fkey"
            columns: ["spin_id"]
            isOneToOne: false
            referencedRelation: "spin_wins"
            referencedColumns: ["id"]
          },
        ]
      }
      spin_wins: {
        Row: {
          code: string
          created_at: string
          id: string
          orders_count: number
          owner_phone: string
          prize_capacity: string
          reward_reference: string | null
          reward_sent: boolean
          reward_sent_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          orders_count?: number
          owner_phone: string
          prize_capacity: string
          reward_reference?: string | null
          reward_sent?: boolean
          reward_sent_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          orders_count?: number
          owner_phone?: string
          prize_capacity?: string
          reward_reference?: string | null
          reward_sent?: boolean
          reward_sent_at?: string | null
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Enums: {
      app_role: "admin" | "user" | "support"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "support"],
    },
  },
} as const
