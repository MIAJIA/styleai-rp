# Resources API 文档

## 概述

Resources API 提供了对资源表的完整 CRUD 操作，支持软删除功能。

## 基础 URL

```
/api/apple/web/resources
```

## API 端点

### 1. 获取资源列表

**GET** `/api/apple/web/resources`

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 否 | 获取指定 ID 的资源 |
| `type` | string | 否 | 按类型过滤资源（如：image, product, video等） |
| `include_deleted` | boolean | 否 | 是否包含已删除的资源（默认: false） |
| `limit` | number | 否 | 返回记录数限制 |
| `offset` | number | 否 | 分页偏移量 |

#### 示例请求

```bash
# 获取所有资源
GET /api/apple/web/resources

# 获取单个资源
GET /api/apple/web/resources?id=1

# 按类型过滤
GET /api/apple/web/resources?type=image

# 包含已删除的资源
GET /api/apple/web/resources?include_deleted=true

# 分页查询
GET /api/apple/web/resources?limit=10&offset=0

# 组合查询：按类型 + 分页
GET /api/apple/web/resources?type=product&limit=20&offset=0
```

#### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "时尚T恤",
      "type": "product",
      "url": "https://example.com/image.jpg",
      "shopurl": "https://shop.example.com/product/1",
      "deleted_at": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

---

### 2. 创建资源

**POST** `/api/apple/web/resources`

#### 请求体

```json
{
  "name": "资源名称",
  "type": "image",  // 必填：资源类型（如：image, product, video等）
  "url": "https://example.com/image.jpg",
  "shopurl": "https://shop.example.com/product/1"  // 可选
}
```

#### 示例请求

```bash
curl -X POST /api/apple/web/resources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "时尚T恤",
    "type": "product",
    "url": "https://example.com/image.jpg",
    "shopurl": "https://shop.example.com/product/1"
  }'
```

#### 响应示例

```json
{
  "success": true,
  "data":     {
      "id": 1,
      "name": "时尚T恤",
      "type": "product",
      "url": "https://example.com/image.jpg",
      "shopurl": "https://shop.example.com/product/1",
      "deleted_at": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
  "message": "Resource created successfully"
}
```

---

### 3. 更新资源

**PUT** `/api/apple/web/resources`

#### 请求体

```json
{
  "id": 1,
  "name": "更新后的名称",  // 可选
  "type": "image",  // 可选：更新资源类型
  "url": "https://new-url.com/image.jpg",  // 可选
  "shopurl": "https://new-shop.com/product/1"  // 可选
}
```

#### 示例请求

```bash
curl -X PUT /api/apple/web/resources \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "name": "更新后的名称"
  }'
```

#### 响应示例

```json
{
  "success": true,
  "data":     {
      "id": 1,
      "name": "更新后的名称",
      "type": "image",
      "url": "https://example.com/image.jpg",
      "shopurl": "https://shop.example.com/product/1",
      "deleted_at": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T01:00:00Z"
    },
  "message": "Resource updated successfully"
}
```

---

### 4. 删除资源

**DELETE** `/api/apple/web/resources`

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 要删除的资源 ID |
| `hard` | boolean | 否 | 是否永久删除（默认: false，软删除） |
| `restore` | boolean | 否 | 是否恢复已删除的资源 |

#### 示例请求

```bash
# 软删除（默认）
DELETE /api/apple/web/resources?id=1

# 永久删除
DELETE /api/apple/web/resources?id=1&hard=true

# 恢复已删除的资源
DELETE /api/apple/web/resources?id=1&restore=true
```

#### 响应示例

```json
{
  "success": true,
  "message": "Resource deleted successfully"
}
```

---

## TypeScript 使用示例

### 在组件中使用

```typescript
import { useState, useEffect } from 'react';

interface Resource {
  id: number;
  name: string;
  type: string;
  url: string;
  shopurl: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function ResourcesList() {
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    fetch('/api/apple/web/resources')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setResources(data.data);
        }
      });
  }, []);

  const handleDelete = async (id: number) => {
    const response = await fetch(`/api/apple/web/resources?id=${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (data.success) {
      // 刷新列表
      window.location.reload();
    }
  };

  return (
    <div>
      {resources.map(resource => (
        <div key={resource.id}>
          <h3>{resource.name}</h3>
          <img src={resource.url} alt={resource.name} />
          {resource.shopurl && (
            <a href={resource.shopurl}>购买链接</a>
          )}
          <button onClick={() => handleDelete(resource.id)}>删除</button>
        </div>
      ))}
    </div>
  );
}
```

### 使用数据库函数

```typescript
import {
  getResources,
  createResource,
  updateResource,
  deleteResource,
} from '@/lib/db/resources';

// 获取资源列表
const resources = await getResources({ limit: 10 });

// 创建资源
const newResource = await createResource({
  name: '新资源',
  type: 'product',
  url: 'https://example.com/image.jpg',
  shopurl: 'https://shop.example.com/product/1',
});

// 更新资源
await updateResource(1, { name: '更新后的名称' });

// 删除资源（软删除）
await deleteResource(1);
```

---

## 错误处理

所有 API 端点都会返回统一的错误格式：

```json
{
  "success": false,
  "error": "错误消息"
}
```

常见错误码：
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 注意事项

1. **资源类型**: `type` 字段是必填的，用于分类资源（如：image, product, video等）
2. **类型索引**: `type` 字段已建立索引，按类型查询性能优化
3. **软删除**: 默认情况下，删除操作是软删除，资源不会被真正删除，只是标记 `deleted_at` 字段
4. **查询过滤**: 默认查询会自动过滤掉已删除的资源（`deleted_at IS NULL`）
5. **时间戳**: `created_at` 和 `updated_at` 由数据库自动管理
6. **ID 自增**: `id` 字段使用 `BIGSERIAL`，会自动递增

