# SSR错误修复总结 - document is not defined

## 问题描述

用户遇到Next.js服务端渲染(SSR)错误：

```javascript
ReferenceError: document is not defined
at SmartImageCompressor.detectSupportedFormats (lib/image-compression.ts:86:19)
at new SmartImageCompressor (lib/image-compression.ts:79:9)
```

## 根本原因

**问题根源：** 图片压缩库在服务端渲染时试图访问 `document` 对象

### 错误流程分析

1. **导入时机问题**：

   ```typescript
   // 问题代码 (修复前)
   export const imageCompressor = new SmartImageCompressor(); // 导入时立即执行
   ```

2. **构造函数问题**：

   ```typescript
   constructor() {
     this.detectSupportedFormats(); // 立即调用检测函数
   }
   ```

3. **浏览器API调用**：

   ```typescript
   private detectSupportedFormats(): void {
     const canvas = document.createElement('canvas'); // ❌ 服务端无document
   }
   ```

## 修复方案

### 1. 客户端检测机制

```typescript
// 添加客户端检测工具函数
function isClientSide(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
```

### 2. 延迟初始化

```typescript
export class SmartImageCompressor {
  private supportedFormats: Set<string> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    // ✅ 只在客户端初始化
    if (isClientSide()) {
      this.detectSupportedFormats();
      this.isInitialized = true;
    }
  }
}
```

### 3. 懒加载单例

```typescript
// ✅ 修复后 - 懒加载实例
let _imageCompressor: SmartImageCompressor | null = null;

function getImageCompressor(): SmartImageCompressor {
  if (!isClientSide()) {
    throw new Error('Image compressor is only available on the client side');
  }

  if (!_imageCompressor) {
    _imageCompressor = new SmartImageCompressor();
  }

  return _imageCompressor;
}
```

### 4. 安全的格式检测

```typescript
private detectSupportedFormats(): void {
  if (!isClientSide()) {
    console.warn('[ImageCompressor] detectSupportedFormats called on server side');
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    // ... 格式检测逻辑
  } catch (error) {
    console.warn('[ImageCompressor] Format detection failed, using fallback:', error);
    // 降级支持
    this.supportedFormats.add('image/jpeg');
    this.supportedFormats.add('image/png');
  }
}
```

### 5. 动态导入优化

在聊天页面中使用动态导入：

```typescript
// app/chat/page.tsx - 修复前
import { compressForChat } from '@/lib/image-compression';

// app/chat/page.tsx - 修复后
compressionResult = await import('@/lib/image-compression')
  .then(m => m.compressForChat(file));
```

## 修复效果

### ✅ 解决的问题

1. **消除SSR错误** - 不再在服务端访问 `document`
2. **保持功能完整** - 客户端压缩功能正常工作
3. **优雅降级** - 服务端环境下安全跳过初始化
4. **错误处理** - 完善的错误处理和降级机制

### 🔧 技术改进

1. **懒加载模式** - 避免导入时立即执行
2. **环境检测** - 智能识别客户端/服务端环境
3. **动态导入** - 进一步优化导入安全性
4. **错误边界** - 完善的异常处理机制

## 验证方法

### 1. 服务端渲染检查

```bash
# 启动开发服务器，检查是否还有SSR错误
npm run dev
```

### 2. 客户端功能测试

```typescript
// 在浏览器控制台测试
const { compressForChat } = await import('/lib/image-compression');
// 应该能正常工作而不报错
```

### 3. 错误日志监控

```typescript
// 检查控制台中的警告信息
// 应该看到：
// "[ImageCompressor] Supported formats detected: ['image/webp', 'image/jpeg', 'image/png']"
```

## 最佳实践

### ✅ 推荐做法

1. **环境检测**：任何浏览器API调用前检查环境
2. **懒加载**：避免导入时执行副作用代码
3. **降级处理**：提供服务端环境的安全降级
4. **动态导入**：对于客户端专用库使用动态导入

### ❌ 避免做法

1. **导入时副作用**：避免在模块导入时执行浏览器API
2. **假设环境**：不要假设代码只在浏览器中运行
3. **硬编码检测**：不要硬编码 `window` 或 `document` 检查

## 兼容性

- ✅ Next.js 13+ (App Router)
- ✅ Next.js 12+ (Pages Router)
- ✅ 服务端渲染 (SSR)
- ✅ 静态生成 (SSG)
- ✅ 客户端渲染 (CSR)

## 总结

此修复彻底解决了图片压缩库的SSR兼容性问题，通过：

1. **智能环境检测** - 区分服务端和客户端环境
2. **延迟初始化** - 避免服务端执行浏览器API
3. **优雅降级** - 服务端环境安全跳过功能
4. **懒加载模式** - 避免导入时副作用

修复后，应用可以正常进行服务端渲染，同时保持客户端图片压缩功能完整可用。
