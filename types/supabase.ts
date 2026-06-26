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
      academy_badges: {
        Row: {
          awarded_at: string | null
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_certificates: {
        Row: {
          category_id: string
          id: string
          issued_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          id?: string
          issued_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          id?: string
          issued_at?: string
          user_id?: string
        }
        Relationships: []
      }
      academy_comments: {
        Row: {
          author_name: string | null
          comment: string
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          author_name?: string | null
          comment: string
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          author_name?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      academy_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          timestamp_secs: number
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          timestamp_secs?: number
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          timestamp_secs?: number
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      academy_progress: {
        Row: {
          progress_pct: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          progress_pct?: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          progress_pct?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      academy_quiz_results: {
        Row: {
          answers: Json | null
          attempts: number
          category_id: string
          created_at: string | null
          id: string
          passed: boolean
          score: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempts?: number
          category_id: string
          created_at?: string | null
          id?: string
          passed?: boolean
          score?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempts?: number
          category_id?: string
          created_at?: string | null
          id?: string
          passed?: boolean
          score?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      academy_video_overrides: {
        Row: {
          description: string | null
          duration: string | null
          duration_secs: number | null
          featured: boolean | null
          instructor: string | null
          instructor_role: string | null
          level: string | null
          required: boolean | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
          video_id: string
        }
        Insert: {
          description?: string | null
          duration?: string | null
          duration_secs?: number | null
          featured?: boolean | null
          instructor?: string | null
          instructor_role?: string | null
          level?: string | null
          required?: boolean | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          updated_by?: string | null
          video_id: string
        }
        Update: {
          description?: string | null
          duration?: string | null
          duration_secs?: number | null
          featured?: boolean | null
          instructor?: string | null
          instructor_role?: string | null
          level?: string | null
          required?: boolean | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          updated_by?: string | null
          video_id?: string
        }
        Relationships: []
      }
      academy_yt_links: {
        Row: {
          updated_at: string
          updated_by: string | null
          url: string
          video_id: string
        }
        Insert: {
          updated_at?: string
          updated_by?: string | null
          url: string
          video_id: string
        }
        Update: {
          updated_at?: string
          updated_by?: string | null
          url?: string
          video_id?: string
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          archived: boolean
          created_at: string
          export_type: Database["public"]["Enums"]["agent_export_type"] | null
          id: string
          messages: Json
          squad_id: string
          title: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          created_at?: string
          export_type?: Database["public"]["Enums"]["agent_export_type"] | null
          id?: string
          messages?: Json
          squad_id: string
          title?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          created_at?: string
          export_type?: Database["public"]["Enums"]["agent_export_type"] | null
          id?: string
          messages?: Json
          squad_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "deal_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      brand_voice_audits: {
        Row: {
          archetype_match: string | null
          context_type: string
          created_at: string
          id: string
          input_text: string
          issues: string[] | null
          overridden_by: string | null
          override_reason: string | null
          passed: boolean
          score: number
          suggestions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype_match?: string | null
          context_type: string
          created_at?: string
          id?: string
          input_text: string
          issues?: string[] | null
          overridden_by?: string | null
          override_reason?: string | null
          passed?: boolean
          score: number
          suggestions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype_match?: string | null
          context_type?: string
          created_at?: string
          id?: string
          input_text?: string
          issues?: string[] | null
          overridden_by?: string | null
          override_reason?: string | null
          passed?: boolean
          score?: number
          suggestions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_voice_audits_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_voice_audits_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "brand_voice_audits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_voice_audits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      business_meetings: {
        Row: {
          assessment_id: string | null
          conducted_by: string
          contato_email: string | null
          contato_nome: string
          contato_telefone: string | null
          created_at: string
          deal_intake_id: string | null
          empresa_nome: string
          id: string
          ma_deal_id: string | null
          meeting_date: string
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          notas: string | null
          participantes_v3: Json | null
          pauta: string | null
          prazo_proximo_passo: string | null
          proximo_passo: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          conducted_by: string
          contato_email?: string | null
          contato_nome: string
          contato_telefone?: string | null
          created_at?: string
          deal_intake_id?: string | null
          empresa_nome: string
          id?: string
          ma_deal_id?: string | null
          meeting_date: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          notas?: string | null
          participantes_v3?: Json | null
          pauta?: string | null
          prazo_proximo_passo?: string | null
          proximo_passo?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          conducted_by?: string
          contato_email?: string | null
          contato_nome?: string
          contato_telefone?: string | null
          created_at?: string
          deal_intake_id?: string | null
          empresa_nome?: string
          id?: string
          ma_deal_id?: string | null
          meeting_date?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          notas?: string | null
          participantes_v3?: Json | null
          pauta?: string | null
          prazo_proximo_passo?: string | null
          proximo_passo?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_meetings_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "deal_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_meetings_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_meetings_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_meetings_deal_intake_id_fkey"
            columns: ["deal_intake_id"]
            isOneToOne: false
            referencedRelation: "deal_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      captacao_links: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          partner_id: string
          partner_name: string
          token: string
          uses_count: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          partner_id: string
          partner_name: string
          token: string
          uses_count?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          partner_id?: string
          partner_name?: string
          token?: string
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "captacao_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captacao_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      carousel_jobs: {
        Row: {
          arquetipo: string
          canal: string
          caption_instagram: string | null
          caption_linkedin: string | null
          created_at: string
          error_msg: string | null
          hook_extra: string | null
          id: string
          output_dir: string | null
          png_paths: string[] | null
          requested_by: string | null
          screenshot_path: string | null
          slug: string | null
          status: string
          updated_at: string
          url: string
          whatsapp_from: string | null
        }
        Insert: {
          arquetipo?: string
          canal?: string
          caption_instagram?: string | null
          caption_linkedin?: string | null
          created_at?: string
          error_msg?: string | null
          hook_extra?: string | null
          id?: string
          output_dir?: string | null
          png_paths?: string[] | null
          requested_by?: string | null
          screenshot_path?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          url: string
          whatsapp_from?: string | null
        }
        Update: {
          arquetipo?: string
          canal?: string
          caption_instagram?: string | null
          caption_linkedin?: string | null
          created_at?: string
          error_msg?: string | null
          hook_extra?: string | null
          id?: string
          output_dir?: string | null
          png_paths?: string[] | null
          requested_by?: string | null
          screenshot_path?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          url?: string
          whatsapp_from?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          room_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          room_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          room_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cm_asset_listings: {
        Row: {
          allows_tranching: boolean
          anonymous_id: string
          ask_price_floor: number | null
          asset_type: Database["public"]["Enums"]["cm_asset_type"]
          auto_accept_enabled: boolean | null
          cm_intake_token: string | null
          conditional_blocks: Json | null
          created_at: string
          created_by: string | null
          deal_room_enabled: boolean | null
          desagio_pretendido: number | null
          ente_devedor: string | null
          esfera: string | null
          expires_at: string | null
          form_submitted_at: string | null
          head_approved_at: string | null
          head_approved_by: string | null
          id: string
          intake_data: Json | null
          intake_locked: boolean | null
          listing_status: Database["public"]["Enums"]["cm_listing_status"]
          ma_deal_id: string | null
          mandato_v3_template_id: string | null
          meeting_validated_at: string | null
          metadata: Json
          natureza: string | null
          nda_document_url: string | null
          nda_signed_at: string | null
          numero_processo: string | null
          ocr_validation: Json | null
          prazo_estimado_meses: number | null
          risk_details: Json | null
          risk_score: number | null
          seller_cpf_cnpj: string | null
          seller_name: string
          seller_profile_id: string | null
          tir_estimada: number | null
          tribunal: string | null
          updated_at: string
          valor_atualizado: number | null
          valor_face: number
          vpl: number | null
        }
        Insert: {
          allows_tranching?: boolean
          anonymous_id: string
          ask_price_floor?: number | null
          asset_type: Database["public"]["Enums"]["cm_asset_type"]
          auto_accept_enabled?: boolean | null
          cm_intake_token?: string | null
          conditional_blocks?: Json | null
          created_at?: string
          created_by?: string | null
          deal_room_enabled?: boolean | null
          desagio_pretendido?: number | null
          ente_devedor?: string | null
          esfera?: string | null
          expires_at?: string | null
          form_submitted_at?: string | null
          head_approved_at?: string | null
          head_approved_by?: string | null
          id?: string
          intake_data?: Json | null
          intake_locked?: boolean | null
          listing_status?: Database["public"]["Enums"]["cm_listing_status"]
          ma_deal_id?: string | null
          mandato_v3_template_id?: string | null
          meeting_validated_at?: string | null
          metadata?: Json
          natureza?: string | null
          nda_document_url?: string | null
          nda_signed_at?: string | null
          numero_processo?: string | null
          ocr_validation?: Json | null
          prazo_estimado_meses?: number | null
          risk_details?: Json | null
          risk_score?: number | null
          seller_cpf_cnpj?: string | null
          seller_name: string
          seller_profile_id?: string | null
          tir_estimada?: number | null
          tribunal?: string | null
          updated_at?: string
          valor_atualizado?: number | null
          valor_face: number
          vpl?: number | null
        }
        Update: {
          allows_tranching?: boolean
          anonymous_id?: string
          ask_price_floor?: number | null
          asset_type?: Database["public"]["Enums"]["cm_asset_type"]
          auto_accept_enabled?: boolean | null
          cm_intake_token?: string | null
          conditional_blocks?: Json | null
          created_at?: string
          created_by?: string | null
          deal_room_enabled?: boolean | null
          desagio_pretendido?: number | null
          ente_devedor?: string | null
          esfera?: string | null
          expires_at?: string | null
          form_submitted_at?: string | null
          head_approved_at?: string | null
          head_approved_by?: string | null
          id?: string
          intake_data?: Json | null
          intake_locked?: boolean | null
          listing_status?: Database["public"]["Enums"]["cm_listing_status"]
          ma_deal_id?: string | null
          mandato_v3_template_id?: string | null
          meeting_validated_at?: string | null
          metadata?: Json
          natureza?: string | null
          nda_document_url?: string | null
          nda_signed_at?: string | null
          numero_processo?: string | null
          ocr_validation?: Json | null
          prazo_estimado_meses?: number | null
          risk_details?: Json | null
          risk_score?: number | null
          seller_cpf_cnpj?: string | null
          seller_name?: string
          seller_profile_id?: string | null
          tir_estimada?: number | null
          tribunal?: string | null
          updated_at?: string
          valor_atualizado?: number | null
          valor_face?: number
          vpl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cm_asset_listings_head_approved_by_fkey"
            columns: ["head_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_asset_listings_head_approved_by_fkey"
            columns: ["head_approved_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cm_asset_listings_ma_deal_id_fkey"
            columns: ["ma_deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_asset_listings_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_asset_listings_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cm_bids: {
        Row: {
          auto_accepted: boolean | null
          bid_value: number
          buyer_profile_id: string | null
          buyer_qualified: boolean | null
          created_at: string
          created_by: string | null
          desagio_oferecido: number | null
          expires_at: string | null
          id: string
          listing_id: string
          notes: string | null
          payment_details: Json | null
          payment_type: Database["public"]["Enums"]["cm_payment_type"]
          proof_of_funds_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["cm_bid_status"]
          tir_pretendida: number | null
          tranche_id: string | null
          updated_at: string
        }
        Insert: {
          auto_accepted?: boolean | null
          bid_value: number
          buyer_profile_id?: string | null
          buyer_qualified?: boolean | null
          created_at?: string
          created_by?: string | null
          desagio_oferecido?: number | null
          expires_at?: string | null
          id?: string
          listing_id: string
          notes?: string | null
          payment_details?: Json | null
          payment_type?: Database["public"]["Enums"]["cm_payment_type"]
          proof_of_funds_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["cm_bid_status"]
          tir_pretendida?: number | null
          tranche_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_accepted?: boolean | null
          bid_value?: number
          buyer_profile_id?: string | null
          buyer_qualified?: boolean | null
          created_at?: string
          created_by?: string | null
          desagio_oferecido?: number | null
          expires_at?: string | null
          id?: string
          listing_id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_type?: Database["public"]["Enums"]["cm_payment_type"]
          proof_of_funds_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["cm_bid_status"]
          tir_pretendida?: number | null
          tranche_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_bids_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_bids_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_bids_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_bids_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cm_bids_tranche_id_fkey"
            columns: ["tranche_id"]
            isOneToOne: false
            referencedRelation: "cm_tranches"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_buyer_alerts: {
        Row: {
          channel: string
          created_at: string
          demand_id: string | null
          id: string
          investor_profile_id: string
          is_active: boolean
          last_triggered_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          demand_id?: string | null
          id?: string
          investor_profile_id: string
          is_active?: boolean
          last_triggered_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          demand_id?: string | null
          id?: string
          investor_profile_id?: string
          is_active?: boolean
          last_triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cm_buyer_alerts_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "investor_demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_buyer_alerts_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_checklist_items: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          checklist_id: string
          created_at: string
          evidence_url: string | null
          id: string
          is_checked: boolean
          item_key: string
          label: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          checklist_id: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          is_checked?: boolean
          item_key: string
          label: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          checklist_id?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          is_checked?: boolean
          item_key?: string
          label?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cm_checklist_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_checklist_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cm_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "cm_operation_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_commission_splits: {
        Row: {
          bid_id: string | null
          commission_total_percent: number
          commission_total_value: number
          created_at: string
          id: string
          listing_id: string
          maximum_exceeded: boolean
          minimum_enforced: boolean
          override_approved_by: string | null
          split_buy_value: number
          split_platform_value: number
          split_sell_value: number
          status: string
          valor_face: number
        }
        Insert: {
          bid_id?: string | null
          commission_total_percent: number
          commission_total_value: number
          created_at?: string
          id?: string
          listing_id: string
          maximum_exceeded?: boolean
          minimum_enforced?: boolean
          override_approved_by?: string | null
          split_buy_value: number
          split_platform_value: number
          split_sell_value: number
          status?: string
          valor_face: number
        }
        Update: {
          bid_id?: string | null
          commission_total_percent?: number
          commission_total_value?: number
          created_at?: string
          id?: string
          listing_id?: string
          maximum_exceeded?: boolean
          minimum_enforced?: boolean
          override_approved_by?: string | null
          split_buy_value?: number
          split_platform_value?: number
          split_sell_value?: number
          status?: string
          valor_face?: number
        }
        Relationships: [
          {
            foreignKeyName: "cm_commission_splits_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "cm_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_commission_splits_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_commission_splits_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_commission_splits_override_approved_by_fkey"
            columns: ["override_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_commission_splits_override_approved_by_fkey"
            columns: ["override_approved_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cm_deal_room_access: {
        Row: {
          access_count: number | null
          access_tier: string | null
          access_token: string
          bid_id: string | null
          buyer_company: string | null
          buyer_email: string | null
          buyer_name: string | null
          cessao_accepted_at: string | null
          cessao_accepted_ip: string | null
          cessao_hash: string | null
          cessao_ots_proof_path: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          first_accessed_at: string | null
          geo_location: string | null
          id: string
          last_accessed_at: string | null
          listing_id: string
          mandato_v3_accepted: boolean | null
          mandato_v3_accepted_at: string | null
          mandato_v3_hash: string | null
          nda_accepted: boolean | null
          nda_accepted_at: string | null
          nda_hash: string | null
          nda_ip_address: string | null
          proof_of_funds_path: string | null
          qualification_notes: string | null
          qualification_status: string | null
          qualified_at: string | null
          qualified_by: string | null
          revoked: boolean | null
          tranche_id: string | null
          updated_at: string | null
        }
        Insert: {
          access_count?: number | null
          access_tier?: string | null
          access_token: string
          bid_id?: string | null
          buyer_company?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          cessao_accepted_at?: string | null
          cessao_accepted_ip?: string | null
          cessao_hash?: string | null
          cessao_ots_proof_path?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          first_accessed_at?: string | null
          geo_location?: string | null
          id?: string
          last_accessed_at?: string | null
          listing_id: string
          mandato_v3_accepted?: boolean | null
          mandato_v3_accepted_at?: string | null
          mandato_v3_hash?: string | null
          nda_accepted?: boolean | null
          nda_accepted_at?: string | null
          nda_hash?: string | null
          nda_ip_address?: string | null
          proof_of_funds_path?: string | null
          qualification_notes?: string | null
          qualification_status?: string | null
          qualified_at?: string | null
          qualified_by?: string | null
          revoked?: boolean | null
          tranche_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access_count?: number | null
          access_tier?: string | null
          access_token?: string
          bid_id?: string | null
          buyer_company?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          cessao_accepted_at?: string | null
          cessao_accepted_ip?: string | null
          cessao_hash?: string | null
          cessao_ots_proof_path?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          first_accessed_at?: string | null
          geo_location?: string | null
          id?: string
          last_accessed_at?: string | null
          listing_id?: string
          mandato_v3_accepted?: boolean | null
          mandato_v3_accepted_at?: string | null
          mandato_v3_hash?: string | null
          nda_accepted?: boolean | null
          nda_accepted_at?: string | null
          nda_hash?: string | null
          nda_ip_address?: string | null
          proof_of_funds_path?: string | null
          qualification_notes?: string | null
          qualification_status?: string | null
          qualified_at?: string | null
          qualified_by?: string | null
          revoked?: boolean | null
          tranche_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cm_deal_room_access_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_deal_room_access_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_deal_room_access_tranche_id_fkey"
            columns: ["tranche_id"]
            isOneToOne: false
            referencedRelation: "cm_tranches"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_escrow_operations: {
        Row: {
          bid_id: string | null
          closed_at: string | null
          contract_url: string | null
          created_at: string
          escrow_provider: string | null
          escrow_value: number
          id: string
          listing_id: string
          opened_at: string
          status: string
        }
        Insert: {
          bid_id?: string | null
          closed_at?: string | null
          contract_url?: string | null
          created_at?: string
          escrow_provider?: string | null
          escrow_value: number
          id?: string
          listing_id: string
          opened_at?: string
          status?: string
        }
        Update: {
          bid_id?: string | null
          closed_at?: string | null
          contract_url?: string | null
          created_at?: string
          escrow_provider?: string | null
          escrow_value?: number
          id?: string
          listing_id?: string
          opened_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_escrow_operations_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "cm_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_escrow_operations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_escrow_operations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_listing_documents: {
        Row: {
          created_at: string
          document_type: string
          file_size_bytes: number | null
          id: string
          listing_id: string
          ocr_result: Json | null
          original_filename: string | null
          storage_path: string
          validated_at: string | null
          validation_status: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_size_bytes?: number | null
          id?: string
          listing_id: string
          ocr_result?: Json | null
          original_filename?: string | null
          storage_path: string
          validated_at?: string | null
          validation_status?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_size_bytes?: number | null
          id?: string
          listing_id?: string
          ocr_result?: Json | null
          original_filename?: string | null
          storage_path?: string
          validated_at?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_listing_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_listing_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_operation_checklists: {
        Row: {
          bid_id: string | null
          checklist_type: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          listing_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bid_id?: string | null
          checklist_type: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          listing_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bid_id?: string | null
          checklist_type?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_operation_checklists_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "cm_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_operation_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_operation_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cm_operation_checklists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_operation_checklists_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_risk_scores: {
        Row: {
          calculated_by: string
          components: Json
          created_at: string
          id: string
          listing_id: string
          model_version: string
          score: number
        }
        Insert: {
          calculated_by?: string
          components?: Json
          created_at?: string
          id?: string
          listing_id: string
          model_version?: string
          score: number
        }
        Update: {
          calculated_by?: string
          components?: Json
          created_at?: string
          id?: string
          listing_id?: string
          model_version?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "cm_risk_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_risk_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_status_transitions: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["cm_listing_status"]
          id: string
          listing_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["cm_listing_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status: Database["public"]["Enums"]["cm_listing_status"]
          id?: string
          listing_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["cm_listing_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["cm_listing_status"]
          id?: string
          listing_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["cm_listing_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cm_status_transitions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_status_transitions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cm_tranches: {
        Row: {
          bid_id: string | null
          buyer_profile_id: string | null
          cessao_contract_url: string | null
          created_at: string
          id: string
          parent_listing_id: string
          percentage: number
          status: Database["public"]["Enums"]["cm_tranche_status"]
          tranche_code: string
          tranche_value: number
          updated_at: string
        }
        Insert: {
          bid_id?: string | null
          buyer_profile_id?: string | null
          cessao_contract_url?: string | null
          created_at?: string
          id?: string
          parent_listing_id: string
          percentage: number
          status?: Database["public"]["Enums"]["cm_tranche_status"]
          tranche_code: string
          tranche_value: number
          updated_at?: string
        }
        Update: {
          bid_id?: string | null
          buyer_profile_id?: string | null
          cessao_contract_url?: string | null
          created_at?: string
          id?: string
          parent_listing_id?: string
          percentage?: number
          status?: Database["public"]["Enums"]["cm_tranche_status"]
          tranche_code?: string
          tranche_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cm_tranches_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "cm_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_tranches_buyer_profile_id_fkey"
            columns: ["buyer_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_tranches_parent_listing_id_fkey"
            columns: ["parent_listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cm_tranches_parent_listing_id_fkey"
            columns: ["parent_listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_proposals: {
        Row: {
          clicksign_key: string | null
          clicksign_url: string | null
          code: string
          created_at: string
          created_by: string
          deal_code_ref: string | null
          deal_id: string | null
          description: string | null
          expires_at: string | null
          fund_name: string | null
          id: string
          meeting_at: string | null
          meeting_link: string | null
          metadata: Json
          partner_email: string | null
          partner_id: string | null
          partner_name: string | null
          recipient_company: string | null
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          service_type: string
          signed_at: string | null
          status: string
          tec_percentage: number | null
          title: string
          updated_at: string
          value: number | null
          viewed_at: string | null
        }
        Insert: {
          clicksign_key?: string | null
          clicksign_url?: string | null
          code: string
          created_at?: string
          created_by: string
          deal_code_ref?: string | null
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          fund_name?: string | null
          id?: string
          meeting_at?: string | null
          meeting_link?: string | null
          metadata?: Json
          partner_email?: string | null
          partner_id?: string | null
          partner_name?: string | null
          recipient_company?: string | null
          recipient_email: string
          recipient_name: string
          sent_at?: string | null
          service_type?: string
          signed_at?: string | null
          status?: string
          tec_percentage?: number | null
          title: string
          updated_at?: string
          value?: number | null
          viewed_at?: string | null
        }
        Update: {
          clicksign_key?: string | null
          clicksign_url?: string | null
          code?: string
          created_at?: string
          created_by?: string
          deal_code_ref?: string | null
          deal_id?: string | null
          description?: string | null
          expires_at?: string | null
          fund_name?: string | null
          id?: string
          meeting_at?: string | null
          meeting_link?: string | null
          metadata?: Json
          partner_email?: string | null
          partner_id?: string | null
          partner_name?: string | null
          recipient_company?: string | null
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          service_type?: string
          signed_at?: string | null
          status?: string
          tec_percentage?: number | null
          title?: string
          updated_at?: string
          value?: number | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commercial_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      commissions: {
        Row: {
          code: string
          commission_percent: number
          commission_value: number | null
          created_at: string
          created_by: string | null
          id: string
          minimum_enforced: boolean | null
          notes: string | null
          operation_closed_at: string | null
          operation_code: string | null
          operation_description: string
          operation_id: string | null
          operation_type: string
          operation_value: number
          override_approved_by: string | null
          partner_id: string
          payment_date: string | null
          split_buy: number | null
          split_platform: number | null
          split_sell: number | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          commission_percent?: number
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          minimum_enforced?: boolean | null
          notes?: string | null
          operation_closed_at?: string | null
          operation_code?: string | null
          operation_description: string
          operation_id?: string | null
          operation_type: string
          operation_value?: number
          override_approved_by?: string | null
          partner_id: string
          payment_date?: string | null
          split_buy?: number | null
          split_platform?: number | null
          split_sell?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          commission_percent?: number
          commission_value?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          minimum_enforced?: boolean | null
          notes?: string | null
          operation_closed_at?: string | null
          operation_code?: string | null
          operation_description?: string
          operation_id?: string | null
          operation_type?: string
          operation_value?: number
          override_approved_by?: string | null
          partner_id?: string
          payment_date?: string | null
          split_buy?: number | null
          split_platform?: number | null
          split_sell?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      comunicados: {
        Row: {
          assunto: string
          created_at: string
          enviado_por: string | null
          filtro: string
          id: string
          mensagem: string
          total_destinatarios: number
          total_enviados: number
        }
        Insert: {
          assunto: string
          created_at?: string
          enviado_por?: string | null
          filtro?: string
          id?: string
          mensagem: string
          total_destinatarios?: number
          total_enviados?: number
        }
        Update: {
          assunto?: string
          created_at?: string
          enviado_por?: string | null
          filtro?: string
          id?: string
          mensagem?: string
          total_destinatarios?: number
          total_enviados?: number
        }
        Relationships: []
      }
      consorcio_cartas: {
        Row: {
          admin: string
          asking_price: number
          code: string
          created_at: string
          created_by: string | null
          credit_value: number
          discount: number
          group_name: string | null
          id: string
          metadata: Json | null
          quota: string | null
          source_ref: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          admin: string
          asking_price: number
          code: string
          created_at?: string
          created_by?: string | null
          credit_value: number
          discount?: number
          group_name?: string | null
          id?: string
          metadata?: Json | null
          quota?: string | null
          source_ref?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          admin?: string
          asking_price?: number
          code?: string
          created_at?: string
          created_by?: string | null
          credit_value?: number
          discount?: number
          group_name?: string | null
          id?: string
          metadata?: Json | null
          quota?: string | null
          source_ref?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_cartas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_cartas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      consorcio_ofertas: {
        Row: {
          carta_code: string
          carta_credit_value: number
          carta_id: string
          created_at: string
          created_by: string
          id: string
          interessado_nome: string
          interessado_tel: string | null
          observacoes: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          valor_oferta: number
        }
        Insert: {
          carta_code: string
          carta_credit_value: number
          carta_id: string
          created_at?: string
          created_by: string
          id?: string
          interessado_nome: string
          interessado_tel?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          valor_oferta: number
        }
        Update: {
          carta_code?: string
          carta_credit_value?: number
          carta_id?: string
          created_at?: string
          created_by?: string
          id?: string
          interessado_nome?: string
          interessado_tel?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          valor_oferta?: number
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_ofertas_carta_id_fkey"
            columns: ["carta_id"]
            isOneToOne: false
            referencedRelation: "consorcio_cartas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_ofertas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_ofertas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "consorcio_ofertas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_ofertas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contract_approvals: {
        Row: {
          approver_id: string
          approver_name: string
          comment: string | null
          contract_id: string
          created_at: string | null
          decision: string
          id: string
        }
        Insert: {
          approver_id: string
          approver_name: string
          comment?: string | null
          contract_id: string
          created_at?: string | null
          decision: string
          id?: string
        }
        Update: {
          approver_id?: string
          approver_name?: string
          comment?: string | null
          contract_id?: string
          created_at?: string | null
          decision?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_approvals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "operation_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_notes: {
        Row: {
          author_id: string
          author_name: string
          content: string
          contract_id: string
          created_at: string | null
          decision: string | null
          id: string
          note_type: string
        }
        Insert: {
          author_id: string
          author_name: string
          content: string
          contract_id: string
          created_at?: string | null
          decision?: string | null
          id?: string
          note_type?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          content?: string
          contract_id?: string
          created_at?: string | null
          decision?: string | null
          id?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_notes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "operation_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          approval_status: string | null
          body_text_raw: string
          created_at: string | null
          created_by: string | null
          editable_sections: string[] | null
          id: string
          is_active: boolean | null
          template_name: string
          updated_at: string | null
          variables_map: Json | null
          version: number | null
          vertical: Database["public"]["Enums"]["contract_vertical"]
        }
        Insert: {
          approval_status?: string | null
          body_text_raw?: string
          created_at?: string | null
          created_by?: string | null
          editable_sections?: string[] | null
          id?: string
          is_active?: boolean | null
          template_name: string
          updated_at?: string | null
          variables_map?: Json | null
          version?: number | null
          vertical: Database["public"]["Enums"]["contract_vertical"]
        }
        Update: {
          approval_status?: string | null
          body_text_raw?: string
          created_at?: string | null
          created_by?: string | null
          editable_sections?: string[] | null
          id?: string
          is_active?: boolean | null
          template_name?: string
          updated_at?: string | null
          variables_map?: Json | null
          version?: number | null
          vertical?: Database["public"]["Enums"]["contract_vertical"]
        }
        Relationships: []
      }
      contratos_mandato: {
        Row: {
          bairro: string | null
          bairro_cadastrado: string | null
          cep: string | null
          cep_cadastrado: string | null
          client_birthdate: string | null
          client_cpf: string | null
          client_doc_url: string | null
          client_email: string
          client_name: string
          commission_perc: number
          contrato_url: string | null
          cpf_socio: string | null
          created_at: string
          credit_line: string | null
          deal_value: number | null
          endereco: string | null
          endereco_cadastrado: string | null
          estado: string | null
          estado_cadastrado: string | null
          expires_at: string
          id: string
          ip_address: string | null
          municipio: string | null
          municipio_cadastrado: string | null
          nome_fantasia: string | null
          nome_socio: string | null
          proposal_code: string | null
          proposal_id: string | null
          qualificacao_socio: string | null
          signed_at: string | null
          status: string
          telefone: string | null
          testemunha_address: string | null
          testemunha_birthdate: string | null
          testemunha_cpf: string | null
          testemunha_email: string | null
          testemunha_ip_address: string | null
          testemunha_nome: string | null
          testemunha_signed_at: string | null
          testemunha_token: string | null
          testemunha2_address: string | null
          testemunha2_birthdate: string | null
          testemunha2_cpf: string | null
          testemunha2_email: string | null
          testemunha2_ip_address: string | null
          testemunha2_nome: string | null
          testemunha2_signed_at: string | null
          testemunha2_token: string | null
          token: string
          v3_address: string | null
          v3_birthdate: string | null
          v3_cpf: string | null
          v3_email: string | null
          v3_ip_address: string | null
          v3_signed_at: string | null
          v3_signer_name: string | null
          v3_token: string | null
        }
        Insert: {
          bairro?: string | null
          bairro_cadastrado?: string | null
          cep?: string | null
          cep_cadastrado?: string | null
          client_birthdate?: string | null
          client_cpf?: string | null
          client_doc_url?: string | null
          client_email: string
          client_name: string
          commission_perc?: number
          contrato_url?: string | null
          cpf_socio?: string | null
          created_at?: string
          credit_line?: string | null
          deal_value?: number | null
          endereco?: string | null
          endereco_cadastrado?: string | null
          estado?: string | null
          estado_cadastrado?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          municipio?: string | null
          municipio_cadastrado?: string | null
          nome_fantasia?: string | null
          nome_socio?: string | null
          proposal_code?: string | null
          proposal_id?: string | null
          qualificacao_socio?: string | null
          signed_at?: string | null
          status?: string
          telefone?: string | null
          testemunha_address?: string | null
          testemunha_birthdate?: string | null
          testemunha_cpf?: string | null
          testemunha_email?: string | null
          testemunha_ip_address?: string | null
          testemunha_nome?: string | null
          testemunha_signed_at?: string | null
          testemunha_token?: string | null
          testemunha2_address?: string | null
          testemunha2_birthdate?: string | null
          testemunha2_cpf?: string | null
          testemunha2_email?: string | null
          testemunha2_ip_address?: string | null
          testemunha2_nome?: string | null
          testemunha2_signed_at?: string | null
          testemunha2_token?: string | null
          token?: string
          v3_address?: string | null
          v3_birthdate?: string | null
          v3_cpf?: string | null
          v3_email?: string | null
          v3_ip_address?: string | null
          v3_signed_at?: string | null
          v3_signer_name?: string | null
          v3_token?: string | null
        }
        Update: {
          bairro?: string | null
          bairro_cadastrado?: string | null
          cep?: string | null
          cep_cadastrado?: string | null
          client_birthdate?: string | null
          client_cpf?: string | null
          client_doc_url?: string | null
          client_email?: string
          client_name?: string
          commission_perc?: number
          contrato_url?: string | null
          cpf_socio?: string | null
          created_at?: string
          credit_line?: string | null
          deal_value?: number | null
          endereco?: string | null
          endereco_cadastrado?: string | null
          estado?: string | null
          estado_cadastrado?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          municipio?: string | null
          municipio_cadastrado?: string | null
          nome_fantasia?: string | null
          nome_socio?: string | null
          proposal_code?: string | null
          proposal_id?: string | null
          qualificacao_socio?: string | null
          signed_at?: string | null
          status?: string
          telefone?: string | null
          testemunha_address?: string | null
          testemunha_birthdate?: string | null
          testemunha_cpf?: string | null
          testemunha_email?: string | null
          testemunha_ip_address?: string | null
          testemunha_nome?: string | null
          testemunha_signed_at?: string | null
          testemunha_token?: string | null
          testemunha2_address?: string | null
          testemunha2_birthdate?: string | null
          testemunha2_cpf?: string | null
          testemunha2_email?: string | null
          testemunha2_ip_address?: string | null
          testemunha2_nome?: string | null
          testemunha2_signed_at?: string | null
          testemunha2_token?: string | null
          token?: string
          v3_address?: string | null
          v3_birthdate?: string | null
          v3_cpf?: string | null
          v3_email?: string | null
          v3_ip_address?: string | null
          v3_signed_at?: string | null
          v3_signer_name?: string | null
          v3_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_mandato_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "credit_desk_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_files: {
        Row: {
          created_at: string
          deal_id: string
          file_size_kb: number | null
          file_type: string
          format: string
          id: string
          job_id: string | null
          language: string
          public_url: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          file_size_kb?: number | null
          file_type: string
          format: string
          id?: string
          job_id?: string | null
          language?: string
          public_url?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          file_size_kb?: number | null
          file_type?: string
          format?: string
          id?: string
          job_id?: string | null
          language?: string
          public_url?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_files_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "creative_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          error_message: string | null
          id: string
          progress: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          error_message?: string | null
          id?: string
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          error_message?: string | null
          id?: string
          progress?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "creative_jobs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_desk_proposals: {
        Row: {
          approved_value: number | null
          checklist: Json | null
          client_cpf_cnpj: string | null
          client_name: string
          code: string
          comissao_instituicao_perc: number | null
          comissao_mandato_perc: number | null
          created_at: string
          created_by: string
          credit_line: string
          current_level: Database["public"]["Enums"]["credit_desk_level"]
          documents: Json | null
          id: string
          imovel_cidade: string | null
          imovel_endereco: string | null
          imovel_estado: string | null
          imovel_valor_medio: number | null
          instituicao_encaminhada: string | null
          instituicao_feedback: Json | null
          level1_analyst_id: string | null
          level1_at: string | null
          level1_notes: string | null
          level2_analyst_id: string | null
          level2_at: string | null
          level2_notes: string | null
          level3_approver_id: string | null
          level3_at: string | null
          level3_notes: string | null
          mesa_comments: Json | null
          metadata: Json | null
          partner_id: string | null
          pending_at: string | null
          pending_reason: string | null
          pending_resolved_at: string | null
          pending_resolved_by: string | null
          pending_responsible: string | null
          requested_value: number
          stage: string | null
          status: Database["public"]["Enums"]["operation_status"]
          title: string
          updated_at: string
          valor_credito_atual: number | null
        }
        Insert: {
          approved_value?: number | null
          checklist?: Json | null
          client_cpf_cnpj?: string | null
          client_name: string
          code: string
          comissao_instituicao_perc?: number | null
          comissao_mandato_perc?: number | null
          created_at?: string
          created_by: string
          credit_line: string
          current_level?: Database["public"]["Enums"]["credit_desk_level"]
          documents?: Json | null
          id?: string
          imovel_cidade?: string | null
          imovel_endereco?: string | null
          imovel_estado?: string | null
          imovel_valor_medio?: number | null
          instituicao_encaminhada?: string | null
          instituicao_feedback?: Json | null
          level1_analyst_id?: string | null
          level1_at?: string | null
          level1_notes?: string | null
          level2_analyst_id?: string | null
          level2_at?: string | null
          level2_notes?: string | null
          level3_approver_id?: string | null
          level3_at?: string | null
          level3_notes?: string | null
          mesa_comments?: Json | null
          metadata?: Json | null
          partner_id?: string | null
          pending_at?: string | null
          pending_reason?: string | null
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
          pending_responsible?: string | null
          requested_value: number
          stage?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          title: string
          updated_at?: string
          valor_credito_atual?: number | null
        }
        Update: {
          approved_value?: number | null
          checklist?: Json | null
          client_cpf_cnpj?: string | null
          client_name?: string
          code?: string
          comissao_instituicao_perc?: number | null
          comissao_mandato_perc?: number | null
          created_at?: string
          created_by?: string
          credit_line?: string
          current_level?: Database["public"]["Enums"]["credit_desk_level"]
          documents?: Json | null
          id?: string
          imovel_cidade?: string | null
          imovel_endereco?: string | null
          imovel_estado?: string | null
          imovel_valor_medio?: number | null
          instituicao_encaminhada?: string | null
          instituicao_feedback?: Json | null
          level1_analyst_id?: string | null
          level1_at?: string | null
          level1_notes?: string | null
          level2_analyst_id?: string | null
          level2_at?: string | null
          level2_notes?: string | null
          level3_approver_id?: string | null
          level3_at?: string | null
          level3_notes?: string | null
          mesa_comments?: Json | null
          metadata?: Json | null
          partner_id?: string | null
          pending_at?: string | null
          pending_reason?: string | null
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
          pending_responsible?: string | null
          requested_value?: number
          stage?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          title?: string
          updated_at?: string
          valor_credito_atual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_desk_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_level1_analyst_id_fkey"
            columns: ["level1_analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_level1_analyst_id_fkey"
            columns: ["level1_analyst_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_level2_analyst_id_fkey"
            columns: ["level2_analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_level2_analyst_id_fkey"
            columns: ["level2_analyst_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_level3_approver_id_fkey"
            columns: ["level3_approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_level3_approver_id_fkey"
            columns: ["level3_approver_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_desk_proposals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          annual_revenue: number | null
          city: string | null
          client_email: string | null
          client_token: string | null
          code: string
          converted_at: string | null
          converted_to: string | null
          created_at: string
          created_by: string
          credit_line: string | null
          document: string | null
          email: string | null
          id: string
          interactions: Json | null
          metadata: Json | null
          name: string
          next_contact: string | null
          notes: string | null
          partner_id: string | null
          partner_name: string | null
          person_type: string
          phone: string | null
          product_interest: string | null
          segment: string | null
          source: string
          state: string | null
          status: string
          updated_at: string
          visit_date: string | null
        }
        Insert: {
          annual_revenue?: number | null
          city?: string | null
          client_email?: string | null
          client_token?: string | null
          code: string
          converted_at?: string | null
          converted_to?: string | null
          created_at?: string
          created_by: string
          credit_line?: string | null
          document?: string | null
          email?: string | null
          id?: string
          interactions?: Json | null
          metadata?: Json | null
          name: string
          next_contact?: string | null
          notes?: string | null
          partner_id?: string | null
          partner_name?: string | null
          person_type?: string
          phone?: string | null
          product_interest?: string | null
          segment?: string | null
          source?: string
          state?: string | null
          status?: string
          updated_at?: string
          visit_date?: string | null
        }
        Update: {
          annual_revenue?: number | null
          city?: string | null
          client_email?: string | null
          client_token?: string | null
          code?: string
          converted_at?: string | null
          converted_to?: string | null
          created_at?: string
          created_by?: string
          credit_line?: string | null
          document?: string | null
          email?: string | null
          id?: string
          interactions?: Json | null
          metadata?: Json | null
          name?: string
          next_contact?: string | null
          notes?: string | null
          partner_id?: string | null
          partner_name?: string | null
          person_type?: string
          phone?: string | null
          product_interest?: string | null
          segment?: string | null
          source?: string
          state?: string | null
          status?: string
          updated_at?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "crm_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deal_assessments: {
        Row: {
          carbono_certificacao: string | null
          carbono_tco2e_estimativa: string | null
          created_at: string
          created_by: string | null
          deal_intake_id: string | null
          diagnostico_gerado_em: string | null
          diagnostico_notas: string | null
          empresa_cnpj: string | null
          empresa_nome: string
          fontes_receita: Json | null
          garantias: Json | null
          id: string
          instrumento_recomendado:
            | Database["public"]["Enums"]["instrumento_recomendado"]
            | null
          investidores_existentes: string | null
          lead_email: string | null
          lead_nome: string
          lead_telefone: string | null
          ma_deal_id: string | null
          municipio_contrato: string | null
          offtake_contrato: string | null
          orcamento_estruturacao: string | null
          origem: Database["public"]["Enums"]["assessment_origem"]
          projeto_estagio: string | null
          receita_anual_projecao: string | null
          score_qualificacao: number | null
          spe_status: string | null
          status: Database["public"]["Enums"]["assessment_status"]
          tokenizacao_motivo: string | null
          updated_at: string
          valor_captacao_brl: number | null
          valor_captacao_necessario: string | null
        }
        Insert: {
          carbono_certificacao?: string | null
          carbono_tco2e_estimativa?: string | null
          created_at?: string
          created_by?: string | null
          deal_intake_id?: string | null
          diagnostico_gerado_em?: string | null
          diagnostico_notas?: string | null
          empresa_cnpj?: string | null
          empresa_nome: string
          fontes_receita?: Json | null
          garantias?: Json | null
          id?: string
          instrumento_recomendado?:
            | Database["public"]["Enums"]["instrumento_recomendado"]
            | null
          investidores_existentes?: string | null
          lead_email?: string | null
          lead_nome: string
          lead_telefone?: string | null
          ma_deal_id?: string | null
          municipio_contrato?: string | null
          offtake_contrato?: string | null
          orcamento_estruturacao?: string | null
          origem?: Database["public"]["Enums"]["assessment_origem"]
          projeto_estagio?: string | null
          receita_anual_projecao?: string | null
          score_qualificacao?: number | null
          spe_status?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          tokenizacao_motivo?: string | null
          updated_at?: string
          valor_captacao_brl?: number | null
          valor_captacao_necessario?: string | null
        }
        Update: {
          carbono_certificacao?: string | null
          carbono_tco2e_estimativa?: string | null
          created_at?: string
          created_by?: string | null
          deal_intake_id?: string | null
          diagnostico_gerado_em?: string | null
          diagnostico_notas?: string | null
          empresa_cnpj?: string | null
          empresa_nome?: string
          fontes_receita?: Json | null
          garantias?: Json | null
          id?: string
          instrumento_recomendado?:
            | Database["public"]["Enums"]["instrumento_recomendado"]
            | null
          investidores_existentes?: string | null
          lead_email?: string | null
          lead_nome?: string
          lead_telefone?: string | null
          ma_deal_id?: string | null
          municipio_contrato?: string | null
          offtake_contrato?: string | null
          orcamento_estruturacao?: string | null
          origem?: Database["public"]["Enums"]["assessment_origem"]
          projeto_estagio?: string | null
          receita_anual_projecao?: string | null
          score_qualificacao?: number | null
          spe_status?: string | null
          status?: Database["public"]["Enums"]["assessment_status"]
          tokenizacao_motivo?: string | null
          updated_at?: string
          valor_captacao_brl?: number | null
          valor_captacao_necessario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_assessments_deal_intake_id_fkey"
            columns: ["deal_intake_id"]
            isOneToOne: false
            referencedRelation: "deal_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_intakes: {
        Row: {
          contato_email: string | null
          contato_nome: string
          contato_telefone: string | null
          created_at: string
          deal_card_html: string | null
          deal_card_path: string | null
          empresa_nome: string
          id: string
          observacoes: string | null
          origem_lead: Database["public"]["Enums"]["origem_lead_v3"]
          setor: Database["public"]["Enums"]["setor_v3"]
          status: Database["public"]["Enums"]["status_intake"]
          sugestao_tese: string | null
          tipo_operacao: Database["public"]["Enums"]["tipo_operacao_v3"]
          updated_at: string
          valor_estimado: number
        }
        Insert: {
          contato_email?: string | null
          contato_nome: string
          contato_telefone?: string | null
          created_at?: string
          deal_card_html?: string | null
          deal_card_path?: string | null
          empresa_nome: string
          id?: string
          observacoes?: string | null
          origem_lead: Database["public"]["Enums"]["origem_lead_v3"]
          setor: Database["public"]["Enums"]["setor_v3"]
          status?: Database["public"]["Enums"]["status_intake"]
          sugestao_tese?: string | null
          tipo_operacao: Database["public"]["Enums"]["tipo_operacao_v3"]
          updated_at?: string
          valor_estimado: number
        }
        Update: {
          contato_email?: string | null
          contato_nome?: string
          contato_telefone?: string | null
          created_at?: string
          deal_card_html?: string | null
          deal_card_path?: string | null
          empresa_nome?: string
          id?: string
          observacoes?: string | null
          origem_lead?: Database["public"]["Enums"]["origem_lead_v3"]
          setor?: Database["public"]["Enums"]["setor_v3"]
          status?: Database["public"]["Enums"]["status_intake"]
          sugestao_tese?: string | null
          tipo_operacao?: Database["public"]["Enums"]["tipo_operacao_v3"]
          updated_at?: string
          valor_estimado?: number
        }
        Relationships: []
      }
      deal_opportunities: {
        Row: {
          contexto: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          descricao: string | null
          empresa_blind: string | null
          id: string
          score_relevancia: number | null
          setor: string | null
          source_id: string | null
          source_type: string
          status: string
          tipo_operacao: string | null
          uf: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          descricao?: string | null
          empresa_blind?: string | null
          id?: string
          score_relevancia?: number | null
          setor?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          tipo_operacao?: string | null
          uf?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          descricao?: string | null
          empresa_blind?: string | null
          id?: string
          score_relevancia?: number | null
          setor?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          tipo_operacao?: string | null
          uf?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_opportunities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_qa_doc_updates: {
        Row: {
          created_at: string
          document_type: string
          id: string
          new_path: string | null
          prev_path: string | null
          section_updated: string | null
          thread_id: string
          trigger_reason: string | null
          updated_by: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          new_path?: string | null
          prev_path?: string | null
          section_updated?: string | null
          thread_id: string
          trigger_reason?: string | null
          updated_by?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          new_path?: string | null
          prev_path?: string | null
          section_updated?: string | null
          thread_id?: string
          trigger_reason?: string | null
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_qa_doc_updates_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "deal_qa_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_qa_messages: {
        Row: {
          ai_confidence: number | null
          attachments: Json | null
          content: string
          created_at: string
          id: string
          is_ai_draft: boolean
          is_published: boolean
          sender_invite_id: string | null
          sender_profile_id: string | null
          sender_type: string
          thread_id: string
        }
        Insert: {
          ai_confidence?: number | null
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          is_ai_draft?: boolean
          is_published?: boolean
          sender_invite_id?: string | null
          sender_profile_id?: string | null
          sender_type: string
          thread_id: string
        }
        Update: {
          ai_confidence?: number | null
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_ai_draft?: boolean
          is_published?: boolean
          sender_invite_id?: string | null
          sender_profile_id?: string | null
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_qa_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_qa_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_qa_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "deal_qa_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_qa_threads: {
        Row: {
          ai_summary: string | null
          category: string
          created_at: string
          data_extracted: Json | null
          deal_id: string | null
          deal_room_id: string | null
          id: string
          initiated_by: string
          initiator_ref: string | null
          listing_id: string | null
          priority: string
          status: string
          subject: string
          thesis_impact: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          category?: string
          created_at?: string
          data_extracted?: Json | null
          deal_id?: string | null
          deal_room_id?: string | null
          id?: string
          initiated_by?: string
          initiator_ref?: string | null
          listing_id?: string | null
          priority?: string
          status?: string
          subject: string
          thesis_impact?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          category?: string
          created_at?: string
          data_extracted?: Json | null
          deal_id?: string | null
          deal_room_id?: string | null
          id?: string
          initiated_by?: string
          initiator_ref?: string | null
          listing_id?: string | null
          priority?: string
          status?: string
          subject?: string
          thesis_impact?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_qa_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_qa_threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_qa_threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_documents: {
        Row: {
          created_at: string
          deal_room_id: string
          doc_type: string
          file_size_bytes: number | null
          id: string
          label: string
          requires_nda: boolean
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          deal_room_id: string
          doc_type: string
          file_size_bytes?: number | null
          id?: string
          label: string
          requires_nda?: boolean
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          deal_room_id?: string
          doc_type?: string
          file_size_bytes?: number | null
          id?: string
          label?: string
          requires_nda?: boolean
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_documents_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_invites: {
        Row: {
          access_count: number
          access_side: string
          created_at: string
          deal_room_id: string
          first_accessed_at: string | null
          id: string
          investor_company: string | null
          investor_email: string
          investor_name: string
          sent_at: string | null
          source_group: string | null
          status: string
          token: string
          token_expires_at: string
          updated_at: string
          utm_params: Json | null
        }
        Insert: {
          access_count?: number
          access_side?: string
          created_at?: string
          deal_room_id: string
          first_accessed_at?: string | null
          id?: string
          investor_company?: string | null
          investor_email: string
          investor_name: string
          sent_at?: string | null
          source_group?: string | null
          status?: string
          token: string
          token_expires_at?: string
          updated_at?: string
          utm_params?: Json | null
        }
        Update: {
          access_count?: number
          access_side?: string
          created_at?: string
          deal_room_id?: string
          first_accessed_at?: string | null
          id?: string
          investor_company?: string | null
          investor_email?: string
          investor_name?: string
          sent_at?: string | null
          source_group?: string | null
          status?: string
          token?: string
          token_expires_at?: string
          updated_at?: string
          utm_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_invites_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_rooms: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string
          expires_at: string | null
          id: string
          name: string
          nda_required: boolean
          nda_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id: string
          expires_at?: string | null
          id?: string
          name: string
          nda_required?: boolean
          nda_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string
          expires_at?: string | null
          id?: string
          name?: string
          nda_required?: boolean
          nda_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_rooms_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_sector_codes: {
        Row: {
          active: boolean
          code: string
          description: string | null
          label: string
        }
        Insert: {
          active?: boolean
          code: string
          description?: string | null
          label: string
        }
        Update: {
          active?: boolean
          code?: string
          description?: string | null
          label?: string
        }
        Relationships: []
      }
      deal_upload_audit: {
        Row: {
          deal_id: string
          file_hash: string | null
          file_name: string
          file_size: number | null
          id: string
          ip_address: string | null
          mime_type: string | null
          storage_path: string
          token_id: string
          uploaded_at: string
        }
        Insert: {
          deal_id: string
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          ip_address?: string | null
          mime_type?: string | null
          storage_path: string
          token_id: string
          uploaded_at?: string
        }
        Update: {
          deal_id?: string
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          ip_address?: string | null
          mime_type?: string | null
          storage_path?: string
          token_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_upload_audit_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "deal_upload_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_upload_tokens: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string
          expires_at: string
          id: string
          label: string | null
          max_uses: number
          partner_id: string | null
          status: string
          token: string
          updated_at: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id: string
          expires_at?: string
          id?: string
          label?: string | null
          max_uses?: number
          partner_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string
          expires_at?: string
          id?: string
          label?: string | null
          max_uses?: number
          partner_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_upload_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_upload_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_upload_tokens_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_upload_tokens_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_upload_tokens_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deal_workspaces: {
        Row: {
          context: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          deal_intake_id: string | null
          id: string
          name: string
          status: string
          synthesis: Json | null
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          created_by: string
          deal_id?: string | null
          deal_intake_id?: string | null
          id?: string
          name: string
          status?: string
          synthesis?: Json | null
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          deal_intake_id?: string | null
          id?: string
          name?: string
          status?: string
          synthesis?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_workspaces_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_workspaces_deal_intake_id_fkey"
            columns: ["deal_intake_id"]
            isOneToOne: false
            referencedRelation: "deal_intakes"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_matches: {
        Row: {
          buyer_viewed_at: string | null
          created_at: string
          deal_id: string | null
          demand_id: string
          id: string
          listing_id: string | null
          match_reasons: Json
          match_type: string | null
          notification_sent: boolean | null
          score: number
          status: string
          tranche_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_viewed_at?: string | null
          created_at?: string
          deal_id?: string | null
          demand_id: string
          id?: string
          listing_id?: string | null
          match_reasons?: Json
          match_type?: string | null
          notification_sent?: boolean | null
          score?: number
          status?: string
          tranche_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_viewed_at?: string | null
          created_at?: string
          deal_id?: string | null
          demand_id?: string
          id?: string
          listing_id?: string | null
          match_reasons?: Json
          match_type?: string | null
          notification_sent?: boolean | null
          score?: number
          status?: string
          tranche_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_matches_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_matches_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "investor_demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_matches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_matches_tranche_id_fkey"
            columns: ["tranche_id"]
            isOneToOne: false
            referencedRelation: "cm_tranches"
            referencedColumns: ["id"]
          },
        ]
      }
      disc_assessments: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          name: string
          primary_profile: string
          role: string | null
          scores: Json
          secondary_profile: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          name: string
          primary_profile: string
          role?: string | null
          scores: Json
          secondary_profile?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          name?: string
          primary_profile?: string
          role?: string | null
          scores?: Json
          secondary_profile?: string | null
        }
        Relationships: []
      }
      docs_ingeridos: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          arquivo_tipo: string
          conteudo_extraido: string | null
          created_at: string
          dados_extraidos: Json | null
          erro_msg: string | null
          hash_arquivo: string
          id: string
          origem: string
          resumo: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          arquivo_tipo: string
          conteudo_extraido?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          erro_msg?: string | null
          hash_arquivo: string
          id?: string
          origem?: string
          resumo?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          arquivo_tipo?: string
          conteudo_extraido?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          erro_msg?: string | null
          hash_arquivo?: string
          id?: string
          origem?: string
          resumo?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string
          folder_id: string
          id: string
          is_pii_masked: boolean
          metadata: Json | null
          pii_mask_method: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding: string
          folder_id: string
          id?: string
          is_pii_masked?: boolean
          metadata?: Json | null
          pii_mask_method?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string
          folder_id?: string
          id?: string
          is_pii_masked?: boolean
          metadata?: Json | null
          pii_mask_method?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      document_quarantine: {
        Row: {
          attempted_path: string
          detected_at: string
          file_name: string
          file_size: number | null
          governance_log_id: string | null
          id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempted_path: string
          detected_at?: string
          file_name: string
          file_size?: number | null
          governance_log_id?: string | null
          id?: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempted_path?: string
          detected_at?: string
          file_name?: string
          file_size?: number | null
          governance_log_id?: string | null
          id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_quarantine_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_quarantine_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "document_quarantine_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_quarantine_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      document_views: {
        Row: {
          device_type: string | null
          document_id: string | null
          duration_seconds: number | null
          id: string
          invite_id: string
          ip_address: string | null
          status: string | null
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          document_id?: string | null
          duration_seconds?: number | null
          id?: string
          invite_id: string
          ip_address?: string | null
          status?: string | null
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          document_id?: string | null
          duration_seconds?: number | null
          id?: string
          invite_id?: string
          ip_address?: string | null
          status?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_views_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "deal_room_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_views_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "deal_room_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_errors: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string | null
          error_type: string | null
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          source: string
          updated_at: string
          workflow_name: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          updated_at?: string
          workflow_name?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          updated_at?: string
          workflow_name?: string | null
        }
        Relationships: []
      }
      financeiro_records: {
        Row: {
          created_at: string
          created_by: string
          data: Json
          id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data: Json
          id?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: Json
          id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      folder_access_grants: {
        Row: {
          expires_at: string | null
          folder_id: string
          granted_at: string
          granted_by: string | null
          id: string
          permission: string
          reason: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          folder_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          reason?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          folder_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_access_grants_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "folder_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      folder_governance_log: {
        Row: {
          created_at: string
          deal_code: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          target_path: string | null
          user_id: string | null
          user_name: string | null
          vertical: string | null
        }
        Insert: {
          created_at?: string
          deal_code?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          target_path?: string | null
          user_id?: string | null
          user_name?: string | null
          vertical?: string | null
        }
        Update: {
          created_at?: string
          deal_code?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          target_path?: string | null
          user_id?: string | null
          user_name?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_governance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_governance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      folder_registry: {
        Row: {
          client_name: string | null
          created_at: string
          created_by: string | null
          deal_code: string | null
          depth: number
          full_path: string
          id: string
          metadata: Json | null
          parent_path: string | null
          status: string
          updated_at: string
          vertical: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          deal_code?: string | null
          depth?: number
          full_path: string
          id?: string
          metadata?: Json | null
          parent_path?: string | null
          status?: string
          updated_at?: string
          vertical: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          deal_code?: string | null
          depth?: number
          full_path?: string
          id?: string
          metadata?: Json | null
          parent_path?: string | null
          status?: string
          updated_at?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_registry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_registry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          created_at: string
          html: string
          id: string
          opportunities_found: number | null
          opportunities_scanned_at: string | null
          output_type: string
          session_id: string | null
          squad_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          html: string
          id?: string
          opportunities_found?: number | null
          opportunities_scanned_at?: string | null
          output_type?: string
          session_id?: string | null
          squad_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          html?: string
          id?: string
          opportunities_found?: number | null
          opportunities_scanned_at?: string | null
          output_type?: string
          session_id?: string | null
          squad_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      instituicoes: {
        Row: {
          auth_user_id: string | null
          cnpj: string | null
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          cnpj?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      investor_demands: {
        Row: {
          alerta_ativo: boolean | null
          asset_types_preferidos: string[] | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          criterios: string | null
          desagio_min: number | null
          email: string
          empresa: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          identidade_orgao: string | null
          intake_data: Json | null
          intake_locked: boolean | null
          intake_token: string | null
          investor_profile_id: string | null
          jurisdicao_alvo: string[] | null
          nacionalidade: string | null
          natureza_preferida: string[] | null
          nda_accepted: boolean | null
          nda_accepted_at: string | null
          nome_contato: string
          notas: string | null
          origem: string
          profissao: string | null
          setores: string[]
          status: string
          telefone: string | null
          ticket_max: number
          ticket_min: number
          tipos_operacao: string[]
          ufs: string[]
          updated_at: string
        }
        Insert: {
          alerta_ativo?: boolean | null
          asset_types_preferidos?: string[] | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          criterios?: string | null
          desagio_min?: number | null
          email: string
          empresa?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          identidade_orgao?: string | null
          intake_data?: Json | null
          intake_locked?: boolean | null
          intake_token?: string | null
          investor_profile_id?: string | null
          jurisdicao_alvo?: string[] | null
          nacionalidade?: string | null
          natureza_preferida?: string[] | null
          nda_accepted?: boolean | null
          nda_accepted_at?: string | null
          nome_contato: string
          notas?: string | null
          origem?: string
          profissao?: string | null
          setores?: string[]
          status?: string
          telefone?: string | null
          ticket_max?: number
          ticket_min?: number
          tipos_operacao?: string[]
          ufs?: string[]
          updated_at?: string
        }
        Update: {
          alerta_ativo?: boolean | null
          asset_types_preferidos?: string[] | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          criterios?: string | null
          desagio_min?: number | null
          email?: string
          empresa?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          identidade_orgao?: string | null
          intake_data?: Json | null
          intake_locked?: boolean | null
          intake_token?: string | null
          investor_profile_id?: string | null
          jurisdicao_alvo?: string[] | null
          nacionalidade?: string | null
          natureza_preferida?: string[] | null
          nda_accepted?: boolean | null
          nda_accepted_at?: string | null
          nome_contato?: string
          notas?: string | null
          origem?: string
          profissao?: string | null
          setores?: string[]
          status?: string
          telefone?: string | null
          ticket_max?: number
          ticket_min?: number
          tipos_operacao?: string[]
          ufs?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_demands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_demands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "investor_demands_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          criterios: string | null
          crm_lead_id: string | null
          email: string | null
          id: string
          nome: string
          notas: string | null
          origem: string | null
          setores: string[]
          status: string
          telefone: string | null
          ticket_max: number | null
          ticket_min: number | null
          tipo: string
          tipos_operacao: string[]
          ufs: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criterios?: string | null
          crm_lead_id?: string | null
          email?: string | null
          id?: string
          nome: string
          notas?: string | null
          origem?: string | null
          setores?: string[]
          status?: string
          telefone?: string | null
          ticket_max?: number | null
          ticket_min?: number | null
          tipo?: string
          tipos_operacao?: string[]
          ufs?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criterios?: string | null
          crm_lead_id?: string | null
          email?: string | null
          id?: string
          nome?: string
          notas?: string | null
          origem?: string | null
          setores?: string[]
          status?: string
          telefone?: string | null
          ticket_max?: number | null
          ticket_min?: number | null
          tipo?: string
          tipos_operacao?: string[]
          ufs?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "investor_profiles_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_access_log: {
        Row: {
          action: string
          created_at: string
          entity_doc: string | null
          entity_name: string | null
          id: string
          score: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_doc?: string | null
          entity_name?: string | null
          id?: string
          score?: number | null
          status: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_doc?: string | null
          entity_name?: string | null
          id?: string
          score?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kyc_analyses: {
        Row: {
          analyst_id: string
          created_at: string
          dd_level: string | null
          entity_doc: string
          entity_name: string | null
          entity_type: string | null
          id: string
          operation_type: string | null
          raw_data: Json | null
          risk_label: string | null
          score: number | null
          sources_used: string[] | null
          verdict: string | null
        }
        Insert: {
          analyst_id: string
          created_at?: string
          dd_level?: string | null
          entity_doc: string
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          operation_type?: string | null
          raw_data?: Json | null
          risk_label?: string | null
          score?: number | null
          sources_used?: string[] | null
          verdict?: string | null
        }
        Update: {
          analyst_id?: string
          created_at?: string
          dd_level?: string | null
          entity_doc?: string
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          operation_type?: string | null
          raw_data?: Json | null
          risk_label?: string | null
          score?: number | null
          sources_used?: string[] | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_analyses_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_analyses_analyst_id_fkey"
            columns: ["analyst_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kyc_api_keys: {
        Row: {
          active: boolean
          id: string
          key_name: string
          key_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          id?: string
          key_name: string
          key_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          id?: string
          key_name?: string
          key_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_api_keys_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_api_keys_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kyc_blacklist: {
        Row: {
          active: boolean
          added_by: string | null
          created_at: string
          doc: string | null
          id: string
          name: string
          nationality: string | null
          notes: string | null
          source: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          added_by?: string | null
          created_at?: string
          doc?: string | null
          id?: string
          name: string
          nationality?: string | null
          notes?: string | null
          source?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          added_by?: string | null
          created_at?: string
          doc?: string | null
          id?: string
          name?: string
          nationality?: string | null
          notes?: string | null
          source?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_blacklist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_blacklist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      logistics_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          currency: string
          current_price: number | null
          deleted_at: string | null
          destination: string | null
          destination_iata: string | null
          end_date: string | null
          id: string
          notes: string | null
          origin: string | null
          origin_iata: string | null
          provider: string | null
          start_date: string | null
          status: string
          target_price: number | null
          title: string
          trip_type: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_price?: number | null
          deleted_at?: string | null
          destination?: string | null
          destination_iata?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          origin_iata?: string | null
          provider?: string | null
          start_date?: string | null
          status?: string
          target_price?: number | null
          title: string
          trip_type?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_price?: number | null
          deleted_at?: string | null
          destination?: string | null
          destination_iata?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          origin?: string | null
          origin_iata?: string | null
          provider?: string | null
          start_date?: string | null
          status?: string
          target_price?: number | null
          title?: string
          trip_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      logistics_price_history: {
        Row: {
          checked_at: string
          currency: string
          id: string
          item_id: string | null
          price: number
          source: string | null
        }
        Insert: {
          checked_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          price: number
          source?: string | null
        }
        Update: {
          checked_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          price?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "logistics_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ma_batch_reconciliations: {
        Row: {
          avg_confiabilidade: number | null
          batch_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          divergences_found: number
          docs_error: number
          docs_needs_review: number
          docs_processed: number
          docs_success: number
          fields_high_confidence: number
          fields_low_confidence: number
          id: string
          report_html: string | null
          report_url: string | null
          started_at: string | null
          status: string
          total_docs: number
          total_fields_extracted: number
          updated_at: string
        }
        Insert: {
          avg_confiabilidade?: number | null
          batch_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          divergences_found?: number
          docs_error?: number
          docs_needs_review?: number
          docs_processed?: number
          docs_success?: number
          fields_high_confidence?: number
          fields_low_confidence?: number
          id?: string
          report_html?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          total_docs?: number
          total_fields_extracted?: number
          updated_at?: string
        }
        Update: {
          avg_confiabilidade?: number | null
          batch_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          divergences_found?: number
          docs_error?: number
          docs_needs_review?: number
          docs_processed?: number
          docs_success?: number
          fields_high_confidence?: number
          fields_low_confidence?: number
          id?: string
          report_html?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          total_docs?: number
          total_fields_extracted?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ma_batch_reconciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_batch_reconciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ma_batch_reconciliations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ma_captacao_links: {
        Row: {
          active: boolean
          created_at: string
          id: string
          partner_id: string | null
          partner_name: string
          token: string
          uses_count: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          partner_id?: string | null
          partner_name?: string
          token: string
          uses_count?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          partner_id?: string | null
          partner_name?: string
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ma_captacao_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_captacao_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ma_deal_history: {
        Row: {
          changed_by: string | null
          created_at: string
          deal_id: string | null
          from_stage: Database["public"]["Enums"]["deal_stage"] | null
          id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["deal_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          deal_id?: string | null
          from_stage?: Database["public"]["Enums"]["deal_stage"] | null
          id?: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["deal_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          deal_id?: string | null
          from_stage?: Database["public"]["Enums"]["deal_stage"] | null
          id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["deal_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "ma_deal_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_deal_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ma_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      ma_deals: {
        Row: {
          asset_data: Json
          assigned_to: string | null
          buyer_name: string | null
          code: string
          comments: Json | null
          contract_signed_at: string | null
          contract_status: string
          cover_photo_url: string | null
          created_at: string
          created_by: string
          deal_value: number | null
          description: string | null
          documents: Json | null
          ebitda_multiple: number | null
          ebitda_ttm: number | null
          expected_close_date: string | null
          id: string
          legacy_code: string | null
          location: string | null
          notes: string | null
          origin_vertical: string | null
          originator_profile_id: string | null
          probability_percent: number | null
          revenue_ttm: number | null
          sector: string | null
          seller_name: string | null
          slug: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          status: Database["public"]["Enums"]["operation_status"]
          tags: string[] | null
          target_company: string
          title: string
          updated_at: string
          v3_code: string | null
        }
        Insert: {
          asset_data?: Json
          assigned_to?: string | null
          buyer_name?: string | null
          code: string
          comments?: Json | null
          contract_signed_at?: string | null
          contract_status?: string
          cover_photo_url?: string | null
          created_at?: string
          created_by: string
          deal_value?: number | null
          description?: string | null
          documents?: Json | null
          ebitda_multiple?: number | null
          ebitda_ttm?: number | null
          expected_close_date?: string | null
          id?: string
          legacy_code?: string | null
          location?: string | null
          notes?: string | null
          origin_vertical?: string | null
          originator_profile_id?: string | null
          probability_percent?: number | null
          revenue_ttm?: number | null
          sector?: string | null
          seller_name?: string | null
          slug?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          status?: Database["public"]["Enums"]["operation_status"]
          tags?: string[] | null
          target_company: string
          title: string
          updated_at?: string
          v3_code?: string | null
        }
        Update: {
          asset_data?: Json
          assigned_to?: string | null
          buyer_name?: string | null
          code?: string
          comments?: Json | null
          contract_signed_at?: string | null
          contract_status?: string
          cover_photo_url?: string | null
          created_at?: string
          created_by?: string
          deal_value?: number | null
          description?: string | null
          documents?: Json | null
          ebitda_multiple?: number | null
          ebitda_ttm?: number | null
          expected_close_date?: string | null
          id?: string
          legacy_code?: string | null
          location?: string | null
          notes?: string | null
          origin_vertical?: string | null
          originator_profile_id?: string | null
          probability_percent?: number | null
          revenue_ttm?: number | null
          sector?: string | null
          seller_name?: string | null
          slug?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          status?: Database["public"]["Enums"]["operation_status"]
          tags?: string[] | null
          target_company?: string
          title?: string
          updated_at?: string
          v3_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ma_deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ma_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_deals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ma_deals_originator_profile_id_fkey"
            columns: ["originator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_deals_originator_profile_id_fkey"
            columns: ["originator_profile_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ma_document_extractions: {
        Row: {
          anthropic_file_id: string | null
          batch_id: string | null
          campos_baixa_confianca: Json | null
          confiabilidade: number | null
          confiabilidade_por_campo: Json | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          dados_extraidos: Json | null
          deal_id: string
          doc_id: string
          doc_name: string
          error_message: string | null
          extracted_at: string
          extracted_by: string | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          model_used: string
          partner_id: string | null
          pendencias: Json | null
          processing_mode: string | null
          resumo: string | null
          source_id: string | null
          source_type: string | null
          status: string
          storage_path: string
          tipo_documento: string | null
          updated_at: string
          validade: string | null
          validation_flags: Json | null
        }
        Insert: {
          anthropic_file_id?: string | null
          batch_id?: string | null
          campos_baixa_confianca?: Json | null
          confiabilidade?: number | null
          confiabilidade_por_campo?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          deal_id: string
          doc_id: string
          doc_name: string
          error_message?: string | null
          extracted_at?: string
          extracted_by?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          model_used?: string
          partner_id?: string | null
          pendencias?: Json | null
          processing_mode?: string | null
          resumo?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          storage_path: string
          tipo_documento?: string | null
          updated_at?: string
          validade?: string | null
          validation_flags?: Json | null
        }
        Update: {
          anthropic_file_id?: string | null
          batch_id?: string | null
          campos_baixa_confianca?: Json | null
          confiabilidade?: number | null
          confiabilidade_por_campo?: Json | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          deal_id?: string
          doc_id?: string
          doc_name?: string
          error_message?: string | null
          extracted_at?: string
          extracted_by?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          model_used?: string
          partner_id?: string | null
          pendencias?: Json | null
          processing_mode?: string | null
          resumo?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          storage_path?: string
          tipo_documento?: string | null
          updated_at?: string
          validade?: string | null
          validation_flags?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_extraction_batch"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ma_batch_reconciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_extractions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_extractions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ma_document_extractions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_extractions_extracted_by_fkey"
            columns: ["extracted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_extractions_extracted_by_fkey"
            columns: ["extracted_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ma_document_extractions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_extractions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ma_document_requests: {
        Row: {
          created_at: string
          deadline: string | null
          deal_id: string
          documents: Json
          email_sent: boolean
          email_sent_at: string | null
          forja_snapshot_at: string | null
          id: string
          notes: string | null
          partner_email: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          deal_id: string
          documents?: Json
          email_sent?: boolean
          email_sent_at?: string | null
          forja_snapshot_at?: string | null
          id?: string
          notes?: string | null
          partner_email?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          deal_id?: string
          documents?: Json
          email_sent?: boolean
          email_sent_at?: string | null
          forja_snapshot_at?: string | null
          id?: string
          notes?: string | null
          partner_email?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ma_document_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      market_benchmarks: {
        Row: {
          benchmark_key: string
          benchmark_label: string
          created_at: string | null
          created_by: string | null
          id: string
          sector: string
          source: string | null
          source_doc_id: string | null
          sub_sector: string | null
          unit: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          benchmark_key: string
          benchmark_label: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          sector: string
          source?: string | null
          source_doc_id?: string | null
          sub_sector?: string | null
          unit?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          benchmark_key?: string
          benchmark_label?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          sector?: string
          source?: string | null
          source_doc_id?: string | null
          sub_sector?: string | null
          unit?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_benchmarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_benchmarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "market_benchmarks_source_doc_id_fkey"
            columns: ["source_doc_id"]
            isOneToOne: false
            referencedRelation: "docs_ingeridos"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_favorites: {
        Row: {
          created_at: string | null
          id: string
          partner_id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_id: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_leads: {
        Row: {
          client_contact: string | null
          client_name: string | null
          created_at: string | null
          id: string
          message: string | null
          notes: string | null
          partner_id: string
          product_id: string
          status: string
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          partner_id: string
          product_id: string
          status?: string
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          partner_id?: string
          product_id?: string
          status?: string
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_leads_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "marketplace_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          partner_id: string
          product_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          partner_id: string
          product_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          partner_id?: string
          product_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          available_nationwide: boolean | null
          category: string
          commission_percent: number
          created_at: string | null
          delivery_days: number | null
          description: string
          id: string
          images: string[] | null
          min_order: number | null
          name: string
          partner_commission_percent: number | null
          price: number | null
          price_type: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specs: Json | null
          states: string[] | null
          status: string
          supplier_id: string
          updated_at: string | null
          views: number | null
        }
        Insert: {
          available_nationwide?: boolean | null
          category: string
          commission_percent?: number
          created_at?: string | null
          delivery_days?: number | null
          description: string
          id?: string
          images?: string[] | null
          min_order?: number | null
          name: string
          partner_commission_percent?: number | null
          price?: number | null
          price_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specs?: Json | null
          states?: string[] | null
          status?: string
          supplier_id: string
          updated_at?: string | null
          views?: number | null
        }
        Update: {
          available_nationwide?: boolean | null
          category?: string
          commission_percent?: number
          created_at?: string | null
          delivery_days?: number | null
          description?: string
          id?: string
          images?: string[] | null
          min_order?: number | null
          name?: string
          partner_commission_percent?: number | null
          price?: number | null
          price_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specs?: Json | null
          states?: string[] | null
          status?: string
          supplier_id?: string
          updated_at?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "marketplace_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_suppliers: {
        Row: {
          auth_user_id: string | null
          categories: string[]
          city: string
          cnpj: string
          company_name: string
          contact_name: string
          created_at: string | null
          description: string
          email: string
          id: string
          logo_url: string | null
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          state: string
          status: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          auth_user_id?: string | null
          categories?: string[]
          city: string
          cnpj: string
          company_name: string
          contact_name: string
          created_at?: string | null
          description: string
          email: string
          id?: string
          logo_url?: string | null
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          state: string
          status?: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          auth_user_id?: string | null
          categories?: string[]
          city?: string
          cnpj?: string
          company_name?: string
          contact_name?: string
          created_at?: string | null
          description?: string
          email?: string
          id?: string
          logo_url?: string | null
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          state?: string
          status?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      meeting_action_items: {
        Row: {
          action: string
          assignee: string
          assignee_user_id: string | null
          created_at: string
          due_date: string | null
          id: string
          meeting_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          assignee: string
          assignee_user_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          assignee?: string
          assignee_user_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "business_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summaries: {
        Row: {
          action_items: string[] | null
          business_meeting_id: string | null
          created_at: string | null
          duration_minutes: number | null
          fathom_url: string | null
          id: string
          ma_deal_id: string | null
          meeting_date: string | null
          participants: string[] | null
          processed_by: string | null
          source: string | null
          summary: string
          title: string
          transcript: string
          user_id: string
        }
        Insert: {
          action_items?: string[] | null
          business_meeting_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          fathom_url?: string | null
          id?: string
          ma_deal_id?: string | null
          meeting_date?: string | null
          participants?: string[] | null
          processed_by?: string | null
          source?: string | null
          summary: string
          title: string
          transcript: string
          user_id: string
        }
        Update: {
          action_items?: string[] | null
          business_meeting_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          fathom_url?: string | null
          id?: string
          ma_deal_id?: string | null
          meeting_date?: string | null
          participants?: string[] | null
          processed_by?: string | null
          source?: string | null
          summary?: string
          title?: string
          transcript?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_summaries_business_meeting_id_fkey"
            columns: ["business_meeting_id"]
            isOneToOne: false
            referencedRelation: "business_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_summaries_ma_deal_id_fkey"
            columns: ["ma_deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mesa_sla_config: {
        Row: {
          config: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mesa_sla_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesa_sla_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nda_signatures: {
        Row: {
          agreed_text: string | null
          clicksign_doc_id: string | null
          id: string
          invite_id: string
          ip_address: string | null
          signed_at: string
          user_agent: string | null
        }
        Insert: {
          agreed_text?: string | null
          clicksign_doc_id?: string | null
          id?: string
          invite_id: string
          ip_address?: string | null
          signed_at?: string
          user_agent?: string | null
        }
        Update: {
          agreed_text?: string | null
          clicksign_doc_id?: string | null
          id?: string
          invite_id?: string
          ip_address?: string | null
          signed_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nda_signatures_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "deal_room_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          comment: string | null
          commission_id: string | null
          created_at: string | null
          id: string
          partner_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          commission_id?: string | null
          created_at?: string | null
          id?: string
          partner_id: string
          score: number
        }
        Update: {
          comment?: string | null
          commission_id?: string | null
          created_at?: string | null
          id?: string
          partner_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      operation_contracts: {
        Row: {
          approval_count: number | null
          approved_by: string[] | null
          bid_id: string | null
          commission_percent: number | null
          contract_title: string
          created_at: string | null
          created_by: string | null
          credit_proposal_id: string | null
          deal_id: string | null
          external_envelope_id: string | null
          id: string
          listing_id: string | null
          parties: Json | null
          rendered_html: string | null
          requires_review: boolean | null
          signed_at: string | null
          status_signature:
            | Database["public"]["Enums"]["contract_signature_status"]
            | null
          storage_url: string | null
          template_id: string
          updated_at: string | null
          vertical: Database["public"]["Enums"]["contract_vertical"]
        }
        Insert: {
          approval_count?: number | null
          approved_by?: string[] | null
          bid_id?: string | null
          commission_percent?: number | null
          contract_title: string
          created_at?: string | null
          created_by?: string | null
          credit_proposal_id?: string | null
          deal_id?: string | null
          external_envelope_id?: string | null
          id?: string
          listing_id?: string | null
          parties?: Json | null
          rendered_html?: string | null
          requires_review?: boolean | null
          signed_at?: string | null
          status_signature?:
            | Database["public"]["Enums"]["contract_signature_status"]
            | null
          storage_url?: string | null
          template_id: string
          updated_at?: string | null
          vertical: Database["public"]["Enums"]["contract_vertical"]
        }
        Update: {
          approval_count?: number | null
          approved_by?: string[] | null
          bid_id?: string | null
          commission_percent?: number | null
          contract_title?: string
          created_at?: string | null
          created_by?: string | null
          credit_proposal_id?: string | null
          deal_id?: string | null
          external_envelope_id?: string | null
          id?: string
          listing_id?: string | null
          parties?: Json | null
          rendered_html?: string | null
          requires_review?: boolean | null
          signed_at?: string | null
          status_signature?:
            | Database["public"]["Enums"]["contract_signature_status"]
            | null
          storage_url?: string | null
          template_id?: string
          updated_at?: string | null
          vertical?: Database["public"]["Enums"]["contract_vertical"]
        }
        Relationships: [
          {
            foreignKeyName: "operation_contracts_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "cm_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_contracts_credit_proposal_id_fkey"
            columns: ["credit_proposal_id"]
            isOneToOne: false
            referencedRelation: "credit_desk_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "ma_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_contracts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_asset_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_contracts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "cm_vitrine_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_tickets: {
        Row: {
          assigned_to: string | null
          attachments: Json | null
          category: string
          code: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          pending_at: string | null
          pending_reason: string | null
          pending_resolved_at: string | null
          pending_resolved_by: string | null
          pending_responsible: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reminder_sent_at: string | null
          requester_id: string
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["operation_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: Json | null
          category: string
          code: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          pending_at?: string | null
          pending_reason?: string | null
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
          pending_responsible?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reminder_sent_at?: string | null
          requester_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: Json | null
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          pending_at?: string | null
          pending_reason?: string | null
          pending_resolved_at?: string | null
          pending_resolved_by?: string | null
          pending_responsible?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reminder_sent_at?: string | null
          requester_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "operational_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      partner_contracts: {
        Row: {
          accepted_at: string
          cnpj_cpf: string | null
          contract_html: string | null
          contract_version: string
          cpf_representante: string | null
          created_at: string
          device_info: string | null
          email: string
          endereco_completo: string | null
          id: string
          ip_address: string | null
          nome_representante: string | null
          plano: string
          razao_social: string | null
          registration_id: string | null
          telefone: string | null
          user_id: string
          valor_mensal: string | null
        }
        Insert: {
          accepted_at?: string
          cnpj_cpf?: string | null
          contract_html?: string | null
          contract_version?: string
          cpf_representante?: string | null
          created_at?: string
          device_info?: string | null
          email: string
          endereco_completo?: string | null
          id?: string
          ip_address?: string | null
          nome_representante?: string | null
          plano: string
          razao_social?: string | null
          registration_id?: string | null
          telefone?: string | null
          user_id: string
          valor_mensal?: string | null
        }
        Update: {
          accepted_at?: string
          cnpj_cpf?: string | null
          contract_html?: string | null
          contract_version?: string
          cpf_representante?: string | null
          created_at?: string
          device_info?: string | null
          email?: string
          endereco_completo?: string | null
          id?: string
          ip_address?: string | null
          nome_representante?: string | null
          plano?: string
          razao_social?: string | null
          registration_id?: string | null
          telefone?: string | null
          user_id?: string
          valor_mensal?: string | null
        }
        Relationships: []
      }
      partner_goals: {
        Row: {
          created_at: string
          created_by: string | null
          goal_approvals: number
          goal_deals: number
          goal_proposals: number
          goal_volume: number
          id: string
          month: number
          partner_id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          goal_approvals?: number
          goal_deals?: number
          goal_proposals?: number
          goal_volume?: number
          id?: string
          month: number
          partner_id: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          goal_approvals?: number
          goal_deals?: number
          goal_proposals?: number
          goal_volume?: number
          id?: string
          month?: number
          partner_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      partner_registrations: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cora_amount_cents: number | null
          cora_boleto_barcode: string | null
          cora_boleto_pdf: string | null
          cora_invoice_id: string | null
          cora_invoice_status: string | null
          cora_paid_at: string | null
          cora_payment_url: string | null
          cora_pix_emv: string | null
          cora_pix_qr_code: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          doc_cnpj: string[] | null
          doc_identidade: string[] | null
          doc_socio: string[] | null
          email: string
          estado: string | null
          id: string
          ip_origem: string | null
          logradouro: string | null
          nome_completo: string | null
          nome_fantasia: string | null
          numero: string | null
          observacao: string | null
          plano: string
          razao_social: string | null
          revisado_em: string | null
          revisado_por: string | null
          status: string
          telefone: string
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cora_amount_cents?: number | null
          cora_boleto_barcode?: string | null
          cora_boleto_pdf?: string | null
          cora_invoice_id?: string | null
          cora_invoice_status?: string | null
          cora_paid_at?: string | null
          cora_payment_url?: string | null
          cora_pix_emv?: string | null
          cora_pix_qr_code?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          doc_cnpj?: string[] | null
          doc_identidade?: string[] | null
          doc_socio?: string[] | null
          email: string
          estado?: string | null
          id?: string
          ip_origem?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacao?: string | null
          plano: string
          razao_social?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: string
          telefone: string
          tipo_pessoa: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cora_amount_cents?: number | null
          cora_boleto_barcode?: string | null
          cora_boleto_pdf?: string | null
          cora_invoice_id?: string | null
          cora_invoice_status?: string | null
          cora_paid_at?: string | null
          cora_payment_url?: string | null
          cora_pix_emv?: string | null
          cora_pix_qr_code?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          doc_cnpj?: string[] | null
          doc_identidade?: string[] | null
          doc_socio?: string[] | null
          email?: string
          estado?: string | null
          id?: string
          ip_origem?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacao?: string | null
          plano?: string
          razao_social?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: string
          telefone?: string
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_subscriptions: {
        Row: {
          amount_cents: number
          boleto_barcode: string | null
          boleto_pdf: string | null
          cora_invoice_id: string | null
          created_at: string | null
          due_date: string
          id: string
          paid_at: string | null
          partner_id: string | null
          pix_emv: string | null
          pix_qr_code: string | null
          plano: string
          status: string | null
        }
        Insert: {
          amount_cents: number
          boleto_barcode?: string | null
          boleto_pdf?: string | null
          cora_invoice_id?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          paid_at?: string | null
          partner_id?: string | null
          pix_emv?: string | null
          pix_qr_code?: string | null
          plano: string
          status?: string | null
        }
        Update: {
          amount_cents?: number
          boleto_barcode?: string | null
          boleto_pdf?: string | null
          cora_invoice_id?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          paid_at?: string | null
          partner_id?: string | null
          pix_emv?: string | null
          pix_qr_code?: string | null
          plano?: string
          status?: string | null
        }
        Relationships: []
      }
      people_hub_members: {
        Row: {
          assessment_id: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          primary_profile: string | null
          role: string | null
          secondary_profile: string | null
          updated_at: string | null
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          primary_profile?: string | null
          role?: string | null
          secondary_profile?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          primary_profile?: string | null
          role?: string | null
          secondary_profile?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_hub_members_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "disc_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      portfolio_linhas: {
        Row: {
          amortizacao: string | null
          aporte: string | null
          ativo: boolean | null
          categoria: string | null
          comprometimento_renda: string | null
          created_at: string | null
          custo_estruturacao: string | null
          descricao: string | null
          destinacao: string | null
          diferenciais: string | null
          documentos: Json
          documentos_pf: Json
          documentos_pj: Json
          id: string
          limite_credito: string | null
          nivel: string | null
          nome: string
          ordem: number | null
          outras_despesas: string | null
          perfil_garantia: string | null
          prazo_pagamento: string | null
          publico_alvo: string | null
          taxas: string | null
          tempo_estruturacao: string | null
          updated_at: string | null
        }
        Insert: {
          amortizacao?: string | null
          aporte?: string | null
          ativo?: boolean | null
          categoria?: string | null
          comprometimento_renda?: string | null
          created_at?: string | null
          custo_estruturacao?: string | null
          descricao?: string | null
          destinacao?: string | null
          diferenciais?: string | null
          documentos?: Json
          documentos_pf?: Json
          documentos_pj?: Json
          id?: string
          limite_credito?: string | null
          nivel?: string | null
          nome: string
          ordem?: number | null
          outras_despesas?: string | null
          perfil_garantia?: string | null
          prazo_pagamento?: string | null
          publico_alvo?: string | null
          taxas?: string | null
          tempo_estruturacao?: string | null
          updated_at?: string | null
        }
        Update: {
          amortizacao?: string | null
          aporte?: string | null
          ativo?: boolean | null
          categoria?: string | null
          comprometimento_renda?: string | null
          created_at?: string | null
          custo_estruturacao?: string | null
          descricao?: string | null
          destinacao?: string | null
          diferenciais?: string | null
          documentos?: Json
          documentos_pf?: Json
          documentos_pj?: Json
          id?: string
          limite_credito?: string | null
          nivel?: string | null
          nome?: string
          ordem?: number | null
          outras_despesas?: string | null
          perfil_garantia?: string | null
          prazo_pagamento?: string | null
          publico_alvo?: string | null
          taxas?: string | null
          tempo_estruturacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      precatorio_leads: {
        Row: {
          created_at: string
          credor: string
          ente_devedor: string
          estagio: string
          id: string
          natureza: string
          numero_processo: string
          observacoes: string | null
          partner_id: string
          prazo_estimado_meses: number
          tribunal: string
          updated_at: string
          valor_atualizado: number
          valor_face: number
        }
        Insert: {
          created_at?: string
          credor: string
          ente_devedor: string
          estagio?: string
          id?: string
          natureza?: string
          numero_processo?: string
          observacoes?: string | null
          partner_id: string
          prazo_estimado_meses?: number
          tribunal?: string
          updated_at?: string
          valor_atualizado?: number
          valor_face?: number
        }
        Update: {
          created_at?: string
          credor?: string
          ente_devedor?: string
          estagio?: string
          id?: string
          natureza?: string
          numero_processo?: string
          observacoes?: string | null
          partner_id?: string
          prazo_estimado_meses?: number
          tribunal?: string
          updated_at?: string
          valor_atualizado?: number
          valor_face?: number
        }
        Relationships: [
          {
            foreignKeyName: "precatorio_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precatorio_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      privacy_consents: {
        Row: {
          accepted_at: string
          consent_version: string
          id: string
          ip_address: string | null
          stakeholder_email: string | null
          stakeholder_ref: string | null
          stakeholder_type: string
          text_snapshot: string | null
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          consent_version?: string
          id?: string
          ip_address?: string | null
          stakeholder_email?: string | null
          stakeholder_ref?: string | null
          stakeholder_type: string
          text_snapshot?: string | null
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          consent_version?: string
          id?: string
          ip_address?: string | null
          stakeholder_email?: string | null
          stakeholder_ref?: string | null
          stakeholder_type?: string
          text_snapshot?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cobranding_bio: string | null
          cobranding_instagram: string | null
          cobranding_slug: string | null
          cobranding_whatsapp: string | null
          created_at: string
          created_by: string | null
          document_cpf: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          is_socio: boolean | null
          kyc_data: Json | null
          kyc_status: string | null
          last_login_at: string | null
          onboarding_dismissed: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          trial_expires_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cobranding_bio?: string | null
          cobranding_instagram?: string | null
          cobranding_slug?: string | null
          cobranding_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          document_cpf?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          is_socio?: boolean | null
          kyc_data?: Json | null
          kyc_status?: string | null
          last_login_at?: string | null
          onboarding_dismissed?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          trial_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cobranding_bio?: string | null
          cobranding_instagram?: string | null
          cobranding_slug?: string | null
          cobranding_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          document_cpf?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_socio?: boolean | null
          kyc_data?: Json | null
          kyc_status?: string | null
          last_login_at?: string | null
          onboarding_dismissed?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          trial_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      proposal_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          proposal_id: string
          sender_id: string
          sender_name: string
          sender_role: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          proposal_id: string
          sender_id: string
          sender_name: string
          sender_role: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          proposal_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_messages_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      prospeccao_followups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          notas: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          notas?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          notas?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_followups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_followups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prospeccao_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_historico: {
        Row: {
          created_at: string
          created_by: string | null
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          lead_id: string
          nota: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id: string
          nota?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id?: string
          nota?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_historico_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_historico_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prospeccao_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospeccao_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      prospeccao_leads: {
        Row: {
          cidade: string | null
          comissao_gerada: boolean
          convertido_em: string | null
          created_at: string
          created_by: string | null
          crm_lead_id: string | null
          documento: string | null
          email: string | null
          estado: string | null
          etapa: string
          id: string
          indicado_por_nome: string | null
          indicado_por_partner_id: string | null
          link_gerado_em: string | null
          link_token: string | null
          motivo_perda: string | null
          nome: string
          notas: string | null
          origem: string
          partner_id: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          comissao_gerada?: boolean
          convertido_em?: string | null
          created_at?: string
          created_by?: string | null
          crm_lead_id?: string | null
          documento?: string | null
          email?: string | null
          estado?: string | null
          etapa?: string
          id?: string
          indicado_por_nome?: string | null
          indicado_por_partner_id?: string | null
          link_gerado_em?: string | null
          link_token?: string | null
          motivo_perda?: string | null
          nome: string
          notas?: string | null
          origem?: string
          partner_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          comissao_gerada?: boolean
          convertido_em?: string | null
          created_at?: string
          created_by?: string | null
          crm_lead_id?: string | null
          documento?: string | null
          email?: string | null
          estado?: string | null
          etapa?: string
          id?: string
          indicado_por_nome?: string | null
          indicado_por_partner_id?: string | null
          link_gerado_em?: string | null
          link_token?: string | null
          motivo_perda?: string | null
          nome?: string
          notas?: string | null
          origem?: string
          partner_id?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospeccao_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prospeccao_leads_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_leads_indicado_por_partner_id_fkey"
            columns: ["indicado_por_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_leads_indicado_por_partner_id_fkey"
            columns: ["indicado_por_partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prospeccao_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "prospeccao_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccao_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      regras_linhas_credito: {
        Row: {
          ativo: boolean | null
          bloqueia_restricao: boolean | null
          categoria: string | null
          cor: string | null
          descricao: string | null
          emoji: string | null
          id: string
          keywords_finalidade: string[] | null
          ltv_maximo: number | null
          min_faturamento_mensal: number | null
          min_renda_mensal: number | null
          nivel: string
          nome: string
          observacoes_internas: string | null
          requer_imovel: boolean | null
          score_base: number | null
          tipo_pessoa: string | null
          updated_at: string | null
          valor_maximo: number | null
          valor_minimo: number | null
        }
        Insert: {
          ativo?: boolean | null
          bloqueia_restricao?: boolean | null
          categoria?: string | null
          cor?: string | null
          descricao?: string | null
          emoji?: string | null
          id: string
          keywords_finalidade?: string[] | null
          ltv_maximo?: number | null
          min_faturamento_mensal?: number | null
          min_renda_mensal?: number | null
          nivel: string
          nome: string
          observacoes_internas?: string | null
          requer_imovel?: boolean | null
          score_base?: number | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Update: {
          ativo?: boolean | null
          bloqueia_restricao?: boolean | null
          categoria?: string | null
          cor?: string | null
          descricao?: string | null
          emoji?: string | null
          id?: string
          keywords_finalidade?: string[] | null
          ltv_maximo?: number | null
          min_faturamento_mensal?: number | null
          min_renda_mensal?: number | null
          nivel?: string
          nome?: string
          observacoes_internas?: string | null
          requer_imovel?: boolean | null
          score_base?: number | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
        }
        Relationships: []
      }
      sdr_campanha_contatos: {
        Row: {
          aberto_at: string | null
          campanha_id: string | null
          email: string
          enviado_at: string | null
          erro: string | null
          id: string
          nome: string | null
          status: string | null
          track_token: string | null
        }
        Insert: {
          aberto_at?: string | null
          campanha_id?: string | null
          email: string
          enviado_at?: string | null
          erro?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          track_token?: string | null
        }
        Update: {
          aberto_at?: string | null
          campanha_id?: string | null
          email?: string
          enviado_at?: string | null
          erro?: string | null
          id?: string
          nome?: string | null
          status?: string | null
          track_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_campanha_contatos_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "sdr_campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_campanhas: {
        Row: {
          assunto: string
          created_at: string | null
          created_by: string | null
          enviada_at: string | null
          id: string
          nome: string
          status: string | null
          template_html: string
          total_abertos: number | null
          total_contatos: number | null
          total_enviados: number | null
        }
        Insert: {
          assunto: string
          created_at?: string | null
          created_by?: string | null
          enviada_at?: string | null
          id?: string
          nome: string
          status?: string | null
          template_html: string
          total_abertos?: number | null
          total_contatos?: number | null
          total_enviados?: number | null
        }
        Update: {
          assunto?: string
          created_at?: string | null
          created_by?: string | null
          enviada_at?: string | null
          id?: string
          nome?: string
          status?: string | null
          template_html?: string
          total_abertos?: number | null
          total_contatos?: number | null
          total_enviados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_campanhas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_campanhas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sdr_config: {
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
      sdr_conversas: {
        Row: {
          content: string
          created_at: string
          id: string
          instance: string
          phone: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          instance?: string
          phone: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          instance?: string
          phone?: string
          role?: string
        }
        Relationships: []
      }
      sdr_leads: {
        Row: {
          humano_ativo: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          nome: string | null
          phone: string
          responsavel_id: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          humano_ativo?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          nome?: string | null
          phone: string
          responsavel_id?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          humano_ativo?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          nome?: string | null
          phone?: string
          responsavel_id?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sdr_optouts: {
        Row: {
          created_at: string | null
          email: string
          motivo: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          motivo?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          motivo?: string | null
        }
        Relationships: []
      }
      split_fiscal: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachments: Json | null
          code: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          partner_id: string | null
          partner_revenue: number | null
          split_percent: number | null
          status: Database["public"]["Enums"]["operation_status"]
          title: string
          total_value: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          partner_revenue?: number | null
          split_percent?: number | null
          status?: Database["public"]["Enums"]["operation_status"]
          title: string
          total_value: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json | null
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          partner_revenue?: number | null
          split_percent?: number | null
          status?: Database["public"]["Enums"]["operation_status"]
          title?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_fiscal_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_fiscal_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "split_fiscal_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_fiscal_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "split_fiscal_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_fiscal_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      team_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          created_at: string | null
          id: string
          room_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          room_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          room_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "team_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
        ]
      }
      team_chat_rooms: {
        Row: {
          allowed_roles: string[]
          description: string | null
          icon: string | null
          id: string
          name: string
          require_socio: boolean | null
        }
        Insert: {
          allowed_roles: string[]
          description?: string | null
          icon?: string | null
          id: string
          name: string
          require_socio?: boolean | null
        }
        Update: {
          allowed_roles?: string[]
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          require_socio?: boolean | null
        }
        Relationships: []
      }
      tec_acceptances: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_email: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          negativation_clause: string
          penalty_clause: string
          proposal_id: string
          status: string
          tec_percentage: number
          token: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_email?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          negativation_clause?: string
          penalty_clause?: string
          proposal_id: string
          status?: string
          tec_percentage: number
          token?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_email?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          negativation_clause?: string
          penalty_clause?: string
          proposal_id?: string
          status?: string
          tec_percentage?: number
          token?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tec_acceptances_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          ticket_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          ticket_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_kyc_monthly_usage"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "operational_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_access: {
        Row: {
          access_level: string
          created_at: string | null
          feature: string
          id: string
          updated_at: string | null
          user_id: string
          vertical_filter: string[] | null
        }
        Insert: {
          access_level?: string
          created_at?: string | null
          feature: string
          id?: string
          updated_at?: string | null
          user_id: string
          vertical_filter?: string[] | null
        }
        Update: {
          access_level?: string
          created_at?: string | null
          feature?: string
          id?: string
          updated_at?: string | null
          user_id?: string
          vertical_filter?: string[] | null
        }
        Relationships: []
      }
      v3_print_standards: {
        Row: {
          categoria: string
          codigo_css: string | null
          codigo_js: string | null
          created_at: string | null
          id: string
          problema: string | null
          regra: string
          solucao: string
          updated_at: string | null
          versao: string | null
        }
        Insert: {
          categoria: string
          codigo_css?: string | null
          codigo_js?: string | null
          created_at?: string | null
          id?: string
          problema?: string | null
          regra: string
          solucao: string
          updated_at?: string | null
          versao?: string | null
        }
        Update: {
          categoria?: string
          codigo_css?: string | null
          codigo_js?: string | null
          created_at?: string | null
          id?: string
          problema?: string | null
          regra?: string
          solucao?: string
          updated_at?: string | null
          versao?: string | null
        }
        Relationships: []
      }
      vdr_blockchain_queue: {
        Row: {
          blockchain_network: string | null
          blockchain_status: string
          confirmed_at: string | null
          created_at: string | null
          deal_code: string | null
          deal_id: string | null
          deal_room_id: string | null
          device_type: string | null
          document_label: string | null
          duration_seconds: number | null
          error_msg: string | null
          event_at: string
          event_hash: string
          event_type: string
          id: string
          investor_email: string | null
          investor_group: string | null
          investor_name: string | null
          invite_id: string | null
          ip_address: string | null
          payload: Json
          submitted_at: string | null
          tx_hash: string | null
          updated_at: string | null
        }
        Insert: {
          blockchain_network?: string | null
          blockchain_status?: string
          confirmed_at?: string | null
          created_at?: string | null
          deal_code?: string | null
          deal_id?: string | null
          deal_room_id?: string | null
          device_type?: string | null
          document_label?: string | null
          duration_seconds?: number | null
          error_msg?: string | null
          event_at?: string
          event_hash: string
          event_type: string
          id?: string
          investor_email?: string | null
          investor_group?: string | null
          investor_name?: string | null
          invite_id?: string | null
          ip_address?: string | null
          payload?: Json
          submitted_at?: string | null
          tx_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          blockchain_network?: string | null
          blockchain_status?: string
          confirmed_at?: string | null
          created_at?: string | null
          deal_code?: string | null
          deal_id?: string | null
          deal_room_id?: string | null
          device_type?: string | null
          document_label?: string | null
          duration_seconds?: number | null
          error_msg?: string | null
          event_at?: string
          event_hash?: string
          event_type?: string
          id?: string
          investor_email?: string | null
          investor_group?: string | null
          investor_name?: string | null
          invite_id?: string | null
          ip_address?: string | null
          payload?: Json
          submitted_at?: string | null
          tx_hash?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vdr_blockchain_queue_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "deal_room_invites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cm_vitrine_public: {
        Row: {
          allows_tranching: boolean | null
          anonymous_id: string | null
          asset_type: Database["public"]["Enums"]["cm_asset_type"] | null
          created_at: string | null
          desagio_pretendido: number | null
          ente_devedor: string | null
          esfera: string | null
          id: string | null
          listing_status:
            | Database["public"]["Enums"]["cm_listing_status"]
            | null
          natureza: string | null
          prazo_estimado_meses: number | null
          risk_score: number | null
          tir_estimada: number | null
          tribunal: string | null
          valor_atualizado: number | null
          valor_face: number | null
          vpl: number | null
        }
        Insert: {
          allows_tranching?: boolean | null
          anonymous_id?: string | null
          asset_type?: Database["public"]["Enums"]["cm_asset_type"] | null
          created_at?: string | null
          desagio_pretendido?: number | null
          ente_devedor?: string | null
          esfera?: string | null
          id?: string | null
          listing_status?:
            | Database["public"]["Enums"]["cm_listing_status"]
            | null
          natureza?: string | null
          prazo_estimado_meses?: number | null
          risk_score?: number | null
          tir_estimada?: number | null
          tribunal?: string | null
          valor_atualizado?: number | null
          valor_face?: number | null
          vpl?: number | null
        }
        Update: {
          allows_tranching?: boolean | null
          anonymous_id?: string | null
          asset_type?: Database["public"]["Enums"]["cm_asset_type"] | null
          created_at?: string | null
          desagio_pretendido?: number | null
          ente_devedor?: string | null
          esfera?: string | null
          id?: string | null
          listing_status?:
            | Database["public"]["Enums"]["cm_listing_status"]
            | null
          natureza?: string | null
          prazo_estimado_meses?: number | null
          risk_score?: number | null
          tir_estimada?: number | null
          tribunal?: string | null
          valor_atualizado?: number | null
          valor_face?: number | null
          vpl?: number | null
        }
        Relationships: []
      }
      v_kyc_monthly_usage: {
        Row: {
          analyses_this_month: number | null
          current_month: string | null
          email: string | null
          full_name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
        }
        Relationships: []
      }
      vdr_audit_trail: {
        Row: {
          blockchain_status: string | null
          confirmed_at: string | null
          deal_code: string | null
          device_type: string | null
          document_label: string | null
          duration_seconds: number | null
          event_at: string | null
          event_hash: string | null
          event_type: string | null
          id: string | null
          investor_email: string | null
          investor_group: string | null
          investor_name: string | null
          ip_address: string | null
          payload: Json | null
          seconds_to_confirm: number | null
          tx_hash: string | null
        }
        Insert: {
          blockchain_status?: string | null
          confirmed_at?: string | null
          deal_code?: string | null
          device_type?: string | null
          document_label?: string | null
          duration_seconds?: number | null
          event_at?: string | null
          event_hash?: string | null
          event_type?: string | null
          id?: string | null
          investor_email?: string | null
          investor_group?: string | null
          investor_name?: string | null
          ip_address?: string | null
          payload?: Json | null
          seconds_to_confirm?: never
          tx_hash?: string | null
        }
        Update: {
          blockchain_status?: string | null
          confirmed_at?: string | null
          deal_code?: string | null
          device_type?: string | null
          document_label?: string | null
          duration_seconds?: number | null
          event_at?: string | null
          event_hash?: string | null
          event_type?: string | null
          id?: string | null
          investor_email?: string | null
          investor_group?: string | null
          investor_name?: string | null
          ip_address?: string | null
          payload?: Json | null
          seconds_to_confirm?: never
          tx_hash?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_cm_commission_split: {
        Args: { p_commission_percent: number; p_valor_face: number }
        Returns: Json
      }
      calculate_cm_financials: {
        Args: {
          p_desagio?: number
          p_prazo_meses?: number
          p_tir?: number
          p_valor_face: number
        }
        Returns: Json
      }
      create_cm_checklist: {
        Args: { p_bid_id?: string; p_listing_id: string; p_type?: string }
        Returns: string
      }
      create_deal_folder: {
        Args: {
          p_client_name: string
          p_deal_code: string
          p_user_id: string
          p_vertical: string
        }
        Returns: string
      }
      extractuf: { Args: { p_location: string }; Returns: string }
      generate_cm_anonymous_id: {
        Args: {
          p_asset_type: Database["public"]["Enums"]["cm_asset_type"]
          p_esfera?: string
        }
        Returns: string
      }
      generate_v3_deal_code: {
        Args: { p_date?: string; p_sector_code: string }
        Returns: string
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      match_cm_listings_to_demands: { Args: never; Returns: number }
      match_deals_for_investor: {
        Args: { p_demand_id: string }
        Returns: {
          deal_id: string
          reasons: Json
          score: number
          setor: string
          title: string
          uf: string
          v3_code: string
          valor: number
        }[]
      }
      match_investors_for_deal: {
        Args: { p_deal_id: string }
        Returns: {
          criterios: string
          email: string
          investor_id: string
          match_reasons: string[]
          match_score: number
          nome: string
          setores: string[]
          status: string
          telefone: string
          ticket_max: number
          ticket_min: number
          tipo: string
          tipos_operacao: string[]
          ufs: string[]
        }[]
      }
      search_documents_rag: {
        Args: {
          p_limit?: number
          p_query_embedding: string
          p_similarity_threshold?: number
          p_user_id: string
          p_vertical?: string
        }
        Returns: {
          chunk_id: string
          content: string
          deal_code: string
          folder_path: string
          is_pii_masked: boolean
          similarity: number
        }[]
      }
      transition_cm_listing_status: {
        Args: {
          p_listing_id: string
          p_new_status: Database["public"]["Enums"]["cm_listing_status"]
          p_reason?: string
          p_user_id?: string
        }
        Returns: boolean
      }
      user_can_access_team_room: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      validate_folder_path: { Args: { p_path: string }; Returns: boolean }
      vdr_compute_event_hash: {
        Args: {
          p_deal_code: string
          p_event_at: string
          p_event_type: string
          p_investor_email: string
          p_ip_address: string
        }
        Returns: string
      }
    }
    Enums: {
      agent_export_type: "deal" | "relatorio" | "nenhum"
      assessment_origem: "site_publico" | "portal_interno" | "reuniao"
      assessment_status:
        | "rascunho"
        | "completo"
        | "em_analise"
        | "promovido"
        | "descartado"
      cm_asset_type:
        | "precatorio"
        | "direito_creditorio"
        | "cgi"
        | "cri"
        | "fidc"
        | "outros"
      cm_bid_status:
        | "pendente"
        | "aceita"
        | "recusada"
        | "contra_proposta"
        | "expirada"
      cm_listing_status:
        | "reuniao_validada"
        | "formulario_preenchido"
        | "nda_assinado"
        | "em_analise"
        | "aprovado_head"
        | "ativo_vitrine"
        | "proposta_recebida"
        | "em_escrow_due_diligence"
        | "liquidado"
        | "cancelado"
        | "expirado"
      cm_payment_type: "a_vista" | "parcelado" | "escrow"
      cm_tranche_status: "disponivel" | "reservada" | "vendida" | "cancelada"
      contract_signature_status:
        | "rascunho"
        | "enviado_assinatura"
        | "assinado"
        | "recusado"
        | "expirado"
        | "cancelado"
      contract_vertical:
        | "capital_markets"
        | "credito"
        | "ma"
        | "institucional"
        | "clientes"
        | "talent_pool"
        | "colaboradores"
      credit_desk_level: "NIVEL_1" | "NIVEL_2" | "NIVEL_3"
      deal_stage:
        | "PROSPECTING"
        | "QUALIFICATION"
        | "IOI"
        | "PROPOSAL"
        | "DUE_DILIGENCE"
        | "NEGOTIATION"
        | "CLOSING"
        | "CLOSED_WON"
        | "CLOSED_LOST"
      instrumento_recomendado:
        | "CRI_VERDE"
        | "TOKEN_RWA"
        | "FIDC_ESG"
        | "EQUITY_TOKEN"
        | "MA_ESTRUTURADO"
        | "INDEFINIDO"
      meeting_status: "agendada" | "realizada" | "cancelada" | "remarcada"
      meeting_type: "presencial" | "remoto" | "call" | "whatsapp"
      operation_status:
        | "DRAFT"
        | "PENDING"
        | "IN_REVIEW"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "COMPLETED"
      origem_lead_v3:
        | "parceiro"
        | "cold_outreach"
        | "indicacao"
        | "evento"
        | "inbound"
        | "whatsapp_audio"
      setor_v3:
        | "credito_recebiveis"
        | "real_estate"
        | "mineracao_commodities"
        | "ma_cross_border"
        | "outro"
      status_intake: "novo" | "em_analise" | "deal_card_gerado" | "arquivado"
      ticket_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      tipo_operacao_v3: "venda" | "fusao" | "captacao" | "estruturacao"
      user_role:
        | "ADMIN"
        | "PARTNER"
        | "PARTNER_PRO"
        | "MESA_OPERACIONAL"
        | "GESTAO"
        | "FINANCEIRO"
        | "SDR"
        | "CLOSER"
        | "STARTER"
        | "ENTERPRISE"
        | "INSTITUICAO"
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
      agent_export_type: ["deal", "relatorio", "nenhum"],
      assessment_origem: ["site_publico", "portal_interno", "reuniao"],
      assessment_status: [
        "rascunho",
        "completo",
        "em_analise",
        "promovido",
        "descartado",
      ],
      cm_asset_type: [
        "precatorio",
        "direito_creditorio",
        "cgi",
        "cri",
        "fidc",
        "outros",
      ],
      cm_bid_status: [
        "pendente",
        "aceita",
        "recusada",
        "contra_proposta",
        "expirada",
      ],
      cm_listing_status: [
        "reuniao_validada",
        "formulario_preenchido",
        "nda_assinado",
        "em_analise",
        "aprovado_head",
        "ativo_vitrine",
        "proposta_recebida",
        "em_escrow_due_diligence",
        "liquidado",
        "cancelado",
        "expirado",
      ],
      cm_payment_type: ["a_vista", "parcelado", "escrow"],
      cm_tranche_status: ["disponivel", "reservada", "vendida", "cancelada"],
      contract_signature_status: [
        "rascunho",
        "enviado_assinatura",
        "assinado",
        "recusado",
        "expirado",
        "cancelado",
      ],
      contract_vertical: [
        "capital_markets",
        "credito",
        "ma",
        "institucional",
        "clientes",
        "talent_pool",
        "colaboradores",
      ],
      credit_desk_level: ["NIVEL_1", "NIVEL_2", "NIVEL_3"],
      deal_stage: [
        "PROSPECTING",
        "QUALIFICATION",
        "IOI",
        "PROPOSAL",
        "DUE_DILIGENCE",
        "NEGOTIATION",
        "CLOSING",
        "CLOSED_WON",
        "CLOSED_LOST",
      ],
      instrumento_recomendado: [
        "CRI_VERDE",
        "TOKEN_RWA",
        "FIDC_ESG",
        "EQUITY_TOKEN",
        "MA_ESTRUTURADO",
        "INDEFINIDO",
      ],
      meeting_status: ["agendada", "realizada", "cancelada", "remarcada"],
      meeting_type: ["presencial", "remoto", "call", "whatsapp"],
      operation_status: [
        "DRAFT",
        "PENDING",
        "IN_REVIEW",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
      ],
      origem_lead_v3: [
        "parceiro",
        "cold_outreach",
        "indicacao",
        "evento",
        "inbound",
        "whatsapp_audio",
      ],
      setor_v3: [
        "credito_recebiveis",
        "real_estate",
        "mineracao_commodities",
        "ma_cross_border",
        "outro",
      ],
      status_intake: ["novo", "em_analise", "deal_card_gerado", "arquivado"],
      ticket_priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      tipo_operacao_v3: ["venda", "fusao", "captacao", "estruturacao"],
      user_role: [
        "ADMIN",
        "PARTNER",
        "PARTNER_PRO",
        "MESA_OPERACIONAL",
        "GESTAO",
        "FINANCEIRO",
        "SDR",
        "CLOSER",
        "STARTER",
        "ENTERPRISE",
        "INSTITUICAO",
      ],
    },
  },
} as const
