export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: { key: string; value: string | null };
        Insert: { key: string; value?: string | null };
        Update: { key?: string; value?: string | null };
        Relationships: [];
      };
      categories: {
        Row: { created_at: string; id: string; name: string; slug: string };
        Insert: { created_at?: string; id?: string; name: string; slug: string };
        Update: { created_at?: string; id?: string; name?: string; slug?: string };
        Relationships: [];
      };
      premium_codes: {
        Row: {
          code: string;
          created_at: string;
          days: number | null;
          expires_at: string;
          id: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          days?: number | null;
          expires_at: string;
          id?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          days?: number | null;
          expires_at?: string;
          id?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [];
      };
      videos: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string | null;
          duration_seconds: number | null;
          embed_url: string;
          external_id: string | null;
          id: string;
          is_paid: boolean | null;
          is_published: boolean | null;
          likes: number | null;
          slug: string | null;
          source_id: string | null;
          thumbnail_url: string | null;
          title: string;
          views: number | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          embed_url: string;
          external_id?: string | null;
          id?: string;
          is_paid?: boolean | null;
          is_published?: boolean | null;
          likes?: number | null;
          slug?: string | null;
          source_id?: string | null;
          thumbnail_url?: string | null;
          title: string;
          views?: number | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_seconds?: number | null;
          embed_url?: string;
          external_id?: string | null;
          id?: string;
          is_paid?: boolean | null;
          is_published?: boolean | null;
          likes?: number | null;
          slug?: string | null;
          source_id?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "videos_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      increment_video_likes: {
        Args: { _video_id: string };
        Returns: number;
      };
      increment_video_views: {
        Args: { _video_id: string };
        Returns: undefined;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
