# 图片信息保存优化指南

## 📋 概述

优化后的聊天 API 现在可以完整保存用户上传的图片信息和 AI 生成的图片信息，包括详细的元数据。

## 🎯 核心功能

### 1. 增强的数据结构

#### ImageInfo 接口
```typescript
interface ImageInfo {
    url: string;                    // 图片 URL
    type: 'uploaded' | 'generated'; // 图片类型：用户上传或 AI 生成
    mimeType?: string;              // MIME 类型，如 'image/jpeg'
    name?: string;                  // 图片名称
    generatedPrompt?: string;       // AI 生成图片时使用的提示词
}
```

#### ChatMessage 接口
```typescript
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
    images?: ImageInfo[];           // 图片信息数组
    metadata?: {                    // 用户元数据
        bodyShape?: string;
        skincolor?: string;
        bodySize?: string;
        stylePreference?: string;
    };
}
```

## 🔧 API 使用方法

### 1. POST - 发送聊天消息（自动保存图片）

```typescript
// 请求
POST /api/apple/chat
{
    "userId": "user123",
    "message": "帮我设计一套搭配",
    "imageUrl": [
        "https://example.com/user-photo.jpg",
        "https://example.com/garment.jpg"
    ],
    "sessionId": "session123",
    "bodyShape": "hourglass",
    "skincolor": "fair",
    "bodySize": "medium",
    "stylePreference": "casual"
}

// 响应
{
    "success": true,
    "message": {
        "text": "AI 回复内容..."
    },
    "sessionId": "session123"
}
```

**自动保存内容：**
- ✅ 用户上传的所有图片 URL
- ✅ 图片类型标记为 'uploaded'
- ✅ 用户的体型、肤色等元数据
- ✅ AI 响应中包含的图片链接（标记为 'generated'）

### 2. GET - 获取聊天历史和图片统计

#### 基础查询（包含图片统计）
```typescript
GET /api/apple/chat?sessionId=session123

// 响应
{
    "success": true,
    "messages": [...],
    "sessionId": "session123",
    "imageStats": {
        "total": 15,      // 总图片数
        "uploaded": 10,   // 用户上传的图片数
        "generated": 5    // AI 生成的图片数
    }
}
```

#### 包含完整图片列表
```typescript
GET /api/apple/chat?sessionId=session123&includeImages=true

// 响应
{
    "success": true,
    "messages": [...],
    "sessionId": "session123",
    "imageStats": {
        "total": 15,
        "uploaded": 10,
        "generated": 5
    },
    "allImages": [
        {
            "url": "https://example.com/image1.jpg",
            "type": "uploaded",
            "mimeType": "image/jpeg",
            "name": "Image 1"
        },
        {
            "url": "https://example.com/generated1.jpg",
            "type": "generated",
            "name": "Generated Image 1",
            "generatedPrompt": "帮我设计一套搭配"
        }
        // ...
    ]
}
```

#### 仅获取图片信息
```typescript
GET /api/apple/chat?sessionId=session123&imagesOnly=true

// 响应
{
    "success": true,
    "images": [...],
    "stats": {
        "total": 15,
        "uploaded": 10,
        "generated": 5
    },
    "sessionId": "session123"
}
```

### 3. DELETE - 清除聊天历史（包括图片信息）

```typescript
DELETE /api/apple/chat?sessionId=session123

// 响应
{
    "success": true,
    "message": "Chat history cleared successfully"
}
```

## 📊 数据存储说明

### Redis 键结构

1. **单条消息：** `chat:message:{sessionId}:{timestamp}`
   - 存储完整的 ChatMessage 对象（包含图片信息）

2. **消息列表：** `chat:messages:{sessionId}`
   - 存储消息键的有序列表
   - 自动限制最近 100 条消息

### 数据示例

```json
{
    "role": "user",
    "content": "帮我设计一套搭配",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "images": [
        {
            "url": "https://example.com/user-photo.jpg",
            "type": "uploaded",
            "mimeType": "image/jpeg",
            "name": "Image 1"
        }
    ],
    "metadata": {
        "bodyShape": "hourglass",
        "skincolor": "fair",
        "bodySize": "medium",
        "stylePreference": "casual"
    }
}
```

## 🎨 使用场景

### 场景 1：追踪用户上传的服装图片
```typescript
// 用户上传了多张服装图片
const response = await fetch('/api/apple/chat?sessionId=session123&imagesOnly=true');
const data = await response.json();

// 筛选所有用户上传的图片
const uploadedImages = data.images.filter(img => img.type === 'uploaded');
console.log(`用户上传了 ${uploadedImages.length} 张图片`);
```

### 场景 2：展示 AI 生成的搭配图片
```typescript
// 获取所有 AI 生成的图片
const response = await fetch('/api/apple/chat?sessionId=session123&includeImages=true');
const data = await response.json();

const generatedImages = data.allImages.filter(img => img.type === 'generated');
generatedImages.forEach(img => {
    console.log(`AI 基于提示词 "${img.generatedPrompt}" 生成了: ${img.url}`);
});
```

### 场景 3：统计会话图片使用情况
```typescript
const response = await fetch('/api/apple/chat?sessionId=session123');
const data = await response.json();

console.log(`
会话图片统计:
- 总计: ${data.imageStats.total} 张
- 用户上传: ${data.imageStats.uploaded} 张
- AI 生成: ${data.imageStats.generated} 张
`);
```

## ⚙️ 配置选项

### 自动提取 AI 生成的图片
系统会自动从 AI 响应中提取图片 URL（支持格式：jpg, jpeg, png, gif, webp）

如果你的 AI 返回格式不同，可以修改正则表达式：
```typescript
// 在 route.ts 中修改
const imageUrlPattern = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)/gi;
```

### 消息历史限制
- 默认保留最近 **100 条**消息
- 可在 `saveChatMessage` 函数中修改：
```typescript
await kv.ltrim(messagesListKey, 0, 99); // 修改为你需要的数量
```

## 🔍 调试和日志

启用详细日志以跟踪图片保存：
```typescript
console.log(`[Chat API] Saving user message with ${uploadedImages.length} uploaded image(s)`);
console.log(`[Chat API] Saving assistant message with ${generatedImages.length} generated image(s)`);
```

## 📝 最佳实践

1. **定期清理旧数据**：使用 DELETE endpoint 清理不再需要的会话
2. **图片 URL 验证**：确保上传的图片 URL 可访问
3. **元数据完整性**：始终提供完整的用户元数据以便后续分析
4. **错误处理**：图片提取失败不会影响聊天功能的正常运行

## 🚀 性能优化

- 图片信息与聊天消息一起存储，无需额外查询
- 使用 Redis List 和 Hash 结构优化读写性能
- 自动限制历史消息数量防止存储溢出
- 异步保存不阻塞主流程

## 📌 注意事项

1. 图片 URL 应该是永久链接，避免失效
2. 生成的图片 URL 提取依赖 AI 响应格式
3. 系统自动处理图片保存失败的情况
4. 建议定期备份重要的图片信息

