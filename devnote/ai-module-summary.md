# AI 模块（lib/ai.ts）当前设计概览

> 更新时间：{{DATE}}

## 1️⃣ 依赖与初始化

- **openai**：通过 `OPENAI_API_KEY` 初始化，负责获取穿搭建议。
- **@vercel/blob**：上传并持久化最终合成图。
- **@vercel/kv**：存储生成任务 (job) 的状态与中间产物，供前端轮询。
- **jsonwebtoken**：生成 Kling API 所需 JWT。
- 其它工具函数：`urlToFile`、`fileToBase64`、`fetchWithTimeout`、`sleep` 等。

---

## 2️⃣ systemPrompt（可爱俏皮闺蜜风）

\`\`\`
Hellooo bestie! 💖 I'm your super fun, slightly over-caffeinated personal stylist ...
\`\`\`

特点：
1. 第一人称 + emoji，语气活泼。
2. 说明用户需提供：人像、服饰、场景。
3. 要求输出固定 8 个 JSON 字段（中文，`image_prompt` 为英文）。

JSON 字段：`scene_fit` / `style_alignment` / `personal_match` / `visual_focus` / `material_silhouette` / `color_combination` / `reuse_versatility` / `image_prompt`。

---

## 3️⃣ 核心函数

### 3.1 getStyleSuggestionFromAI()

参数：
\`\`\`ts
{
  humanImageUrl: string,
  garmentImageUrl: string,
  occasion: string,
  userProfile?: OnboardingData // 可选，提升个性化
}
\`\`\`
流程：
1. 拼接 `messages` 数组：`systemPrompt` + 用户消息（含可选 Profile）。
2. 调用 `openai.chat.completions.create` (模型 gpt-4o, JSON mode)。
3. 解析并返回 JSON 建议对象。

### 3.2 generateFinalImage()

7 步流水线并实时写入 KV：
| 步骤 | 说明 | KV 更新 |
|-----|------|---------|
|1|URL → File|—|
|2|Selfie → Base64|—|
|3|Kling v2 生成 `styledImage`|`processImages.styledImage` + `statusMessage`|
|4|`styledImage` & garment → Base64|—|
|5|虚拟试衣生成 `tryOnImage`|`processImages.tryOnImage` + `statusMessage`|
|6|FaceSwap 替换人脸|—|
|7|上传最终图至 Blob，返回安全 URL|最终由 status route 标记 `completed`|

`processImages` 结构示例：
\`\`\`json
{
  "styledImage": "https://...",
  "tryOnImage": "https://..."
}
\`\`\`

---

## 4️⃣ 后端-前端交互

1. `/api/generation/start` 创建 job，状态 `pending`。
2. 前端轮询 `/api/generation/status?jobId=xxx`：
   - `pending` → 触发 AI 建议 (`getStyleSuggestionFromAI`)。
   - `suggestion_generated` → 显示风格建议 + 等待最终图。
   - `processImages.*` 字段随时可能更新，用于 Loading 画面实时预览。
   - `completed` 返回 `result.imageUrl`，前端进入结果页。

---

## 5️⃣ 近期改动

- 新增 **processImages** 字段：支持 `styledImage`、`tryOnImage` 实时预览。
- 在 Loading UI 显示 "Original / Garment / Styled / Try-On" 网格图。
- 新增场景选项 **Original**（不额外添加 scene prompt）。

---

> 以上记录用于团队快速了解 AI 模块现状，如有变化请同步更新。
