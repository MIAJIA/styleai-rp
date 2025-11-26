import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/apple/web/for-you
 * 创建新的 Lookbook 到 for_you 表
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    // 验证输入
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: '集合名称不能为空' },
        { status: 400 }
      );
    }

    // 验证名称长度
    if (name.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: '集合名称不能超过100个字符' },
        { status: 400 }
      );
    }

    const nextOrder = await getNextOrder();

    // 插入到 for_you 表
    const { data, error } = await supabase
      .from('for_you')
      .insert({
        name: name.trim(),
        url: '', // 根据用户要求，url 为空字符串
        state: 0, // 使用数字类型，0 表示下架，1 表示上线
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating for_you:', error);

      // 处理唯一约束错误
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        return NextResponse.json(
          { success: false, error: '该名称已存在，请使用其他名称' },
          { status: 409 }
        );
      }

      // 处理其他数据库错误
      console.error('Database error details:', error);
      return NextResponse.json(
        { success: false, error: '数据库操作失败，请稍后重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error in POST /api/apple/web/for-you:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


async function getNextOrder() {
  const { data: maxOrderData } = await supabase
      .from('for_you')
      .select('order')
      .order('order', { ascending: false })
      .limit(1)
      .single();
  return (maxOrderData?.order || -1) + 1;
}

/**
 * GET /api/apple/web/for-you
 * 获取所有 Lookbooks
 * 支持 ?include_deleted=true 参数查询所有记录（包括已删除）
 * 支持 ?name=xxx 参数按名称查询单个 Lookbook
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('include_deleted') === 'true';
    const name = searchParams.get('name');

    let queryBuilder = supabase
      .from('for_you')
      .select('*')
      .order('order', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    // 按名称查询
    if (name) {
      queryBuilder = queryBuilder.eq('name', name);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching for_you:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/apple/web/for-you:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/apple/web/for-you
 * 更新 Lookbook（主要用于更新 state）
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, state, name, url, order } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (state !== undefined) updateData.state = state;
    if (name !== undefined) updateData.name = name.trim();
    if (url !== undefined) updateData.url = url;
    if (order !== undefined) updateData.order = order;

    const { data, error } = await supabase
      .from('for_you')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating for_you:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to update' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/apple/web/for-you:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/apple/web/for-you
 * 软删除 Lookbook（将 state 设置为 2）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    // 软删除：将 state 设置为 2
    const { data, error } = await supabase
      .from('for_you')
      .update({
        state: 2,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error soft deleting for_you:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to delete' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Deleted successfully',
      data: data
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/apple/web/for-you:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

