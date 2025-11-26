/**
 * Resources 表类型定义
 */

export interface Resource {
  id: number;
  name: string;
  type: string;
  url: string;
  shopurl: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateResourceInput {
  name: string;
  type: string;
  url: string;
  shopurl?: string | null;
}

export interface UpdateResourceInput {
  name?: string;
  type?: string;
  url?: string;
  shopurl?: string | null;
}

export interface ResourceQuery {
  type?: string;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

