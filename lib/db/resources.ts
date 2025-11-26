import { supabase } from '@/lib/supabase';
import type { Resource, CreateResourceInput, UpdateResourceInput, ResourceQuery } from '@/lib/types/resources';

/**
 * 获取所有资源（排除已删除的）
 */
export async function getResources(query?: ResourceQuery): Promise<Resource[]> {
  let queryBuilder = supabase
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false });

  // 按类型过滤
  if (query?.type) {
    queryBuilder = queryBuilder.eq('type', query.type);
  }

  // 默认排除已删除的记录
  if (!query?.include_deleted) {
    queryBuilder = queryBuilder.is('deleted_at', null);
  }

  // 分页
  if (query?.limit) {
    queryBuilder = queryBuilder.limit(query.limit);
  }
  if (query?.offset) {
    queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 10) - 1);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('Error fetching resources:', error);
    throw new Error(`Failed to fetch resources: ${error.message}`);
  }

  return data as Resource[];
}

/**
 * 根据 ID 获取单个资源
 */
export async function getResourceById(id: string): Promise<Resource | null> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // 记录不存在
      return null;
    }
    console.error('Error fetching resource:', error);
    throw new Error(`Failed to fetch resource: ${error.message}`);
  }

  return data as Resource;
}

/**
 * 创建新资源
 */
export async function createResource(input: CreateResourceInput): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      name: input.name,
      type: input.type,
      url: input.url,
      shopurl: input.shopurl || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating resource:', error);
    throw new Error(`Failed to create resource: ${error.message}`);
  }

  return data as Resource;
}

/**
 * 更新资源
 */
export async function updateResource(id: string, input: UpdateResourceInput): Promise<Resource> {
  const updateData: Partial<Resource> = {};
  
  if (input.name !== undefined) updateData.name = input.name;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.url !== undefined) updateData.url = input.url;
  if (input.shopurl !== undefined) updateData.shopurl = input.shopurl;

  const { data, error } = await supabase
    .from('resources')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    console.error('Error updating resource:', error);
    throw new Error(`Failed to update resource: ${error.message}`);
  }

  return data as Resource;
}

/**
 * 软删除资源
 */
export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    console.error('Error deleting resource:', error);
    throw new Error(`Failed to delete resource: ${error.message}`);
  }
}

/**
 * 永久删除资源（硬删除）
 */
export async function hardDeleteResource(id: string): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error hard deleting resource:', error);
    throw new Error(`Failed to hard delete resource: ${error.message}`);
  }
}

/**
 * 恢复已删除的资源
 */
export async function restoreResource(id: string): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select()
    .single();

  if (error) {
    console.error('Error restoring resource:', error);
    throw new Error(`Failed to restore resource: ${error.message}`);
  }

  return data as Resource;
}

/**
 * 获取已删除的资源
 */
export async function getDeletedResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted resources:', error);
    throw new Error(`Failed to fetch deleted resources: ${error.message}`);
  }

  return data as Resource[];
}

/**
 * 根据类型获取资源（便捷方法）
 */
export async function getResourcesByType(type: string, includeDeleted: boolean = false): Promise<Resource[]> {
  return getResources({
    type,
    include_deleted: includeDeleted,
  });
}

