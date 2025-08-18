export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      worksheets: {
        Row: {
          id: string
          document_name: string
          document_id: string
          drm_protected: boolean | null
          drm_protected_pages: number[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          document_name: string
          document_id?: string
          drm_protected?: boolean | null
          drm_protected_pages?: number[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          document_name?: string
          document_id?: string
          drm_protected?: boolean | null
          drm_protected_pages?: number[] | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      regions: {
        Row: {
          id: string
          worksheet_id: string
          page: number
          x: number
          y: number
          width: number
          height: number
          type: string
          name: string
          description: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          worksheet_id: string
          page: number
          x: number
          y: number
          width: number
          height: number
          type?: string
          name: string
          description?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          worksheet_id?: string
          page?: number
          x?: number
          y?: number
          width?: number
          height?: number
          type?: string
          name?: string
          description?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
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