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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      activation_codes: {
        Row: {
          app_access_duration_days: number
          code: string
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          updated_at: string
        }
        Insert: {
          app_access_duration_days?: number
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          updated_at?: string
        }
        Update: {
          app_access_duration_days?: number
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          tts_request_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          tts_request_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          tts_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_tts_request_id_fkey"
            columns: ["tts_request_id"]
            isOneToOne: false
            referencedRelation: "tts_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_plans: {
        Row: {
          created_at: string
          credits_included: number
          duration_days: number | null
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          credits_included: number
          duration_days?: number | null
          id?: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string
          credits_included?: number
          duration_days?: number | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      document_regions: {
        Row: {
          created_at: string
          description: string | null
          document_id: string
          height: number
          id: string
          name: string
          page: number
          type: string
          user_id: string
          width: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_id: string
          height: number
          id?: string
          name: string
          page: number
          type: string
          user_id: string
          width: number
          x: number
          y: number
        }
        Update: {
          created_at?: string
          description?: string | null
          document_id?: string
          height?: number
          id?: string
          name?: string
          page?: number
          type?: string
          user_id?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_regions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_texts: {
        Row: {
          assigned_region_id: string | null
          content: string
          created_at: string
          document_id: string
          id: string
          order_index: number
          page: number
          title: string
          user_id: string
        }
        Insert: {
          assigned_region_id?: string | null
          content: string
          created_at?: string
          document_id: string
          id?: string
          order_index: number
          page?: number
          title: string
          user_id: string
        }
        Update: {
          assigned_region_id?: string | null
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          order_index?: number
          page?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_texts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_document_regions"
            columns: ["assigned_region_id"]
            isOneToOne: false
            referencedRelation: "document_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          drm_protected_pages: Json | null
          folder_id: string | null
          id: string
          is_private: boolean
          metadata: Json | null
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          drm_protected_pages?: Json | null
          folder_id?: string | null
          id?: string
          is_private?: boolean
          metadata?: Json | null
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          drm_protected_pages?: Json | null
          folder_id?: string | null
          id?: string
          is_private?: boolean
          metadata?: Json | null
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits_remaining: number
          email: string | null
          full_name: string | null
          id: string
          jooy_app_activated: boolean
          onboarding_completed: boolean
          plan_id: string | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number
          email?: string | null
          full_name?: string | null
          id: string
          jooy_app_activated?: boolean
          onboarding_completed?: boolean
          plan_id?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number
          email?: string | null
          full_name?: string | null
          id?: string
          jooy_app_activated?: boolean
          onboarding_completed?: boolean
          plan_id?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      text_assignments: {
        Row: {
          created_at: string
          document_id: string
          id: string
          region_id: string
          text_content: string
          text_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          region_id: string
          text_content: string
          text_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          region_id?: string
          text_content?: string
          text_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_audio_files: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_size: number | null
          id: string
          page_number: number
          status: string
          storage_path: string
          tts_request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          page_number: number
          status?: string
          storage_path: string
          tts_request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_size?: number | null
          id?: string
          page_number?: number
          status?: string
          storage_path?: string
          tts_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tts_audio_files_tts_request_id_fkey"
            columns: ["tts_request_id"]
            isOneToOne: false
            referencedRelation: "tts_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_requests: {
        Row: {
          cost_in_credits: number
          created_at: string
          document_id: string
          extra_cost_da: number | null
          final_audio_path: string | null
          id: string
          requested_pages: number[]
          status: string
          updated_at: string
          user_id: string
          voice_type: string | null
        }
        Insert: {
          cost_in_credits: number
          created_at?: string
          document_id: string
          extra_cost_da?: number | null
          final_audio_path?: string | null
          id?: string
          requested_pages: number[]
          status?: string
          updated_at?: string
          user_id: string
          voice_type?: string | null
        }
        Update: {
          cost_in_credits?: number
          created_at?: string
          document_id?: string
          extra_cost_da?: number | null
          final_audio_path?: string | null
          id?: string
          requested_pages?: number[]
          status?: string
          updated_at?: string
          user_id?: string
          voice_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tts_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tts_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activations: {
        Row: {
          activated_at: string
          activation_code_id: string
          app_access_expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          activation_code_id: string
          app_access_expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activated_at?: string
          activation_code_id?: string
          app_access_expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activations_activation_code_id_fkey"
            columns: ["activation_code_id"]
            isOneToOne: false
            referencedRelation: "activation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_level_activations: {
        Row: {
          access_expires_at: string
          activated_at: string
          activation_code_id: string
          created_at: string
          folder_id: string
          id: string
          user_id: string
        }
        Insert: {
          access_expires_at: string
          activated_at?: string
          activation_code_id: string
          created_at?: string
          folder_id: string
          id?: string
          user_id: string
        }
        Update: {
          access_expires_at?: string
          activated_at?: string
          activation_code_id?: string
          created_at?: string
          folder_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_level_activations_activation_code_id_fkey"
            columns: ["activation_code_id"]
            isOneToOne: false
            referencedRelation: "activation_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_level_activations_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_owner: {
        Args: { requested_user_id: string; user_id: string }
        Returns: boolean
      }
      user_has_level_access: {
        Args: { folder_id_param: string; user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "user" | "admin" | "student"
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
      user_role: ["user", "admin", "student"],
    },
  },
} as const
