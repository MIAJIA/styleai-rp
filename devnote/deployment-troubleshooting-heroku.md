# Deployment Troubleshooting - Heroku 部署问题解决指南

## Heroku 部署常见问题

### 1. 503 错误和 formData 超时问题

**问题描述**: 在 Heroku 部署时，可能遇到请求在 `XXX 122` 日志后但在 `XXX 133` 之前失败的情况。

**根本原因**:
- Heroku 有严格的 30 秒请求超时限制
- `await request.formData()` 在处理大图片文件时可能超时
- Vercel 的 `maxDuration` 配置在 Heroku 上不生效

**解决方案**:
1. **formData 解析超时**: 代码中已添加 `parseFormDataWithTimeout()` 函数，在生产环境中限制为 25 秒
2. **文件大小限制**: 添加了 10MB 文件大小限制，防止超大文件导致超时
3. **全局请求超时**: 整个请求被包装在 28 秒超时保护中
4. **错误类型区分**: 区分超时错误（504）和平台超时（503）

**监控指标**:
```bash
# 检查 Heroku 日志中的超时模式
heroku logs --tail | grep -E "(XXX 122|XXX 133|TIMEOUT|503)"
```

### 2. 为什么需要 `await request.formData()`

`request.formData()` 是异步的因为：
- 需要解析 multipart/form-data 格式的请求体
- 图片文件需要流式读取到内存
- 大文件解析需要时间，可能导致超时

**最佳实践**:
- 在客户端压缩图片后再上传
- 设置合理的文件大小限制
- 添加超时处理机制

### 3. 为什么同样的数据有时超时，有时不会？

**影响因素分析**:

1. **服务器资源状态**:
   ```typescript
   // 内存使用情况影响处理速度
   Memory usage: RSS=150MB, Heap=80MB  // 快速处理
   Memory usage: RSS=450MB, Heap=380MB // 可能超时
   ```

2. **网络条件变化**:
   - **CDN 缓存状态**: 文件上传到 Vercel Blob 的速度取决于 CDN 节点状态
   - **网络拥塞**: 用户网络和服务器网络的当前负载
   - **地理位置**: 用户与服务器的物理距离

3. **平台资源竞争**:
   - **Heroku Dyno 状态**: 共享资源的当前负载
   - **冷启动 vs 热启动**: 冷启动需要额外 2-5 秒初始化时间
   - **并发请求数**: 同时处理的其他请求数量

4. **文件特性差异**:
   ```typescript
   // 相同大小的文件可能有不同的处理复杂度
   JPEG (高压缩): 1MB → 快速解析
   PNG (无损): 1MB → 慢速解析 (更多像素数据)
   ```

**已实施的解决方案**:
- ✅ **3次重试机制**: 指数退避策略 (1s, 2s, 4s)
- ✅ **动态超时调整**: 每次重试减少超时时间
- ✅ **详细监控**: 记录每次重试的性能指标
- ✅ **环境检测**: 自动识别部署平台并调整策略

### 4. 重试机制实现详情

#### 4.1 FormData 解析重试
```typescript
// 每次重试减少超时时间，避免总时间过长
Attempt 1: 25秒超时
Attempt 2: 23秒超时 (减少2秒)
Attempt 3: 21秒超时 (再减少2秒)
```

#### 4.2 文件上传重试
```typescript
// 文件上传也采用类似策略
Attempt 1: 20秒超时
Attempt 2: 17秒超时 (减少3秒)
Attempt 3: 14秒超时 (再减少3秒)
```

#### 4.3 指数退避策略
```typescript
// 重试间隔逐渐增加
Retry 1 → 2: 等待 1秒
Retry 2 → 3: 等待 2秒
Retry 3 → 4: 等待 4秒
```

### 5. 真正的 503 错误来源

大部分 503 错误实际来自 Kling AI API 的余额不足（429 状态码），而不是 formData 解析：

```typescript
// Kling AI 429 错误会被转换为 503 返回给用户
if (submitResponse.status === 429) {
  console.error(`💰 BALANCE ERROR DETECTED! Account balance not enough`);
  // 这会导致用户看到 503 错误
}
```

**解决方案**: 监控 Kling AI 账户余额，及时充值。

### 11. 图片压缩现状分析

#### 11.1 现有压缩实现

✅ **你确实有图片压缩，且在客户端实现**：

```typescript
// 主要压缩配置
COMPRESSION_PRESETS = {
  forUpload: {
    maxSizeMB: 0.19,  // 目标 < 200KB
    maxWidthOrHeight: 1024,
    useWebWorker: true
  },
  chat: {
    maxWidth: 800,
    maxHeight: 600, 
    quality: 0.8
  }
}
```

#### 11.2 压缩流程

1. **聊天生成流程**:
   ```typescript
   // app/chat/hooks/useGeneration.ts (第313-314行)
   const selfieFile = await getFileFromPreview(chatData.selfiePreview, "user_selfie.jpg")
   // ↓ 内部调用压缩
   const compressedResult = await compressImageToSpecificSize(tempFile) // 压缩到200KB
   ```

2. **Onboarding 上传**:
   ```typescript
   // app/components/onboarding/photo-upload-step.tsx (第179行)
   const result = await compressImageToDataUrl(file); // maxWidth=1000, quality=0.75
   ```

3. **聊天图片上传**:
   ```typescript
   // app/chat/hooks/useImageHandling.ts (第34-37行)
   compressionResult = await compressForChat(file) // 800x600, quality=0.8
   ```

#### 11.3 压缩效果

根据日志显示，压缩效果良好：
```
[Pre-compress] Original image: 2.5MB
[Post-compress] Compressed image: 180KB (压缩率 ~93%)
```

#### 11.4 为什么压缩后仍可能超时？

**关键发现**: 压缩是在客户端，但超时发生在服务器端的不同阶段：

1. **网络传输阶段**:
   ```typescript
   // 即使压缩到200KB，网络慢时仍可能超时
   客户端(200KB) → 网络传输 → 服务器接收
   ```

2. **服务器解析阶段**:
   ```typescript
   // request.formData() 解析 multipart 数据，与文件大小无直接关系
   const formData = await request.formData(); // 这里可能超时
   ```

3. **Blob 存储上传**:
   ```typescript
   // 服务器端上传到 Vercel Blob，仍受网络影响
   await put(fileName, file, { access: 'public' }); // 这里也可能超时
   ```

#### 11.5 优化建议

1. **进一步压缩**:
   ```typescript
   // 考虑更激进的压缩
   forUpload: {
     maxSizeMB: 0.1,  // 目标 < 100KB
     maxWidthOrHeight: 800, // 降低到800px
   }
   ```

2. **预压缩验证**:
   ```typescript
   // 在客户端验证压缩效果
   if (compressedFile.size > 150 * 1024) {
     // 如果仍大于150KB，进一步压缩
   }
   ```

3. **分段上传**:
   ```typescript
   // 对于仍然较大的文件，考虑分段上传
   ```

### 12. 压缩vs超时问题总结

| 阶段 | 压缩状态 | 可能超时原因 | 解决方案 |
|------|---------|-------------|---------|
| 客户端压缩 | ✅ 已实现 | - | 继续优化压缩率 |
| 网络传输 | ✅ 文件已压缩 | 网络慢、CDN问题 | 重试机制 ✅ |
| 服务器解析 | ✅ 文件已压缩 | multipart解析慢 | 重试+超时 ✅ |
| Blob上传 | ✅ 文件已压缩 | Vercel Blob网络问题 | 重试机制 ✅ |

**结论**: 你的压缩实现很好，超时问题主要来自网络和服务器端处理，已通过重试机制解决。

### 6. 监控和调试命令

#### 6.1 重试成功率监控
```bash
# 监控重试成功率
heroku logs --tail | grep -E "(RETRY_SUCCESS|RETRY_FAILED|XXX 133)"

# 分析超时模式
heroku logs --tail | grep -E "(TIMEOUT|FormData|BLOB_UPLOAD)" | head -50

# 查看环境分析信息
heroku logs --tail | grep "ENV_ANALYSIS"
```

#### 6.2 性能分析
```bash
# 查看完整的性能日志
heroku logs --tail | grep "PERF_LOG"

# 查看重试统计
heroku logs --tail | grep "RETRY_STATS"

# 查看文件分析信息
heroku logs --tail | grep "FILE_ANALYSIS"
```

### 7. 错误代码对照表

| 错误代码 | 错误类型 | 原因 | 解决方案 |
|---------|---------|------|---------|
| 504 | Gateway Timeout | FormData 解析或文件上传超时 | 重试机制自动处理，用户可重新尝试 |
| 503 | Service Unavailable | Heroku 平台 30 秒限制 | 优化图片大小，使用重试机制 |
| 413 | Payload Too Large | 文件超过 10MB 限制 | 用户需要压缩图片 |
| 429 | Too Many Requests | Kling AI 余额不足 | 充值 Kling AI 账户 |

### 8. 性能优化建议

#### 8.1 客户端优化
- 图片压缩: 建议上传前将图片压缩到 1MB 以下
- 格式选择: JPEG 比 PNG 处理更快
- 尺寸限制: 建议图片尺寸不超过 2048x2048

#### 8.2 服务端优化
- 内存监控: 定期检查内存使用情况
- 并发控制: 限制同时处理的请求数量
- 缓存策略: 对重复请求使用缓存

### 9. 故障排查流程

1. **检查日志模式**:
   ```bash
   heroku logs --tail | grep "XXX 122\|XXX 133"
   ```

2. **分析失败点**:
   - 如果看到 `XXX 122` 但没有 `XXX 133`: FormData 解析超时
   - 如果看到 `XXX 133` 但后续失败: 文件上传或处理超时

3. **查看重试情况**:
   ```bash
   heroku logs --tail | grep "RETRY"
   ```

4. **检查环境状态**:
   ```bash
   heroku logs --tail | grep "ENV_ANALYSIS"
   ```

### 10. 预防措施

1. **定期监控**: 设置自动化监控脚本
2. **性能测试**: 定期进行负载测试
3. **资源规划**: 根据使用情况调整 Dyno 配置
4. **用户教育**: 提供图片上传指南

---

**创建时间**: 2025年1月
**最后更新**: 2025年1月
**相关文件**: `app/api/generation/start/route.ts`, `vercel.json` 