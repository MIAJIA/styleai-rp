# Chat页面API集成测试指南

## 测试步骤

### 1. 基础功能测试
1. 启动开发服务器：`npm run dev`
2. 访问主页：`http://localhost:3000`
3. 上传自拍照片和服装图片
4. 选择场合（如"咖啡厅约会"）
5. 在Step 4中选择"Chat Experience"
6. 验证数据是否正确传递到Chat页面

### 2. API集成测试
1. 在Chat页面点击"开始生成我的造型"
2. 验证以下流程：
   - 显示"AI正在分析你的穿搭需求..."loading状态
   - 调用`/api/generation/start`成功创建job
   - 开始轮询`/api/generation/status`
   - 当status为`suggestion_generated`时显示穿搭建议文本
   - 显示"AI正在生成你的专属造型图片..."loading状态
   - 当status为`completed`时显示最终生成的图片
   - 显示完成消息和操作按钮

### 3. 错误处理测试
1. 测试网络错误情况
2. 测试API返回错误的情况
3. 验证重试功能是否正常
4. 验证超时处理（5分钟）

### 4. 用户体验测试
1. 验证消息自动滚动到底部
2. 验证图片点击放大功能
3. 验证loading动画效果
4. 验证响应式布局

## 预期结果

### 成功流程
1. 用户选择图片和场合 → Chat页面显示个性化欢迎消息
2. 点击开始生成 → 显示loading状态
3. API调用成功 → 显示AI生成的穿搭建议（包含场合适配度、风格搭配等）
4. 继续生成 → 显示最终造型图片
5. 完成 → 显示操作按钮（再试一套、查看我的造型）

### API数据流
```
用户操作 → FormData(human_image, garment_image, occasion)
       → POST /api/generation/start
       → 返回jobId
       → 轮询 GET /api/generation/status?jobId=xxx
       → status: suggestion_generated → 显示文字建议
       → status: completed → 显示最终图片
```

## 调试信息

在浏览器控制台查看以下日志：
- `[CHAT POLLING] Received data:` - 轮询返回的数据
- `[CHAT POLLING] Suggestion generated` - 建议生成完成
- `[CHAT POLLING] Generation completed` - 图片生成完成
- 任何错误信息和堆栈跟踪

## 已知问题

1. 图片格式转换可能在某些浏览器中有兼容性问题
2. 长时间生成可能触发超时机制
3. 网络不稳定可能导致轮询失败

## 下一步优化

1. 添加更详细的进度指示器
2. 优化错误消息的用户友好性
3. 添加生成历史保存功能
4. 实现更智能的重试机制