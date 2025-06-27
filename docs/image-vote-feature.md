# 图片投票功能文档

## 🎯 功能概述

图片投票功能允许用户对看到的每张图片进行upvote（👍）或downvote（👎）操作。这个功能设计简洁，不包含计数功能，主要用于收集用户对图片的偏好数据。

## ✨ 核心特性

- ✅ **简单投票** - 只有👍和👎两种选择
- ✅ **状态持久化** - 投票状态保存在数据库中
- ✅ **可撤销投票** - 点击已选择的按钮可取消投票
- ✅ **无需登录** - 基于sessionId跟踪，无需用户账户
- ✅ **多端同步** - 同一session的投票状态在不同页面保持一致
- ✅ **响应式设计** - 支持不同尺寸和样式变体

## 🏗️ 技术架构

### 数据存储

- **存储方案**: Vercel KV (Redis)
- **数据结构**: 键值对存储，key为图片URL的hash值
- **数据格式**: JSON格式存储投票信息

### 组件架构

```
ImageVoteButtons (主组件)
├── API调用 (/api/image-vote)
├── 状态管理 (React hooks)
└── UI渲染 (Tailwind CSS)
```

## 📁 文件结构

```
lib/
├── image-vote.ts              # 核心业务逻辑
app/
├── api/image-vote/route.ts    # API端点
components/
├── image-vote-buttons.tsx     # 投票按钮组件
app/
├── chat/page.tsx             # 聊天页面集成
├── results/page.tsx          # 结果页面集成
├── result/page.tsx           # 单个结果页面集成
├── components/image-modal.tsx # 图片模态框集成

```

## 🔧 API接口

### POST /api/image-vote

保存或更新图片投票

**请求体:**

```json
{
  "imageUrl": "https://example.com/image.jpg",
  "voteType": "upvote" | "downvote" | null,
  "sessionId": "optional-session-id"
}
```

**响应:**

```json
{
  "success": true,
  "message": "Image upvoted successfully"
}
```

### GET /api/image-vote

获取图片投票状态

**查询参数:**

- `imageUrl`: 单张图片URL
- `imageUrls`: 多张图片URL的JSON数组

**响应:**

```json
{
  "success": true,
  "vote": {
    "imageUrl": "https://example.com/image.jpg",
    "voteType": "upvote",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "sessionId": "session-123"
  }
}
```

### DELETE /api/image-vote

移除图片投票

**请求体:**

```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

## 🎨 组件使用

### 基础用法

```tsx
import ImageVoteButtons from '@/components/image-vote-buttons';

<ImageVoteButtons
  imageUrl="https://example.com/image.jpg"
  sessionId="user-session-123"
/>
```

### 完整配置

```tsx
<ImageVoteButtons
  imageUrl="https://example.com/image.jpg"
  sessionId="user-session-123"
  size="md"                    // 'sm' | 'md' | 'lg'
  variant="default"            // 'default' | 'overlay' | 'minimal'
  className="custom-class"
  onVoteChange={(voteType) => {
    console.log('Vote changed:', voteType);
  }}
/>
```

### 样式变体

#### 1. Default (默认)

- 白色背景，灰色边框
- 适用于普通页面内容

#### 2. Overlay (覆盖层)

- 半透明黑色背景
- 适用于图片上的悬浮按钮

#### 3. Minimal (极简)

- 透明背景，无边框
- 适用于紧凑布局

### 尺寸选项

| 尺寸 | 按钮大小 | 图标大小 | 间距 |
|------|----------|----------|------|
| sm   | 28px     | 12px     | 4px  |
| md   | 32px     | 16px     | 8px  |
| lg   | 40px     | 20px     | 12px |

## 🔄 集成示例

### 1. 聊天页面集成

```tsx
// 在ChatBubble组件中
{message.imageUrl && (
  <div className="relative group">
    <img src={message.imageUrl} alt="Generated image" />

    {isAI && (
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
        <ImageVoteButtons
          imageUrl={message.imageUrl}
          sessionId={sessionId}
          size="sm"
          variant="overlay"
        />
      </div>
    )}
  </div>
)}
```

### 2. 结果页面集成

```tsx
// 在results页面中
<div className="relative group">
  <img src={pastLook.imageUrl} alt="Generated look" />

  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100">
    <ImageVoteButtons
      imageUrl={pastLook.imageUrl}
      size="sm"
      variant="overlay"
    />
  </div>
</div>
```

### 3. 模态框集成

```tsx
// 在ImageModal组件中
<div className="p-4">
  <div className="flex justify-center mb-4">
    <ImageVoteButtons
      imageUrl={imageUrl}
      sessionId={sessionId}
      size="md"
      variant="default"
    />
  </div>

  {/* 其他操作按钮 */}
</div>
```

## 🗄️ 数据结构

### ImageVote接口

```typescript
interface ImageVote {
  imageUrl: string;
  voteType: 'upvote' | 'downvote' | null;
  timestamp: Date;
  sessionId?: string;
}
```

### 存储键格式

- **键**: `image_vote:${imageId}`
- **值**: JSON字符串格式的ImageVote对象
- **imageId**: 基于imageUrl的hash值

## 🧪 测试

### 测试页面

访问 `/test-vote` 页面进行功能测试：

- 测试不同尺寸和样式的投票按钮
- 验证投票状态的持久化
- 测试批量投票状态加载
- 验证投票撤销功能

### 测试用例

1. **基础投票** - 点击upvote/downvote按钮
2. **投票切换** - 从upvote切换到downvote
3. **投票撤销** - 点击已选择的按钮取消投票
4. **状态持久化** - 刷新页面后投票状态保持
5. **批量加载** - 同时加载多张图片的投票状态

## 🔍 调试

### 开发者工具

组件会在控制台输出详细的调试信息：

```
[ImageVoteButtons] Vote changed: upvote for image123
[ChatBubble] Image vote changed: downvote for https://...
[Results] Image vote changed: null for look456
```

### 数据库查看

在Vercel KV控制台中查看存储的投票数据：

```
Key: image_vote:123456789
Value: {"imageUrl":"https://...","voteType":"upvote","timestamp":"..."}
```

## 🚀 部署注意事项

### 环境变量

确保以下环境变量已配置：

```bash
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

### 性能优化

- 投票状态在组件初始化时自动加载
- 使用防抖机制避免频繁API调用
- 批量查询优化多图片页面性能

## 🔮 未来扩展

### 可能的功能增强

1. **投票统计** - 添加投票计数功能
2. **用户画像** - 基于投票行为分析用户偏好
3. **推荐算法** - 利用投票数据改进图片推荐
4. **A/B测试** - 测试不同投票UI的效果
5. **数据导出** - 导出投票数据用于分析

### 技术改进

1. **缓存优化** - 添加本地缓存减少API调用
2. **离线支持** - 支持离线投票，联网后同步
3. **实时更新** - WebSocket实时同步投票状态
4. **数据分析** - 集成分析工具追踪投票趋势

---

## 📝 更新日志

### v1.0.0 (2024-01-01)

- ✅ 初始版本发布
- ✅ 基础投票功能
- ✅ 三种样式变体
- ✅ 完整API接口
- ✅ 多页面集成
- ✅ 测试页面

---

**注意**: 这是一个基础版本的投票功能，专注于简单易用。如需更复杂的功能（如投票统计、用户系统等），可以在此基础上进行扩展。
