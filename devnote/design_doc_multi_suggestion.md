# 设计文档：多建议生成流程

## 1. 概述

为了提升用户体验，我们将把单样式推荐流程，升级为"一出三"的模式。系统将一次性生成三套独立的文字建议，但只默认启动第一套的图片生成。用户可以通过点击"换一套搭配"按钮，按需、依次地启动后续两套建议的图片生成任务。

## 2. 前端状态管理流程图

前端的核心状态围绕 `currentSuggestionIndex`（当前展示到第几个建议）以及每个建议自身的图片生成状态。

```mermaid
stateDiagram-v2
    [*] --> 初始化中: 页面加载

    state 初始化中 {
        note right of 初始化中
            使用 URL 中的 jobId。
            开始轮询获取 Job 数据。
        end note
        [*] --> 展示建议中: Job 数据首次返回
    }

    state 展示建议中 {
        note right of 展示建议中
            总是显示所有已触发的 suggestion 卡片
            (suggestionIndex <= currentSuggestionIndex)。
            每张卡片根据自己的 status 显示：
            'pending' -> 占位符
            'generating_images' -> 加载中
            'succeeded' -> 图片
            'failed' -> 错误
        end note
    }

    初始化中 --> 展示建议中

    展示建议中 --> 触发下一个建议: 用户点击"换一套搭配"

    state 触发下一个建议 {
        note right of 触发下一个建议
          1. 检查 currentSuggestionIndex < 2。
          2. 如果是，则 currentSuggestionIndex++。
          3. 调用后端 API 启动新 index 的图片任务。
          4. 禁用按钮，直到 API 调用完成。
        end note
    }

    触发下一个建议 --> 展示建议中: API 调用完成

    state 最终状态 {
      note right of 最终状态
        currentSuggestionIndex === 2。
        "换一套搭配"按钮被禁用或隐藏。
        轮询继续，直到所有图片任务完成。
      end note
    }

    展示建议中 --> 最终状态: 当 currentSuggestionIndex 达到 2
```

## 3. 后端-前端状态映射

前端 UI 的展示完全由后端的 `Job` 对象驱动。轮询机制确保前端状态最终与后端状态保持一致。

| 后端 `Job.suggestions[i]` 状态 | 前端 `suggestion` 状态表示 | UI 效果 |
| :--- | :--- | :--- |
| `status: 'pending'` | `suggestion.status === 'pending'` | 显示文字建议，图片位置为占位符。 |
| `status: 'generating_images'` | `suggestion.status === 'generating_images'` | 显示文字建议，图片位置为加载动画。 |
| `status: 'succeeded'` | `suggestion.status === 'succeeded'` | 显示文字建议和最终生成的图片 (`imageUrls`)。 |
| `status: 'failed'` | `suggestion.status === 'failed'` | 显示文字建议和一条错误信息。 |

## 4. 对 Redis (Vercel KV) 的影响

我们将继续使用 Vercel KV (基于 Redis) 作为我们任务队列和状态管理的核心存储。新的设计将改变我们存储 `Job` 对象的数据结构和读写模式。

#### a. 数据结构变更

我们将从扁平化的数据结构转变为嵌套结构。整个 `Job` 对象，包括其内含的 `suggestions` 数组，将被序列化后作为一个整体存储在 Redis 中。

* **键 (Key)**: 仍然是 `jobId`。
* **值 (Value)**:
  * **之前**: 一个代表单个任务的 Redis Hash 或 JSON 字符串，字段可能包括 `status`, `result`, `error` 等。
  * **之后**: 一个包含嵌套数组的复杂 `Job` 对象的 JSON 字符串。`@vercel/kv` 会自动处理对象的序列化和反序列化。KV 中存储的 `Job` 对象结构将如下所示：

    ```json
    {
      "jobId": "abc-123",
      "status": "processing",
      "suggestions": [
        {
          "index": 0,
          "status": "generating_images",
          "styleSuggestion": "...",
          "imageUrls": []
        },
        {
          "index": 1,
          "status": "pending",
          "styleSuggestion": "...",
          "imageUrls": []
        },
        {
          "index": 2,
          "status": "pending",
          "styleSuggestion": "...",
          "imageUrls": []
        }
      ],
      "createdAt": 1678886400000
    }
    ```

#### b. 读写模式变更

* **任务创建 (`/api/generation/start`)**:
  * **写操作**: 创建一个完整的、包含三个 `suggestion` 的 `Job` 对象，并将其作为一个整体写入（`kv.set`）到以 `jobId` 为键的位置。这是一个单次写入操作。

* **触发新建议 (`/api/generation/start-image-task`)**:
  * 这是一个"读取-修改-写入" (Read-Modify-Write) 的流程：
        1. **读取**: 使用 `kv.get` 根据 `jobId` 读取整个 `Job` 对象。
        2. **修改**: 在内存中更新 `Job` 对象里特定 `suggestion` 的 `status` 字段（从 `'pending'` 到 `'generating_images'`）。
        3. **写入**: 使用 `kv.set` 将**整个被修改后**的 `Job` 对象写回到原来的 `jobId` 键。

* **状态轮询 (`/api/generation/status`)**:
  * **读操作**: 与之前相同，使用 `kv.get` 根据 `jobId` 读取整个 `Job` 对象并返回给前端。这是一个单次读取操作，没有变化。

这个模式确保了数据的一致性。由于 Vercel KV 的限制，我们无法使用像 `HSET` 这样的命令去直接修改嵌套对象中的某个字段，因此"读取-修改-写入"是更新建议状态的标准实践。

## 5. 关键问题与解决方案

### a. 如何保证每个 suggestion 只生成一次图片？

这是一个幂等性问题，我们需要在前后端同时设防。

* **后端（主要防线）**: 新的 `POST /api/generation/start-image-task` 接口必须是幂等的。在启动一个图片生成任务之前，它**必须**检查该 `suggestion` 的当前状态。
  * **如果 `status` 是 `'pending'`**: 则启动任务，更新状态为 `'generating_images'`，并返回成功。
  * **如果 `status` 不是 `'pending'`**（例如已经是 `'generating_images'` 或 `'succeeded'`), 则**不执行任何操作**，直接返回成功。这可以防止因为网络延迟等问题导致的重复请求。

* **前端（辅助防线）**:
    1. **状态驱动UI**: "换一套搭配"按钮的逻辑是递增 `currentSuggestionIndex`。它只会向前，永远不会重复触发已经展示过的索引。
    2. **禁用按钮**: 在用户点击"换一套搭配"后，应立即禁用该按钮，直到 `start-image-task` 的 API 调用完成。这可以防止用户快速连击导致发送多个重复请求。

### b. 如何在轮询时避免不必要的界面重渲染？

轮询会频繁获取整个 `Job` 对象，如果处理不当，会导致整个聊天界面闪烁或不必要的重渲染，影响性能。

* **核心策略：组件备忘录 (Memoization)**
  * 我们将创建一个独立的 `SuggestionCard.tsx` 组件，并用 `React.memo` 将其包裹。
  * `React.memo` 会对组件的 `props` 进行浅比较。只要 `props` 没有变化，即使父组件重渲染，该组件也不会重渲染。

* **智能状态更新**:
  * 在 `useGeneration` hook 中，我们持有 `suggestions` 数组状态。
  * 当轮询获取到新的 `Job` 对象时，我们不能简单地用 `polledJob.suggestions` 完整替换旧的 `suggestions` 状态。这样做会创建一个全新的数组，导致所有 `SuggestionCard` 都重渲染。
  * 正确的做法是，创建一个新的数组，但**复用**那些没有发生变化的 `suggestion` 对象的引用。只有状态发生改变的 `suggestion` 对象才使用新的引用。

    ```typescript
    // In useGeneration's onUpdate callback
    setSuggestions(prevSuggestions => {
      const newSuggestionsFromJob = polledJob.suggestions;

      // 检查是否有任何 suggestion 的状态真正发生了改变
      const needsUpdate = newSuggestionsFromJob.some(
        (newSuggestion, index) => newSuggestion.status !== prevSuggestions[index]?.status
      );

      if (needsUpdate) {
        // 返回从 job 中获取的新数组。React.memo 会确保只有
        // props 变化的卡片才会重渲染
        return newSuggestionsFromJob;
      }

      // 如果没有变化，返回旧的状态对象引用
      // 这可以防止 React 重渲染父组件及其子组件
      return prevSuggestions;
    });
    ```

    通过这种方式，只有那些 `status` 真正改变了的 `SuggestionCard` 才会重渲染，极大地提升了性能。

## 6. 简洁性与 DRY 原则

* **`usePolling` Hook**: 已有的 `usePolling` hook 是一个很好的实践，它将通用轮询逻辑从业务逻辑中抽离。我们将继续使用它。
* **`SuggestionCard` 组件**: 创建可复用的 `SuggestionCard` 组件，避免在主页面中编写重复的渲染逻辑。
* **后端服务层**: 核心的图片生成触发逻辑（调用第三方 API、更新 KV 状态等）应该被封装在一个独立的函数中，例如 `lib/ai/services/imageService.ts`。`/api/generation/start` 和 `/api/generation/start-image-task` 这两个路由处理器都应该调用这个服务函数，而不是各自实现一遍逻辑。

## 7. 工程实现计划

我们将分阶段进行开发，每个阶段都有明确的任务和验证方法，以确保迭代的稳定性和正确性。

### 阶段一：后端数据模型与类型定义

* **任务**:
  * 修改 `lib/ai/types.ts` 文件。
  * 根据设计，定义新的 `Suggestion` 接口，并更新 `Job` 接口，使其包含一个 `Suggestion[]` 类型的 `suggestions` 字段。
* **验证**:
  * **静态验证**: 运行 `pnpm tsc` 或 `pnpm build`，确保没有 TypeScript 类型错误。这是确保整个项目类型定义一致性的基础。

### 阶段二：后端核心逻辑 - 任务创建

* **任务**:
  * 重构 `/api/generation/start/route.ts`。
  * 修改对 AI 服务的调用，使其一次性返回三套独立的文字建议。
  * 根据返回的建议，创建新的 `Job` 对象结构。
  * 只为 `suggestions[0]` 启动图片生成任务，并将其状态设置为 `'generating_images'`。
  * 将完整的 `Job` 对象存入 Vercel KV。
* **验证**:
  * **单元/集成测试**: 使用 `curl`、Postman 或一个测试脚本调用此 API。
  * **手动数据检验**: 调用 API 后，使用 `vercel kv get <jobId>` 命令检查 Redis 中的数据。
    * 确认返回的 JSON 结构正确，包含一个有 3 个元素的 `suggestions` 数组。
    * 确认 `suggestions[0].status` 为 `'generating_images'`。
    * 确认 `suggestions[1].status` 和 `suggestions[2].status` 均为 `'pending'`。

### 阶段三：后端核心逻辑 - 触发新建议

* **任务**:
  * 创建新的 API 路由 `POST /api/generation/start-image-task/route.ts`。
  * 实现"读取-修改-写入"的逻辑来更新特定 `suggestion` 的状态。
  * 实现幂等性检查：只有当 `suggestion.status` 为 `'pending'` 时才执行操作。
* **验证**:
  * **单元/集成测试**: 使用阶段二中获得的 `jobId`，调用此新 API，参数为 `{ "jobId": "...", "suggestionIndex": 1 }`。
  * **手动数据检验**:
    * 第一次调用后，检查 KV，确认 `suggestions[1].status` 已更新为 `'generating_images'`。
    * **幂等性检验**: 再次使用相同的参数调用 API，检查 KV，确认 `Job` 对象没有发生任何变化。
    * 使用 `suggestionIndex: 2` 调用 API，确认 `suggestions[2].status` 被正确更新。

### 阶段四：前端状态管理重构

* **任务**:
  * 重构 `app/chat/hooks/useGeneration.ts`。
  * 将其内部状态模型更新为包含 `suggestions: Suggestion[]` 和 `currentSuggestionIndex: number`。
  * 重写 `onPollingUpdate` 逻辑以处理新的 `Job` 结构，并实现避免重复渲染的优化。
  * 创建 `selectNextSuggestion` 函数，该函数会递增 `currentSuggestionIndex` 并调用新的后端 API。
* **验证**:
  * **浏览器开发者工具**:
    * **Console**: 添加详细的 `console.log`，在页面加载和交互时，检查 `suggestions` 和 `currentSuggestionIndex` 状态是否如预期般更新。
    * **Network**: 确认在调用 `selectNextSuggestion` 时，向 `/api/generation/start-image-task` 的网络请求被正确发送。
    * **React DevTools**: 观察组件树，验证只有状态发生变化的 `SuggestionCard` 才发生重渲染。

### 阶段五：前端 UI 实现与端到端测试

* **任务**:
  * 创建 `app/chat/components/SuggestionCard.tsx` 组件，并用 `React.memo` 包裹。该组件需要能渲染 `suggestion` 的所有不同状态。
  * 修改 `app/chat/page.tsx`，使用重构后的 `useGeneration` hook，并循环渲染 `SuggestionCard` 列表。
  * 添加"换一套搭配"按钮，并将其 `onClick` 事件绑定到 `selectNextSuggestion` 函数。
* **验证**:
  * **端到端手动测试**:
    * **初始加载**: 页面应正确显示第一个建议的文字和加载动画。
    * **第一次点击**: "换一套搭配"后，第二个建议卡片出现，并显示其文字和加载动画。
    * **第二次点击**: 第三个建议卡片出现。
    * **最终状态**: "换一套搭配"按钮被禁用或隐藏。
    * **异步更新**: 确认当任何一个建议的图片生成完成后，对应的卡片会自动从加载动画切换为显示图片，且不影响其他卡片。
