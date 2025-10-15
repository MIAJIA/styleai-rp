# 多图片聊天 API 使用指南

## 概述

聊天 API 现在支持在一次请求中发送多张图片，每张图片可以有自己的名称和 MIME 类型。

## API 端点

```
POST /api/apple/chat
```

## 支持的格式

### 方式 1: 推荐格式 - 带完整元数据的图片数组

使用 `images` 字段，每张图片可以指定名称和 MIME 类型。

```typescript
interface ImageInput {
    url: string;       // 图片 URL（必需）
    name?: string;     // 图片名称（可选，默认：图片1.jpg, 图片2.jpg...）
    mimeType?: string; // MIME 类型（可选，默认：image/jpeg）
}
```

**请求示例：**

```json
{
    "userId": "user-123",
    "message": "请帮我分析这两张图片中的服装风格",
    "sessionId": "session-456",
    "images": [
        {
            "url": "https://example.com/photo1.jpg",
            "name": "全身照",
            "mimeType": "image/jpeg"
        },
        {
            "url": "https://example.com/photo2.jpg",
            "name": "细节照",
            "mimeType": "image/jpeg"
        }
    ]
}
```

### 方式 2: 简化格式 - URL 数组

使用 `imageUrl` 字段，传入 URL 字符串数组。图片会自动命名为"图片1"、"图片2"等。

**请求示例：**

```json
{
    "userId": "user-123",
    "message": "请帮我分析这两张图片",
    "sessionId": "session-456",
    "imageUrl": [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg"
    ]
}
```

## JavaScript/TypeScript 使用示例

### 方式 1: 使用完整元数据

```typescript
async function chatWithMultipleImages(
    userId: string,
    message: string,
    images: Array<{ url: string; name?: string; mimeType?: string }>,
    sessionId?: string
) {
    const response = await fetch('/api/apple/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId,
            message,
            images,
            sessionId
        })
    });

    const result = await response.json();
    return result;
}

// 使用示例
const result = await chatWithMultipleImages(
    'user-123',
    '请比较这两张图片中的服装风格',
    [
        {
            url: 'https://example.com/outfit1.jpg',
            name: '休闲风格',
            mimeType: 'image/jpeg'
        },
        {
            url: 'https://example.com/outfit2.jpg',
            name: '商务风格',
            mimeType: 'image/jpeg'
        }
    ],
    'session-789'
);

console.log('AI 回复:', result.message.text);
```

### 方式 2: 使用简化格式

```typescript
async function chatWithImageUrls(
    userId: string,
    message: string,
    imageUrls: string[],
    sessionId?: string
) {
    const response = await fetch('/api/apple/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId,
            message,
            imageUrl: imageUrls, // 注意：字段名是 imageUrl
            sessionId
        })
    });

    const result = await response.json();
    return result;
}

// 使用示例
const result = await chatWithImageUrls(
    'user-123',
    '这两套服装哪个更适合面试？',
    [
        'https://example.com/outfit1.jpg',
        'https://example.com/outfit2.jpg'
    ],
    'session-789'
);
```

## iOS Swift 使用示例

### 方式 1: 完整元数据格式

```swift
struct ImageInput: Codable {
    let url: String
    let name: String?
    let mimeType: String?
}

struct ChatRequest: Codable {
    let userId: String
    let message: String
    let images: [ImageInput]?
    let sessionId: String?
}

func sendChatWithImages(
    userId: String,
    message: String,
    images: [ImageInput],
    sessionId: String?
) async throws -> ChatResponse {
    let url = URL(string: "https://your-api.com/api/apple/chat")!
    
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let chatRequest = ChatRequest(
        userId: userId,
        message: message,
        images: images,
        sessionId: sessionId
    )
    
    request.httpBody = try JSONEncoder().encode(chatRequest)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(ChatResponse.self, from: data)
    
    return response
}

// 使用示例
let images = [
    ImageInput(url: "https://example.com/photo1.jpg", name: "图片1", mimeType: "image/jpeg"),
    ImageInput(url: "https://example.com/photo2.jpg", name: "图片2", mimeType: "image/jpeg")
]

let response = try await sendChatWithImages(
    userId: "user-123",
    message: "请分析这两张图片",
    images: images,
    sessionId: "session-456"
)
```

### 方式 2: 简化 URL 数组格式

```swift
struct SimpleChatRequest: Codable {
    let userId: String
    let message: String
    let imageUrl: [String]?
    let sessionId: String?
}

func sendChatWithImageUrls(
    userId: String,
    message: String,
    imageUrls: [String],
    sessionId: String?
) async throws -> ChatResponse {
    let url = URL(string: "https://your-api.com/api/apple/chat")!
    
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let chatRequest = SimpleChatRequest(
        userId: userId,
        message: message,
        imageUrl: imageUrls,
        sessionId: sessionId
    )
    
    request.httpBody = try JSONEncoder().encode(chatRequest)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(ChatResponse.self, from: data)
    
    return response
}

// 使用示例
let imageUrls = [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
]

let response = try await sendChatWithImageUrls(
    userId: "user-123",
    message: "请分析这两张图片",
    imageUrls: imageUrls,
    sessionId: "session-456"
)
```

## 常见场景示例

### 场景 1: 对比两套服装

```json
{
    "userId": "user-123",
    "message": "请帮我比较这两套服装，哪套更适合参加婚礼？",
    "images": [
        {
            "url": "https://blob.vercel-storage.com/outfit1.jpg",
            "name": "粉色连衣裙",
            "mimeType": "image/jpeg"
        },
        {
            "url": "https://blob.vercel-storage.com/outfit2.jpg",
            "name": "蓝色套装",
            "mimeType": "image/jpeg"
        }
    ],
    "sessionId": "wedding-consultation-001"
}
```

### 场景 2: 分析身材和服装搭配

```json
{
    "userId": "user-123",
    "message": "这是我的全身照和我想穿的衣服，请给我搭配建议",
    "images": [
        {
            "url": "https://blob.vercel-storage.com/body-photo.jpg",
            "name": "我的照片",
            "mimeType": "image/jpeg"
        },
        {
            "url": "https://blob.vercel-storage.com/target-outfit.jpg",
            "name": "目标服装",
            "mimeType": "image/jpeg"
        }
    ],
    "sessionId": "styling-session-456"
}
```

### 场景 3: 多角度查看同一套服装

```json
{
    "userId": "user-123",
    "message": "这是同一套衣服的不同角度，请评价整体效果",
    "images": [
        { "url": "https://example.com/front.jpg", "name": "正面" },
        { "url": "https://example.com/side.jpg", "name": "侧面" },
        { "url": "https://example.com/back.jpg", "name": "背面" }
    ]
}
```

## 响应格式

```json
{
    "success": true,
    "message": {
        "text": "根据您提供的两张图片...",
        "usageMetadata": {
            "promptTokenCount": 1234,
            "candidatesTokenCount": 567,
            "totalTokenCount": 1801
        }
    },
    "sessionId": "session-456"
}
```

## 重要提示

1. **图片顺序**：图片会按照数组顺序处理，确保重要的图片排在前面
2. **图片大小**：建议每张图片不超过 5MB，过大的图片会增加处理时间
3. **支持的格式**：支持 JPEG、PNG、WebP 等常见图片格式
4. **错误处理**：如果某张图片处理失败，API 会继续处理其他图片，不会导致整个请求失败
5. **命名规则**：
   - 使用 `images` 格式时，未指定名称会自动命名为"图片1"、"图片2"...
   - 使用 `imageUrl` 格式时，会自动命名为"图片1"、"图片2"...

## 性能考虑

- 图片会并行转换为 Base64，但建议每次请求不超过 5 张图片
- 大量图片会增加 API 响应时间和 token 使用量
- 建议在客户端进行图片压缩和优化

## 错误处理

如果图片 URL 无效或无法访问，该图片会被跳过，API 会记录错误日志但继续处理：

```
[Chat API] ❌ Failed to process 图片2: Invalid URL format
```

这样可以确保即使部分图片有问题，聊天功能仍然可用。

