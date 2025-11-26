import { NextRequest, NextResponse } from "next/server";
import {
  getResources,
  createResource,
  getResourceById,
  updateResource,
  deleteResource,
  restoreResource,
  hardDeleteResource,
  getDeletedResources,
} from '@/lib/db/resources';
import type { CreateResourceInput, UpdateResourceInput } from '@/lib/types/resources';

/**
 * GET /api/apple/web/resources
 * 获取资源列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeDeleted = searchParams.get('include_deleted') === 'true';
    const type = searchParams.get('type') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const id = searchParams.get('id');

    // 如果提供了 id，返回单个资源
    if (id) {
      const resource = await getResourceById(id);
      if (!resource) {
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: resource });
    }

    // 获取资源列表
    const resources = await getResources({
      type,
      include_deleted: includeDeleted,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: resources,
      count: resources.length,
    });
  } catch (error: any) {
    console.error('[Resources API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/apple/web/resources
 * 创建新资源
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, url, shopurl } = body;

    // 验证必填字段
    if (!name || !type || !url) {
      return NextResponse.json(
        { success: false, error: 'Name, type and URL are required' },
        { status: 400 }
      );
    }

    const input: CreateResourceInput = {
      name,
      type,
      url,
      shopurl: shopurl || null,
    };

    const resource = await createResource(input);

    return NextResponse.json({
      success: true,
      data: resource,
      message: 'Resource created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Resources API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create resource' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/apple/web/resources
 * 更新资源
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type, url, shopurl } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Resource ID is required' },
        { status: 400 }
      );
    }

    const input: UpdateResourceInput = {};
    if (name !== undefined) input.name = name;
    if (type !== undefined) input.type = type;
    if (url !== undefined) input.url = url;
    if (shopurl !== undefined) input.shopurl = shopurl;

    const resource = await updateResource(id, input);

    return NextResponse.json({
      success: true,
      data: resource,
      message: 'Resource updated successfully',
    });
  } catch (error: any) {
    console.error('[Resources API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update resource' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/apple/web/resources
 * 软删除资源
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const hard = searchParams.get('hard') === 'true'; // 是否硬删除
    const restore = searchParams.get('restore') === 'true'; // 是否恢复

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Resource ID is required' },
        { status: 400 }
      );
    }

    // 恢复资源
    if (restore) {
      const resource = await restoreResource(id);
      return NextResponse.json({
        success: true,
        data: resource,
        message: 'Resource restored successfully',
      });
    }

    // 硬删除
    if (hard) {
      await hardDeleteResource(id);
      return NextResponse.json({
        success: true,
        message: 'Resource permanently deleted',
      });
    }

    // 软删除（默认）
    await deleteResource(id);
    return NextResponse.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error: any) {
    console.error('[Resources API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete resource' },
      { status: 500 }
    );
  }
}
