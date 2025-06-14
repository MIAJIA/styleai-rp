# 个性化图片生成功能增强计划

## 核心思路

将用户的个人风格档案（来自"我的风格"页面）动态地融入到调用文生图模型（如 Kling）的 Prompt 中，以生成更贴合用户个人特质和风格偏好的图片，从而显著提升个性化体验。

我们的目标是创建一个"超级 Prompt"。这个 Prompt 不仅仅告诉 Kling 要生成"赛博朋克风格的女孩"，而是告诉它："请为**这位**具有[特定脸型、身形、气质]的用户，生成一张高质量、符合她个人特点的**赛博朋克风格**穿搭图"。这样 AI 就有了创作的"锚点"，大大提升了出图的匹配度和个性化程度。

## 数据流设计

1.  **用户在 `my-style` 页面操作**：用户查看完自己的风格报告后，点击"用新风格改造"按钮，并选择一个目标风格（例如："法式复古"）。
2.  **前端组件 (`app/my-style/page.tsx`)**：
    *   获取当前页面已加载的 `aiAnalysis` 数据（用户的风格档案）。
    *   获取用户选择的 `targetStyle`（"法式复古"）。
    *   调用一个函数，如 `handleTransformClick`，来**动态构建**一个详细的 Prompt。
    *   向后端的 `/api/generate-image` (或类似命名的) API 路由发送请求，请求体中包含这个新构建的 `prompt` 和用户的照片 `photoUrl`。
3.  **后端 API 路由 (`app/api/generate-image/route.ts`)**：
    *   接收前端发来的 `prompt` 和 `photoUrl`。
    *   调用 Kling AI 的 API，将这个详细的 `prompt` 传递给它。
    *   将 Kling 返回的图片结果再返回给前端。

## Prompt 设计（关键部分）

这是我们将发送给 Kling API 的 Prompt 模板。它使用英文编写以获得最佳的 AI 理解效果，并动态地填入用户的风格数据。

```javascript
// 在你的前端组件 (app/my-style/page.tsx) 中构建这个 prompt

// aiAnalysis 是你从后端获取的用户风格档案对象
// targetStyle 是用户选择的新风格，例如 "French Vintage"
const createKlingPrompt = (aiAnalysis, targetStyle, userName = "the user") => {
  // 从 aiAnalysis 中提取关键信息
  const { bodyType, faceShape, bodyAdvantages, face_style } = aiAnalysis;
  const { type_name, feature_keywords, style_recommendation } = face_style;

  // 使用模板字符串构建一个结构清晰、信息丰富的 Prompt
  const prompt = `
Generate a high-resolution, photorealistic, full-body fashion photograph of a person.

**Subject Reference:**
Base the person's appearance, face, and body on the provided input image. Maintain their identity.

**User's Inherent Style Profile (Context for the model):**
- **Name:** ${userName}
- **Body Type:** ${bodyType}
- **Face Style:** ${type_name} (${feature_keywords.join(', ')})
- **Key Body Strengths to Emphasize:** ${bodyAdvantages.join(', ')}
- **Natural Style Affinity:** This person's inherent style leans towards ${style_recommendation.join(' and ')}.

**Creative Instruction (The Transformation):**
Now, dress ${userName} in a complete, stylish outfit that perfectly embodies the **'${targetStyle}'** theme. The new outfit should be flattering to their specified body type and strengths. The overall mood should be chic, confident, and aspirational.

**Scene & Quality:**
- **Setting:** A setting that complements the '${targetStyle}' theme (e.g., a Parisian street for "French Vintage", a neon-lit alley for "Cyberpunk").
- **Lighting:** Professional fashion photography lighting.
- **Quality:** 8K, ultra-detailed, sharp focus.
`;

  return prompt;
};
```

## 实现步骤建议

1.  **修改前端页面 `app/my-style/page.tsx`**：
    *   确保此页面可以获取并管理 `aiAnalysis` 状态。
    *   添加 UI 元素让用户可以选择 `targetStyle` (例如一个下拉菜单或一组按钮)。
    *   实现一个处理点击事件的函数，类似这样：

    ```tsx
    // 在 app/my-style/page.tsx 中

    const handleTransformClick = async (targetStyle: string) => {
      if (!aiAnalysis || !userPhoto) {
        // 如果数据不完整，提示用户
        console.error("Analysis data or photo is missing.");
        return;
      }

      // 1. 构建 Prompt
      const detailedPrompt = createKlingPrompt(aiAnalysis, targetStyle, "Mia"); // 可以传入用户名

      // 2. 显示加载状态
      setIsLoading(true);

      // 3. 调用后端 API
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: detailedPrompt,
            photoUrl: userPhoto.url, // 假设用户照片URL已存储
          }),
        });

        const result = await response.json();

        if (response.ok) {
          // 4. 成功后跳转到结果页或显示图片
          router.push(`/results/${result.imageId}`);
        } else {
          throw new Error(result.error || "Failed to generate image.");
        }
      } catch (error) {
        console.error("Transformation failed:", error);
        // 显示错误信息
      } finally {
        setIsLoading(false);
      }
    };
    ```

</rewritten_file>