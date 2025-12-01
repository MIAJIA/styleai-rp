import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/apple/web/style-templates
 * 创建新的 Style Template (Look)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, urls, post, prompt, order } = body;

    // 验证输入
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: '名称不能为空' },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: '名称不能超过100个字符' },
        { status: 400 }
      );
    }

    console.log('Creating style_templates:', name, urls, post, prompt, order);
    // 插入到 style_templates 表
    const { data, error } = await supabase
      .from('style_templates')
      .insert({
        name: name.trim(),
        urls: urls || '',
        post: post || '',
        prompt: prompt || '',
        order: order || 0,
        state: true, // 默认状态为 true（可用）
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating style_templates:', error);
      return NextResponse.json(
        { success: false, error: error.message || '数据库操作失败，请稍后重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('Error in POST /api/apple/web/style-templates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/apple/web/style-templates
 * 获取所有 Style Templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name'); // 按 name 过滤

    let queryBuilder = supabase
      .from('style_templates')
      .select('*')
      .eq('state', true) // 只查询 state = true 的记录（可用）
      .order('order', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    // 如果提供了 name 参数，添加过滤条件
    if (name) {
      queryBuilder = queryBuilder.eq('name', name);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching style_templates:', error);
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
    console.error('Error in GET /api/apple/web/style-templates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/apple/web/style-templates
 * 更新 Style Template
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, urls, post, prompt, order, state } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (urls !== undefined) updateData.urls = urls;
    if (post !== undefined) updateData.post = post;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (order !== undefined) updateData.order = order;
    if (state !== undefined) updateData.state = state;

    const { data, error } = await supabase
      .from('style_templates')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating style_templates:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to update' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data[0],
    });
  } catch (error: any) {
    console.error('Error in PUT /api/apple/web/style-templates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/apple/web/style-templates
 * 软删除 Style Template（将 state 设置为 false）
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

    // 软删除：将 state 设置为 false
    const { data, error } = await supabase
      .from('style_templates')
      .update({ 
        state: false
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error soft deleting style_templates:', error);
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
    console.error('Error in DELETE /api/apple/web/style-templates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

