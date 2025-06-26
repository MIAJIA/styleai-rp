# 部署指南

## 环境变量配置

### 本地开发环境
创建 `.env.local` 文件并添加以下变量：

\`\`\`bash
# Vercel KV (Redis) Database
# 从 Vercel Dashboard > Storage > KV 获取
KV_URL=redis://your-kv-url
KV_REST_API_URL=https://your-kv-rest-api-url
KV_REST_API_TOKEN=your-kv-rest-api-token
KV_REST_API_READ_ONLY_TOKEN=your-kv-read-only-token

# Vercel Blob Storage
# 从 Vercel Dashboard > Storage > Blob 获取
BLOB_READ_WRITE_TOKEN=your-blob-read-write-token

# AI API Keys
OPENAI_API_KEY=your-openai-api-key
KLING_AI_ACCESS_KEY=your-kling-access-key
KLING_AI_SECRET_KEY=your-kling-secret-key
RAPIDAPI_KEY=your-rapidapi-key-for-face-swap
\`\`\`

### 生产环境 (Vercel)
1. 在 Vercel Dashboard 中进入项目设置
2. 转到 "Environment Variables" 选项卡
3. 添加上述所有环境变量

## 存储服务设置

### 1. Vercel KV 设置
1. 登录 Vercel Dashboard
2. 进入项目页面
3. 点击 "Storage" 选项卡
4. 点击 "Create Database" > "KV"
5. 输入数据库名称（如 `styleai-kv`）
6. 选择地区（建议选择离用户最近的地区）
7. 点击 "Create"
8. 复制生成的环境变量到项目设置中

### 2. Vercel Blob 设置
1. 在同一个 "Storage" 页面
2. 点击 "Create Database" > "Blob"
3. 输入存储名称（如 `styleai-blob`）
4. 点击 "Create"
5. 复制生成的环境变量到项目设置中

## 部署步骤

### 1. 代码部署
\`\`\`bash
# 推送代码到 Git 仓库
git add .
git commit -m "Add database migration system"
git push origin main

# 或者直接从 Vercel Dashboard 导入 Git 仓库
\`\`\`

### 2. 验证部署
1. 访问部署的应用
2. 检查控制台是否有错误
3. 测试数据库连接：访问 `/test-migration`
4. 验证 API 端点：
   - `GET /api/looks`
   - `POST /api/looks/migrate`

### 3. 监控设置
1. 在 Vercel Dashboard 中设置函数监控
2. 配置错误通知
3. 设置存储使用量告警

## 测试清单

### 功能测试
- [ ] 生成测试数据
- [ ] 测试数据库保存
- [ ] 测试数据库读取
- [ ] 测试数据迁移
- [ ] 测试图片上传
- [ ] 测试错误处理

### 性能测试
- [ ] 大量数据加载速度
- [ ] 图片上传速度
- [ ] API 响应时间
- [ ] 并发请求处理

### 安全测试
- [ ] 数据隔离验证
- [ ] API 访问控制
- [ ] 输入验证测试

## 故障排除

### 常见部署问题

#### 1. 环境变量未设置
\`\`\`bash
Error: KV_URL is not defined
\`\`\`
**解决方案**: 检查 Vercel 项目设置中的环境变量配置

#### 2. KV 连接失败
\`\`\`bash
Error: Failed to connect to KV database
\`\`\`
**解决方案**:
- 验证 KV 数据库是否已创建
- 检查环境变量值是否正确
- 确认项目已连接到正确的 KV 实例

#### 3. Blob 上传失败
\`\`\`bash
Error: Failed to upload to blob storage
\`\`\`
**解决方案**:
- 检查 BLOB_READ_WRITE_TOKEN 是否正确
- 验证 Blob 存储是否已启用
- 检查文件大小是否超过限制

#### 4. 迁移失败
\`\`\`bash
Migration failed: Invalid look data
\`\`\`
**解决方案**:
- 检查 localStorage 数据格式
- 验证必需字段是否存在
- 查看详细错误日志

#### 5. 生成超时问题 ⭐ 新增
\`\`\`bash
Error [AbortError]: This operation was aborted
\`\`\`
**解决方案**:
- 检查 `vercel.json` 配置是否正确部署
- 验证所有 AI API 密钥是否配置正确
- 监控 Vercel 函数执行日志
- 如果问题持续，可以尝试重新生成

**超时问题详细排查**:
1. **Face Swap 超时**: 最常见的超时原因
   - 现已增加到 3 分钟超时
   - 添加了自动重试机制
   - 如果仍然失败，可能是 RapidAPI 服务问题

2. **Kling AI 超时**: 图像生成或虚拟试穿超时
   - 轮询时间已优化到 5 分钟总时长
   - 检查 KLING_AI_ACCESS_KEY 和 KLING_AI_SECRET_KEY
   - 确认 Kling AI 账户余额充足

3. **文件下载超时**: 图片 URL 访问失败
   - 增加了重试机制
   - 检查网络连接
   - 验证图片 URL 是否有效

#### 6. Blob 存储冲突 ⭐ 新增
\`\`\`bash
Error: Vercel Blob: This blob already exists
\`\`\`
**解决方案**:
- 系统现已自动处理文件名冲突
- 使用 `addRandomSuffix: true` 生成唯一文件名
- 重复保存同一造型会被自动跳过
- 不影响用户体验，后台自动处理

**冲突处理机制**:
1. **自动去重**: 保存前检查是否已存在相同 ID 的造型
2. **文件名唯一化**: 所有上传的图片都添加随机后缀
3. **优雅降级**: 数据库失败时自动回退到 localStorage
4. **错误恢复**: 重复操作不会导致系统错误

#### 7. Redis Null 值错误 ⭐ 新增修复
\`\`\`bash
Error [UpstashError]: Command failed: ERR null args are not supported
\`\`\`
**问题原因**:
- Vercel KV (Redis) 不支持 `null` 或 `undefined` 值
- 数据库保存时包含了这些不支持的值

**解决方案**:
- 实现了自动数据清理功能
- 保存前过滤掉所有 `null` 和 `undefined` 值
- 递归清理嵌套对象和数组
- 保留空字符串和数字 0 等有效值

**修复详情**:
1. **数据清理函数**: `cleanObjectForRedis()` 递归清理对象
2. **自动过滤**: 保存前自动清理不支持的值
3. **保持完整性**: 不影响有效数据的存储
4. **错误恢复**: 清理失败时提供明确的错误信息

## 监控和维护

### 1. 日志监控
- 使用 Vercel 函数日志查看错误
- 设置 Sentry 或其他错误追踪服务
- 监控 API 响应时间和成功率

### 2. 存储监控
- 定期检查 KV 数据库使用量
- 监控 Blob 存储大小和请求数
- 设置使用量告警

### 3. 性能优化
- 启用 Vercel Edge Functions（如果适用）
- 配置 CDN 缓存策略
- 优化图片压缩和格式

## 扩展计划

### 短期优化
- 添加数据压缩
- 实现批量操作
- 增加缓存层

### 长期规划
- 用户认证系统
- 多地区部署
- 数据分析功能

## 成本估算

### Vercel KV
- 免费额度：1GB 存储，100万次请求/月
- 付费计划：$20/月起

### Vercel Blob
- 免费额度：1GB 存储，1万次请求/月
- 付费计划：$20/月起

### 建议
- 开发阶段使用免费额度
- 生产环境根据实际使用量选择合适计划
- 定期监控使用量避免超额费用

## 函数超时配置

### Vercel 函数超时设置
项目包含 `vercel.json` 配置文件，设置了以下超时限制：

\`\`\`json
{
  "functions": {
    "app/api/generation/status/route.ts": {
      "maxDuration": 300
    },
    "app/api/generation/start/route.ts": {
      "maxDuration": 60
    },
    "app/api/generate/route.ts": {
      "maxDuration": 300
    },
    "app/api/generate-style/route.ts": {
      "maxDuration": 300
    }
  }
}
\`\`\`

### 超时处理改进
- **Face Swap API**: 超时从 90 秒增加到 180 秒，添加重试机制
- **Kling API**: 轮询间隔从 3 秒增加到 5 秒，最大尝试次数从 40 增加到 60
- **文件下载**: 超时从 60 秒增加到 120 秒，添加重试机制
- **网络请求**: 所有关键 API 调用都有指数退避重试策略
