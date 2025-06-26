# 异步轮询架构系统设计

**目标**: 解决因AI生成任务耗时过长，导致的Vercel服务器函数超时问题。通过实现异步工作流，提升应用的稳定性和用户体验。

#### **1. 核心思想**

将一个"长任务"（完整的AI生图流程）拆分为三个独立的、快速响应的阶段：
1.  **任务提交**: 客户端请求后端启动任务，后端立即返回一个任务ID (`jobId`)。
2.  **状态轮询**: 客户端使用 `jobId` 定期查询任务进度。
3.  **结果获取**: 当任务完成时，客户端从状态查询接口获取最终结果。

#### **2. 数据库/存储需求**

我们需要一个地方来存储每个任务的状态。考虑到这是一个轻量级的需求，我们可以使用 **Vercel KV** (基于Redis的键值数据库)，它与Vercel生态系统无缝集成，非常适合这个场景。

**数据结构 (`Job`):**
我们将为每个 `jobId` 存储一个JSON对象，结构如下：

\`\`\`json
{
  "jobId": "unique-uuid-string",
  "status": "pending" | "processing-style" | "processing-tryon" | "processing-faceswap" | "completed" | "failed",
  "statusMessage": "A human-readable message, e.g., 'Generating your look...'",
  "imageUrl": null | "final-image-url",
  "error": null | "error-message-string",
  "createdAt": "iso-timestamp",
  "updatedAt": "iso-timestamp"
}
\`\`\`

#### **3. API 接口设计**

我们将重构现有的API，并创建三个新的端点：

**A. `POST /api/generation/start`**
*   **作用**: 启动一个新的生成任务。
*   **请求体**: `FormData`，包含 `human_image`, `garment_image`, `occasion` 等所有必要信息。
*   **后端逻辑**:
    1.  生成一个唯一的 `jobId` (例如，使用 `crypto.randomUUID()`)。
    2.  创建一个 `Job` 对象，初始状态为 `pending`，并将其存入Vercel KV。
    3.  **立即**返回 `{ jobId: "..." }` 给前端。
    4.  **在后台异步地**启动第一个耗时操作（调用OpenAI获取建议）。**注意**: 这一步是"触发后不管"，我们不会等待它完成。
*   **响应**: `202 Accepted`，`{ "jobId": "..." }`

**B. `GET /api/generation/status?jobId={jobId}`**
*   **作用**: 查询指定任务的当前状态。
*   **请求参数**: `jobId` (从URL查询参数中获取)。
*   **后端逻辑**:
    1.  从Vercel KV中根据 `jobId` 读取 `Job` 对象。
    2.  返回完整的 `Job` 对象给前端。
*   **响应**: `200 OK`，`{ jobData }`

**C. `POST /api/generation/webhook` (内部逻辑，非公开)**
*   **作用**: 这是整个异步流程的核心。当一个耗时的AI任务（如Kling生图）完成后，它需要一个回调地址来通知我们的系统。但由于Kling不直接支持Webhook，我们将**用一个内部的、由我们自己触发的逻辑来模拟它**。
*   **实际实现**: 这不会是一个公开的API。我们会修改 `/api/generation/status` 的逻辑。当它被调用时，它不仅会检查当前状态，还会根据当前状态**决定是否要触发下一步**。
    *   例如，如果 `status` 是 `pending`，它会去检查OpenAI的任务是否完成。如果完成了，它就把 `status` 更新为 `processing-style`，并启动Kling的风格化任务，然后返回新的状态给前端。
    *   如果 `status` 是 `processing-style`，它就去轮询Kling的任务。如果完成了，就把 `status` 更新为 `processing-tryon`，并启动试穿任务。
    *   这个设计避免了需要一个长期运行的后台进程，完美契合Serverless架构。

#### **4. 前端逻辑变更 (`app/page.tsx`)**

1.  **启动任务**:
    *   当用户点击"Get Styling Advice"按钮时，调用 `POST /api/generation/start`。
    *   在获取到 `jobId` 后，将其存入组件的`state`中。
    *   UI切换到加载/进度条界面。
2.  **开始轮询**:
    *   使用 `useEffect` 和 `setInterval`，每隔3-5秒调用一次 `GET /api/generation/status?jobId={...}`。
    *   **轮询逻辑**:
        *   当接口返回 `status: 'completed'` 时，清除定时器 (`clearInterval`)，获取 `imageUrl` 并展示给用户。
        *   当接口返回 `status: 'failed'` 时，清除定时器，并向用户显示错误信息。
        *   在其他进行中状态下，可以根据 `statusMessage` 更新UI上的提示文本。
    *   **健壮性**: 需要处理组件卸载时清除定时器的情况，以防内存泄漏。

#### **5. 迁移计划**

1.  **设置 Vercel KV**: 在Vercel仪表盘中创建KV数据库并连接到项目。
2.  **后端开发**:
    *   实现 `/api/generation/start` 接口。
    *   实现 `/api/generation/status` 接口，包含状态检查和**触发下一步**的核心逻辑。
    *   将现有 `generate-style-v2` 中的各个步骤（OpenAI, Kling-Style, Kling-Tryon, FaceSwap）封装成可独立调用的函数。
3.  **前端开发**:
    *   修改 `app/page.tsx` 中的 `handleGetSuggestion` 函数以适应新的异步流程。
    *   实现轮询逻辑和UI状态更新。
4.  **移除旧代码**: 在新架构稳定运行后，可以安全地删除旧的 `/api/generate-style-v2` 和 `/api/generate-suggestion` 接口。
