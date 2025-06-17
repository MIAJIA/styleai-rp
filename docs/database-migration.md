# 数据库迁移系统文档

## 概述

本文档描述了从 localStorage 迁移到 Vercel KV + Blob 数据库系统的完整方案。

## 技术架构

### 存储方案
- **元数据存储**: Vercel KV (Redis-based)
- **图片存储**: Vercel Blob Storage
- **回退方案**: localStorage (用于离线或错误时)

### 数据结构
```typescript
interface DBLook {
  id: string;
  userId?: string;
  style: string | null;
  occasion: string;
  timestamp: number;
  finalImageUrl: string;
  originalHumanImageUrl?: string;
  originalGarmentImageUrl?: string;
  garmentDescription?: string;
  personaProfile?: any;
  processImages?: {
    humanImageUrl: string;
    garmentImageUrl: string;
    finalImageUrl: string;
    styleSuggestion?: any;
  };
}
```

## 环境配置

### 1. Vercel KV 设置
1. 在 Vercel Dashboard 中创建 KV 数据库
2. 获取连接信息并添加到环境变量：
```bash
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

### 2. Vercel Blob 设置
1. 在 Vercel Dashboard 中启用 Blob Storage
2. 获取连接信息并添加到环境变量：
```bash
BLOB_READ_WRITE_TOKEN=...
```

### 3. 本地开发环境
```bash
# 复制环境变量文件
cp .env.example .env.local

# 添加 Vercel 存储凭据
# 可以从 Vercel Dashboard 获取
```

## API 端点

### GET /api/looks
获取用户的所有造型数据
```typescript
// 请求参数
{
  userId?: string;  // 默认 'default'
  limit?: number;   // 默认 50
}

// 响应
{
  success: boolean;
  looks: PastLook[];
  count: number;
}
```

### POST /api/looks
保存新的造型数据
```typescript
// 请求体
{
  look: PastLook;
  userId?: string;  // 默认 'default'
}

// 响应
{
  success: boolean;
  message: string;
}
```

### DELETE /api/looks
删除造型数据
```typescript
// 查询参数
{
  lookId?: string;    // 删除单个
  clearAll?: boolean; // 清空所有
  userId?: string;    // 默认 'default'
}

// 响应
{
  success: boolean;
  message: string;
}
```

### POST /api/looks/migrate
迁移数据从 localStorage 到数据库
```typescript
// 请求体
{
  looks: PastLook[];
  userId?: string;  // 默认 'default'
}

// 响应
{
  success: boolean;
  message: string;
  successCount: number;
  failureCount: number;
  errors?: string[];
}
```

## 核心功能

### 1. 自动迁移
- 页面加载时自动检测 localStorage 数据
- 如果数据库为空且 localStorage 有数据，自动触发迁移
- 迁移成功后清空 localStorage

### 2. 图片处理
- Base64 图片自动上传到 Blob 存储
- 本地路径图片（/public/...）直接引用
- 外部 URL 图片保持原样

### 3. 错误处理
- 数据库操作失败时回退到 localStorage
- 网络错误时使用本地缓存
- 详细的错误日志和用户提示

### 4. 数据一致性
- 去重处理（相同 ID 的记录）
- 时间戳排序（最新的在前）
- 数据验证和清理

## 使用指南

### 1. 开发环境测试
访问 `/test-migration` 页面进行功能测试：
- 生成测试数据
- 测试迁移功能
- 验证 API 响应

### 2. 生产环境部署
1. 确保 Vercel KV 和 Blob 已正确配置
2. 部署应用到 Vercel
3. 验证环境变量已正确设置
4. 测试数据库连接

### 3. 用户迁移
用户首次访问时会自动触发迁移，也可以：
- 访问 `/settings` 页面
- 使用迁移工具手动迁移
- 查看迁移状态和结果

## 监控和维护

### 1. 数据库监控
- 使用 Vercel Dashboard 监控 KV 使用情况
- 监控 Blob 存储大小和请求量
- 设置告警阈值

### 2. 性能优化
- 批量操作减少 API 调用
- 图片压缩和优化
- 缓存策略优化

### 3. 数据备份
- 定期导出重要数据
- 实现数据恢复机制
- 版本控制和回滚

## 故障排除

### 常见问题

#### 1. 迁移失败
```bash
# 检查环境变量
echo $KV_URL
echo $BLOB_READ_WRITE_TOKEN

# 检查网络连接
curl -I https://your-app.vercel.app/api/looks

# 查看详细错误日志
```

#### 2. 图片上传失败
- 检查 Blob 存储配置
- 验证图片格式和大小
- 检查网络连接

#### 3. 数据不同步
- 清空浏览器缓存
- 重新触发迁移
- 检查数据库连接

### 调试工具
- 浏览器开发者工具 Console
- Vercel 函数日志
- 数据库查询工具

## 安全考虑

### 1. 数据隐私
- 用户数据隔离（userId）
- 图片访问权限控制
- 敏感信息加密

### 2. API 安全
- 请求频率限制
- 输入验证和清理
- 错误信息脱敏

### 3. 存储安全
- Blob 存储访问控制
- KV 数据加密
- 定期安全审计

## 未来规划

### 1. 用户系统
- 实现真实的用户认证
- 多用户数据隔离
- 用户权限管理

### 2. 高级功能
- 数据分析和统计
- 智能推荐系统
- 社交分享功能

### 3. 性能优化
- CDN 集成
- 图片懒加载
- 数据预加载

## 总结

这个数据库迁移系统提供了：
- ✅ 无缝的 localStorage 到云端数据库迁移
- ✅ 可靠的错误处理和回退机制
- ✅ 高效的图片存储和管理
- ✅ 用户友好的迁移工具
- ✅ 完整的 API 和文档

通过这个系统，用户的造型数据将得到更好的保护和管理，不再受到浏览器存储限制的约束。