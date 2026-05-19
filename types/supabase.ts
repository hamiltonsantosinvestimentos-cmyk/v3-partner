export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "ADMIN" | "PARTNER" | "MESA_OPERACIONAL" | "GESTAO";
export type OperationStatus =
  | "DRAFT"
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";
export type DealStage =
  | "PROSPECTING"
  | "QUALIFICATION"
  | "DUE_DILIGENCE"
  | "NEGOTIATION"
  | "CLOSING"
  | "CLOSED_WON"
  | "CLOSED_LOST";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type CreditDeskLevel = "NIVEL_1" | "NIVEL_2" | "NIVEL_3";
export type CreativeJobStatus = "PENDING" | "PROCESSING" | "DONE" | "ERROR";
export type CreativeFileType = "cim" | "teaser" | "linkedin_post" | "linkedin_story";
export type CreativeLanguage = "pt-br" | "en";
export type CreativeFormat = "pdf" | "png" | "jpg";

// Estrutura do campo asset_data (JSONB) em ma_deals
export interface AssetData {
  descricao_ptbr?: string;
  descricao_en?: string;
  tese_investimento?: string;
  tese_investimento_en?: string;
  processo_regulatorio?: string;
  processo_v3?: string;
  metricas?: Array<{ label: string; value: string; sub?: string }>;
  diferenciais?: string[];
  riscos?: Array<{ nivel: "baixo" | "medio" | "alto"; descricao: string; mitigacao: string }>;
  fotos?: Array<{ url: string; caption: string }>;
  confidencialidade?: string;
  valor_ativo_total?: string;
  tir_estimada?: string;
  prazo_retorno?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          phone: string | null;
          document_cpf: string | null;
          is_active: boolean;
          created_by: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          phone?: string | null;
          document_cpf?: string | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          phone?: string | null;
          document_cpf?: string | null;
          is_active?: boolean;
        };
      };
      split_fiscal: {
        Row: {
          id: string;
          code: string;
          title: string;
          description: string | null;
          partner_id: string | null;
          created_by: string;
          total_value: number;
          split_percent: number | null;
          partner_revenue: number | null;
          status: OperationStatus;
          due_date: string | null;
          approved_at: string | null;
          approved_by: string | null;
          notes: string | null;
          attachments: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          title: string;
          description?: string | null;
          partner_id?: string | null;
          created_by: string;
          total_value: number;
          split_percent?: number | null;
          partner_revenue?: number | null;
          status?: OperationStatus;
          due_date?: string | null;
          notes?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          partner_id?: string | null;
          total_value?: number;
          split_percent?: number | null;
          partner_revenue?: number | null;
          status?: OperationStatus;
          due_date?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          notes?: string | null;
        };
      };
      ma_deals: {
        Row: {
          id: string;
          code: string;
          title: string;
          description: string | null;
          buyer_name: string | null;
          seller_name: string | null;
          target_company: string;
          sector: string | null;
          deal_value: number | null;
          ebitda_multiple: number | null;
          revenue_ttm: number | null;
          ebitda_ttm: number | null;
          stage: DealStage;
          probability_percent: number;
          expected_close_date: string | null;
          assigned_to: string | null;
          created_by: string;
          status: OperationStatus;
          documents: Json;
          tags: string[];
          notes: string | null;
          // Colunas adicionadas pela migration supabase-schema-criativos.sql
          slug: string | null;
          location: string | null;
          cover_photo_url: string | null;
          asset_data: AssetData;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          title: string;
          description?: string | null;
          buyer_name?: string | null;
          seller_name?: string | null;
          target_company: string;
          sector?: string | null;
          deal_value?: number | null;
          ebitda_multiple?: number | null;
          revenue_ttm?: number | null;
          ebitda_ttm?: number | null;
          stage?: DealStage;
          probability_percent?: number;
          expected_close_date?: string | null;
          assigned_to?: string | null;
          created_by: string;
          status?: OperationStatus;
          notes?: string | null;
          slug?: string | null;
          location?: string | null;
          cover_photo_url?: string | null;
          asset_data?: AssetData;
        };
        Update: {
          title?: string;
          stage?: DealStage;
          probability_percent?: number;
          deal_value?: number | null;
          assigned_to?: string | null;
          status?: OperationStatus;
          notes?: string | null;
          slug?: string | null;
          location?: string | null;
          cover_photo_url?: string | null;
          asset_data?: AssetData;
        };
      };
      creative_jobs: {
        Row: {
          id: string;
          deal_id: string;
          status: CreativeJobStatus;
          progress: number;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          deal_id: string;
          status?: CreativeJobStatus;
          progress?: number;
          error_message?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: CreativeJobStatus;
          progress?: number;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      creative_files: {
        Row: {
          id: string;
          deal_id: string;
          job_id: string | null;
          file_type: CreativeFileType;
          language: CreativeLanguage;
          format: CreativeFormat;
          storage_path: string;
          public_url: string | null;
          file_size_kb: number | null;
          created_at: string;
        };
        Insert: {
          deal_id: string;
          job_id?: string | null;
          file_type: CreativeFileType;
          language: CreativeLanguage;
          format: CreativeFormat;
          storage_path: string;
          public_url?: string | null;
          file_size_kb?: number | null;
        };
        Update: {
          public_url?: string | null;
          file_size_kb?: number | null;
        };
      };
      operational_tickets: {
        Row: {
          id: string;
          code: string;
          title: string;
          description: string | null;
          category: string;
          priority: TicketPriority;
          requester_id: string;
          assigned_to: string | null;
          status: OperationStatus;
          resolved_at: string | null;
          resolution: string | null;
          attachments: Json;
          tags: string[];
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          title: string;
          description?: string | null;
          category: string;
          priority?: TicketPriority;
          requester_id: string;
          assigned_to?: string | null;
          status?: OperationStatus;
          due_date?: string | null;
        };
        Update: {
          title?: string;
          status?: OperationStatus;
          assigned_to?: string | null;
          priority?: TicketPriority;
          resolved_at?: string | null;
          resolution?: string | null;
        };
      };
      credit_desk_proposals: {
        Row: {
          id: string;
          code: string;
          title: string;
          client_name: string;
          client_cpf_cnpj: string | null;
          credit_line: string;
          requested_value: number;
          approved_value: number | null;
          current_level: CreditDeskLevel;
          status: OperationStatus;
          partner_id: string | null;
          level1_analyst_id: string | null;
          level2_analyst_id: string | null;
          level3_approver_id: string | null;
          level1_notes: string | null;
          level2_notes: string | null;
          level3_notes: string | null;
          level1_at: string | null;
          level2_at: string | null;
          level3_at: string | null;
          documents: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          title: string;
          client_name: string;
          client_cpf_cnpj?: string | null;
          credit_line: string;
          requested_value: number;
          current_level?: CreditDeskLevel;
          status?: OperationStatus;
          partner_id?: string | null;
          created_by: string;
        };
        Update: {
          current_level?: CreditDeskLevel;
          status?: OperationStatus;
          approved_value?: number | null;
          level1_analyst_id?: string | null;
          level2_analyst_id?: string | null;
          level3_approver_id?: string | null;
          level1_notes?: string | null;
          level2_notes?: string | null;
          level3_notes?: string | null;
          level1_at?: string | null;
          level2_at?: string | null;
          level3_at?: string | null;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          messages: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title?: string | null;
          messages?: Json;
        };
        Update: {
          title?: string | null;
          messages?: Json;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string | null;
          type: string;
          read: boolean;
          action_url: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          message?: string | null;
          type?: string;
          read?: boolean;
          action_url?: string | null;
        };
        Update: {
          read?: boolean;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          sender_name: string;
          sender_role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          sender_id: string;
          sender_name: string;
          sender_role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      operation_status: OperationStatus;
      deal_stage: DealStage;
      ticket_priority: TicketPriority;
      credit_desk_level: CreditDeskLevel;
    };
  };
}
