# 功能请求：动态加载屏幕与 AI 造型建议

**版本:** 1.0
**日期:** 2024年7月29日
**状态:** 设计阶段

---

## 1. 目标 (Goal)

当前，用户在点击"Generate Your Style"按钮后，会进入一个显示静态提示语的加载页面，直到最终图片生成完毕。这个过程缺少即时反馈，用户无法得知后台正在进行的个性化分析。

**核心目标：** 将静态的加载页面转变为一个动态的、个性化的反馈界面。当用户点击生成按钮后，我们希望**立即调用 OpenAI API** 获取"AI Stylist"的专属造型建议，并将这些建议**逐条实时显示**在加载屏幕上，从而在用户等待图片生成的同时，为他们提供有价值的、个性化的内容。

---

## 2. 当前工作流程与局限 (Current Workflow & Limitations)

1.  **用户操作:** 用户在主页上选择好肖像和衣物，点击"Generate Your Style"。
2.  **前端跳转:** 前端立即导航至 `/loading` 路由，该页面显示一个带有通用提示语的动画。
3.  **API 调用:** 与此同时，前端向后端的 `/api/generate-style` 发起一个**单一的、长耗时的** API 请求。
4.  **后端处理:**
    - `/api/generate-style` 接收请求。
    - **第一步:** 调用 OpenAI API 获取造型建议 (`styleSuggestion`)。
    - **第二步:** 使用上一步的建议作为 Prompt，调用可灵 (Kling) AI 的接口提交图片生成任务。
    - **第三步:** 在后端进行循环轮询 (Polling)，等待可灵 AI 完成任务。
    - **第四步:** 任务成功后，将最终的图片 URL 返回给前端。
5.  **前端响应:** 前端接收到图片 URL 后，跳转到结果页面 `/results` 进行展示。

**主要局限:** 前端在整个等待过程中是"盲目"的。它必须等到第四步完全结束后才能得到响应，因此无法获取到在第二步中就已经生成的、极具价值的 `styleSuggestion` 内容。

---

## 3. 建议的全新工作流程 (Proposed New Workflow)

我们将把这个过程分解为两个独立的 API 调用，以实现即时反馈。

**阶段一：获取造型建议 (Fetch Styling Advice)**

1.  **用户操作:** 用户点击"Generate Your Style"。
2.  **第一次 API 调用:** 前端**立即**向一个**新的、快速响应**的 API 端点（例如 `app/api/get-style-suggestion/route.ts`）发起请求。
3.  **新 API 的职责:** 这个 API 的唯一任务就是调用 OpenAI 获取 `styleSuggestion`。它**不会**与可灵 AI 交互，因此可以**在1-2秒内迅速返回**造型建议的文本内容。
4.  **前端接收建议:** 主页面接收到包含 `styleSuggestion` 的 JSON 响应。

**阶段二：显示建议并生成最终图片 (Display Advice & Generate Image)**

5.  **导航并传递数据:** 获取到建议后，前端立刻导航到加载页面（我们可以复用或创建一个新的加载组件），并将刚刚收到的 `styleSuggestion` 文本作为 props 或通过状态管理传递过去。
6.  **动态展示:** 加载页面组件接收到 `styleSuggestion` 后，开始**逐行、动态地**将其展示给用户，创造一种 AI 正在"思考并给出建议"的沉浸感。
7.  **第二次 API 调用:** 在加载页面渲染的同时，其 `useEffect` hook **在后台**向我们现有的 `/api/generate-style` 端点发起**第二次** API 请求。
    - **关键区别:** 这次请求会将已经获取到的 `styleSuggestion` 文本直接作为参数包含在请求体 (body) 中。
8.  **后端优化:** `/api/generate-style` 端点需要被改造。当它检测到请求中**已包含** `styleSuggestion` 时，它将**跳过**内部调用 OpenAI 的步骤，直接进行可灵 AI 的图片生成和轮询。
9.  **最终跳转:** 当第二次 API 调用完成并返回最终图片 URL 时，加载页面再跳转到结果页。

---

## 4. API 设计与修改 (API Design & Modifications)

### 4.1. 新建 API: `app/api/get-style-suggestion/route.ts`

- **路径:** `POST /api/get-style-suggestion`
- **职责:** 快速生成并返回 AI 造型建议。
- **请求体 (Request Body):**
  \`\`\`json
  {
  "human_image_url": "...",
  "garment_type": "...", // or garment_description
  "personaProfile": { ... }
  }
  \`\`\`
- **核心逻辑:**
  1.  接收请求，验证参数。
  2.  调用 OpenAI GPT-4o（复用现有 prompt 逻辑）。
  3.  获取返回的建议文本。
- **响应体 (Response Body):**
  \`\`\`json
  {
  "styleSuggestion": "这是为您生成的专属造型建议..."
  }
  \`\`\`
- **特点:** 响应速度快，不涉及长时间等待。

### 4.2. 修改现有 API: `app/api/generate-style/route.ts`

- **路径:** `POST /api/generate-style` (保持不变)
- **职责:** 接收造型建议（可选）和图片信息，生成并返回最终图片。
- **请求体 (Request Body) - 扩展:**
  \`\`\`json
  {
  "human_image_url": "...",
  "style_prompt": "...",
  "garment_type": "...",
  // 新增可选参数
  "styleSuggestion": "这是已经从上一步获取到的建议文本...",
  "modelVersion": "kling-v1-5"
  }
  \`\`\`
- **核心逻辑修改:**
  \`\`\`typescript
  // 在函数开头
  const { styleSuggestion, ...otherParams } = await request.json();

  let finalStyleSuggestion = styleSuggestion;

  if (!finalStyleSuggestion) {
  // 如果请求中没有提供建议，则按旧流程，自己调用 OpenAI 获取
  console.log("No pre-generated suggestion found, calling OpenAI...");
  finalStyleSuggestion = await callOpenAI(...);
  } else {
  // 如果请求中已提供建议，则直接使用
  console.log("Using pre-generated suggestion.");
  }

  // 后续逻辑保持不变，使用 finalStyleSuggestion 来构建可灵 AI 的 prompt
  // ... 调用可灵 AI，轮询，返回结果
  \`\`\`

---

## 5. 前端实现步骤 (Frontend Implementation Steps)

1.  **修改主页 (`app/page.tsx`):**

    - 重构 `handleGenerateClick` 函数。
    - 函数内部，首先 `await` 调用 `/api/get-style-suggestion`。
    - 成功后，将获取到的 `styleSuggestion` 存储在 state 或通过 router query params 传递。
    - 然后使用 Next.js 的 `router.push()` 导航到加载页面。

2.  **改造加载页面 (`app/loading.tsx` 或新组件):**
    - 使其能够接收 `styleSuggestion` 字符串作为 prop。
    - 使用 `useEffect` 和 `useState` 结合 `setTimeout`，实现文本的逐字或逐行打字机效果。
    - 在另一个 `useEffect` 中（仅运行一次），发起对 `/api/generate-style` 的第二次 API 调用，并把 `styleSuggestion` 传入请求体。
    - 在该调用的 `.then()` 或 `await` 之后处理最终的页面跳转。

---

## 6. 优点 (Advantages)

- **显著提升用户体验:** 将"死"的等待时间转化为一个有趣的、信息丰富的互动过程。
- **增强感知性能:** 应用给用户的感觉会更快、更智能，因为它提供了即时、个性化的反馈。
- **更清晰的架构:** 逻辑被分解到两个目的单一的 API 中，使得代码更易于理解、维护和独立调试。
