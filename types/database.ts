export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskStatus = "queued" | "processing" | "completed" | "failed" | "expired";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_hash: string;
          prefix: string;
          active: boolean;
          requests_per_minute: number;
          daily_limit: number;
          monthly_limit: number;
          max_results_per_task: number;
          scraping_enabled: boolean;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          key_hash: string;
          prefix: string;
          active?: boolean;
          requests_per_minute?: number;
          daily_limit?: number;
          monthly_limit?: number;
          max_results_per_task?: number;
          scraping_enabled?: boolean;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          key_hash?: string;
          prefix?: string;
          active?: boolean;
          requests_per_minute?: number;
          daily_limit?: number;
          monthly_limit?: number;
          max_results_per_task?: number;
          scraping_enabled?: boolean;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      search_tasks: {
        Row: {
          id: string;
          user_id: string;
          api_key_id: string | null;
          query: string;
          search_type: string;
          status: TaskStatus;
          requested_results: number;
          successful_results: number;
          failed_results: number;
          callback_url: string | null;
          callback_secret: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          api_key_id?: string | null;
          query: string;
          search_type?: string;
          status?: TaskStatus;
          requested_results?: number;
          successful_results?: number;
          failed_results?: number;
          callback_url?: string | null;
          callback_secret?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          api_key_id?: string | null;
          query?: string;
          search_type?: string;
          status?: TaskStatus;
          requested_results?: number;
          successful_results?: number;
          failed_results?: number;
          callback_url?: string | null;
          callback_secret?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      search_results: {
        Row: {
          id: string;
          task_id: string;
          position: number;
          title: string | null;
          url: string;
          canonical_url: string | null;
          domain: string | null;
          snippet: string | null;
          raw_content: string | null;
          cleaned_content: string | null;
          published_at: string | null;
          relevance_score: number | null;
          scrape_status: string;
          error_message: string | null;
          selected_for_final_answer: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          position: number;
          title?: string | null;
          url: string;
          canonical_url?: string | null;
          domain?: string | null;
          snippet?: string | null;
          raw_content?: string | null;
          cleaned_content?: string | null;
          published_at?: string | null;
          relevance_score?: number | null;
          scrape_status?: string;
          error_message?: string | null;
          selected_for_final_answer?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          position?: number;
          title?: string | null;
          url?: string;
          canonical_url?: string | null;
          domain?: string | null;
          snippet?: string | null;
          raw_content?: string | null;
          cleaned_content?: string | null;
          published_at?: string | null;
          relevance_score?: number | null;
          scrape_status?: string;
          error_message?: string | null;
          selected_for_final_answer?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      task_events: {
        Row: {
          id: string;
          task_id: string;
          event_type: string;
          message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          event_type: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          event_type?: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      final_reports: {
        Row: {
          id: string;
          task_id: string;
          summary: string | null;
          key_findings: Json;
          final_answer: string | null;
          source_ids: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          summary?: string | null;
          key_findings?: Json;
          final_answer?: string | null;
          source_ids?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          summary?: string | null;
          key_findings?: Json;
          final_answer?: string | null;
          source_ids?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_tasks: {
        Row: {
          id: string;
          user_id: string;
          linked_search_task_id: string | null;
          mode: string;
          query: string;
          event_name: string | null;
          event_date: string | null;
          location: string | null;
          event_description: string | null;
          desired_media: string | null;
          media_kind: string;
          source_preference: string;
          status: TaskStatus;
          requested_results: number;
          successful_results: number;
          failed_results: number;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          linked_search_task_id?: string | null;
          mode?: string;
          query: string;
          event_name?: string | null;
          event_date?: string | null;
          location?: string | null;
          event_description?: string | null;
          desired_media?: string | null;
          media_kind?: string;
          source_preference?: string;
          status?: TaskStatus;
          requested_results?: number;
          successful_results?: number;
          failed_results?: number;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          linked_search_task_id?: string | null;
          mode?: string;
          query?: string;
          event_name?: string | null;
          event_date?: string | null;
          location?: string | null;
          event_description?: string | null;
          desired_media?: string | null;
          media_kind?: string;
          source_preference?: string;
          status?: TaskStatus;
          requested_results?: number;
          successful_results?: number;
          failed_results?: number;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      media_results: {
        Row: {
          id: string;
          media_task_id: string;
          position: number;
          title: string | null;
          source_url: string;
          media_url: string | null;
          thumbnail_url: string | null;
          source_domain: string | null;
          source_type: string;
          media_kind: string;
          description: string | null;
          author: string | null;
          published_at: string | null;
          relevance_score: number | null;
          license_note: string | null;
          selected_for_video: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          media_task_id: string;
          position: number;
          title?: string | null;
          source_url: string;
          media_url?: string | null;
          thumbnail_url?: string | null;
          source_domain?: string | null;
          source_type?: string;
          media_kind?: string;
          description?: string | null;
          author?: string | null;
          published_at?: string | null;
          relevance_score?: number | null;
          license_note?: string | null;
          selected_for_video?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          media_task_id?: string;
          position?: number;
          title?: string | null;
          source_url?: string;
          media_url?: string | null;
          thumbnail_url?: string | null;
          source_domain?: string | null;
          source_type?: string;
          media_kind?: string;
          description?: string | null;
          author?: string | null;
          published_at?: string | null;
          relevance_score?: number | null;
          license_note?: string | null;
          selected_for_video?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      media_task_events: {
        Row: {
          id: string;
          media_task_id: string;
          event_type: string;
          message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          media_task_id: string;
          event_type: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          media_task_id?: string;
          event_type?: string;
          message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      search_task_status: TaskStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
