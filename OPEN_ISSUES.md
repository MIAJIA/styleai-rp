如何实现高质量和可控性？
如何实现记忆管理

# Open Issue: 将用户档案从 localStorage 迁移到 KV Store

**发现时间:** 2024-12-23

---

### 问题描述

当前用户档案 (`styleMe_user_profile`) 存储在浏览器的 localStorage 中，这种方式存在多个限制和问题。

### 当前问题

1. **数据丢失风险**: 用户清除浏览器数据时档案丢失
2. **跨设备同步**: 无法在不同设备间同步用户档案
3. **存储限制**: localStorage 有配额限制，需要复杂的降级策略
4. **无法备份**: 数据只存在用户本地，无法恢复

### 当前实现

```typescript
// 4层降级存储策略应对localStorage限制
const profileSaveSuccess = safeSetLocalStorage("styleMe_user_profile", profileJson);
if (!profileSaveSuccess) {
  // 策略2: 核心数据
  // 策略3: 最小数据
  // 策略4: 错误标记
}
```

### 迁移目标

**使用 Vercel KV Store**:

- 持久化存储
- 跨设备同步
- 无存储配额限制
- 支持备份和恢复

### 实施计划

1. **创建 KV 存储 API**:
   - `POST /api/user-profile` - 保存档案
   - `GET /api/user-profile` - 获取档案
   - `PUT /api/user-profile` - 更新档案

2. **用户身份标识**:
   - 生成唯一用户ID
   - 支持匿名用户档案存储

3. **更新存储逻辑**:
   - 替换 `saveUserProfile()` 实现
   - 移除4层降级策略
   - 简化错误处理

4. **清理旧代码**:
   - 移除 localStorage 相关逻辑
   - 用户重新完成引导流程即可

---

# Open Issue: 风格总结步骤使用假的AI延迟

**发现时间:** 2024-12-23

---

### 问题描述

在用户引导流程的最后一步 (`style-summary-step.tsx`)，系统使用了2秒的 `setTimeout` 来模拟AI处理，但实际上只是在前端执行简单的if-else逻辑，没有真正的AI调用。

### 具体问题

1. **误导用户体验**: 显示"AI is integrating all your information"但实际没有AI处理
2. **不一致性**: 与真正的AI处理（照片分析步骤）形成对比
3. **浪费时间**: 不必要的2秒等待

### 当前实现

```typescript
// 假的AI处理
setTimeout(() => {
  const profile = {
    structureCombination: generateStructureCombination(), // 简单逻辑
    styleLabels: generateStyleLabels(),                  // 硬编码映射
    recommendedKeywords: generateRecommendedKeywords(),  // 固定组合
  };
  // ...
}, 2000); // 假延迟
```

### 解决方案

**选项1**: 实现真正的AI处理 - 创建 `/api/generate-style-profile` 端点
**选项2**: 移除假延迟 - 直接显示结果，诚实的用户体验

---

- P1. Change to carousel
- In generate-style, when calling kling to generate a prompt, remove "Overall Recommendation" and "Confidence note", only add the "Styling tips" from the output to kling's prompt. Please note that I still need to use "Overall Recommendation" and "Confidence note" elsewhere, so the output of openai remains unchanged.
- The thumbnail grid designed before is gone in classic mode; a 2×2 thumbnail grid is now displayed synchronously in the "Suggestion" stage, allowing users to continuously see the Styled / Try-On progress. Specifically, users can first see their input (human image, cloth image); then see the result image returned by the first kling API call, and the result image returned by try on.

# Open Issue: Generated Images are Cropped (Missing Head/Face)

**Last Updated:** 2024-07-26

---

### 1. Problem Description

When a user uploads a portrait photograph (especially one with a non-standard aspect ratio), the final AI-generated "virtual try-on" image returned by the Kling AI API is consistently cropped, with the subject's head and face missing. The API call itself is successful and returns a seemingly valid image, but the composition is incorrect.

### 2. Root Cause Analysis (Hypothesis)

The root cause is almost certainly in the **client-side pre-processing of the user's uploaded photo** before it is sent to the `/api/generate` endpoint.

The Kling AI API has strict requirements for image aspect ratio. Our current client-side logic attempts to resize or pad the image to meet these requirements. However, this pre-processing creates an image that, while technically valid in dimensions, causes the AI model to misinterpret the subject. It appears the model performs its own "center crop" or focuses on the torso, leading to the head being cut off in the final output.

The problem is **not** in how the final image is displayed on the results page; the image data itself is flawed.

### 3. Attempts and History

1. **No Pre-processing:** Led to `Image aspect ratio is invalid` errors from the API.
2. **Client-Side Padding ("Letterboxing"):** We tried padding the image with white bars to fit the required aspect ratio. This resolved the API error but was the first time we observed the "missing head" phenomenon.
3. **Client-Side Top-Crop:** We attempted to crop the image from the top to preserve the head. This also failed, suggesting the AI's internal cropping is not simple.
4. **Frontend Display Fixes (`object-contain`):** We confirmed the issue is not a display-time problem. The image file itself is cropped. The current display logic correctly shows whatever image the API returns, without further cropping.

### 4. Actionable Next Steps (TODOs)

To solve this, the image pre-processing logic needs a fundamental redesign.

- **[HIGH PRIORITY] `app/page.tsx` (or image upload component):**

  - **TODO:** The core task is to re-implement the client-side image pre-processing. The goal is to create a "smart crop" function. This function should:
    1. Identify the most important region of the image (e.g., from the top of the head to the waist).
    2. Crop and resize this region to precisely match the aspect ratio expected by the Kling AI API.
    3. Consider giving the user a manual cropping tool as a more robust solution, allowing them to define the area for the virtual try-on.

- **`app/api/generate/route.ts`:**

  - **TODO:** As an alternative to client-side logic, investigate implementing server-side image processing using a library like `sharp`. This would offload the work from the user's device, provide more consistent results, and give us more control over the final image sent to the AI. See `OPEN_ISSUES.md` for full context.

- **`app/results/page.tsx`:**
  - **TODO:** The current `object-contain` display is appropriate for now. If the image generation is fixed, and the resulting images have a consistent, correct aspect ratio, re-evaluate if this "letterbox" display is still needed or if the container can be sized to the image directly. See `OPEN_ISSUES.md` for full context.

删除 onboarding flow 的下面几个 component：Facial Structure Assessment页面；Usage Scenarios页面；Style Boundaries页面
