import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/apple/web/shoplook
 * 添加 Look 与 Resource 的关联
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { look_id, resource_id, order } = body;

    if (!look_id || !resource_id) {
      return NextResponse.json(
        { success: false, error: 'look_id 和 resource_id 不能为空' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('shoplook')
      .insert({
        look_id,
        resource_id,
        order: order || 0
      })
      .select()
      .single();

    if (error) {
      // 处理唯一约束错误
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: '该资源已添加到此 Look' },
          { status: 409 }
        );
      }
      console.error('Error creating shoplook:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in POST /api/apple/web/shoplook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/apple/web/shoplook
 * 获取 Look 关联的所有 Resource
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const look_id = searchParams.get('look_id');

    if (!look_id) {
      return NextResponse.json(
        { success: false, error: 'look_id 参数必填' },
        { status: 400 }
      );
    }

    // 联表查询，获取关联的 resource 详情
    const { data, error } = await supabase
      .from('shoplook')
      .select(`
        id,
        look_id,
        resource_id,
        order,
        created_at,
        resources (
          id,
          name,
          url,
          type,
          shopurl
        )
      `)
      .eq('look_id', look_id)
      .order('order', { ascending: true });

    if (error) {
      console.error('Error fetching shoplook:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/apple/web/shoplook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/apple/web/shoplook
 * 删除 Look 与 Resource 的关联
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const look_id = searchParams.get('look_id');
    const resource_id = searchParams.get('resource_id');

    let query = supabase.from('shoplook').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (look_id && resource_id) {
      query = query.eq('look_id', look_id).eq('resource_id', resource_id);
    } else {
      return NextResponse.json(
        { success: false, error: '需要提供 id 或 (look_id + resource_id)' },
        { status: 400 }
      );
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting shoplook:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('Error in DELETE /api/apple/web/shoplook:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

