## Image Provider 抽象设计（Kling 两步 + Gemini 一步）

### 目标
- 用统一 Provider 接口屏蔽差异：Kling 内部做「风格化 → 试穿」两步；Gemini 直接产出最终图。
- API 路由与 Pipeline 不关心具体厂商，仅依赖统一接口与事件。
- 支持通过请求参数或环境变量无缝切换 Provider。

### 模块与目录建议
- `lib/ai/providers/types.ts`: 通用类型与接口定义
- `lib/ai/providers/KlingProvider.ts`: 适配现有 Kling（内部两步）
- `lib/ai/providers/GeminiProvider.ts`: 新增 Gemini（一阶段直出）
- `lib/ai/providers/index.ts`: ProviderRegistry（选择与构造 Provider）
- `lib/ai/services/gemini.ts`: Gemini HTTP 细节封装
- API 层（如 `app/api/generation/new/route.ts`）仅选择 Provider + 透传进度事件

### 统一接口（关键）
```ts
// lib/ai/providers/types.ts
export type ProviderId = 'kling' | 'gemini';

export interface GenerationContext {
  jobId: string;
  suggestionIndex: number;
  humanImage: { url: string; name: string; type: string };
  garmentImage?: { url: string; name: string; type: string }; // Gemini 可能不需要
  suggestion?: any; // 包含 image_prompt / outfit_suggestion 等
  userId?: string;
}

export interface GenerateResult {
  finalImageUrls: string[];        // 最终可展示图（统一）
  stylizedImageUrls?: string[];    // 可选：Kling 中间图
  finalPrompt?: string;            // 统一回传，便于审计与复现
}

export type ProgressEvent =
  | { step: 'init' | 'submit' | 'poll' | 'save' | 'done'; message?: string }
  | { step: 'stylize_start' | 'stylize_done' | 'tryon_start' | 'tryon_done'; message?: string }; // Kling 专属

export type EmitProgress = (evt: ProgressEvent) => void;

export interface ImageGenProvider {
  id: ProviderId;
  generateFinalImages(ctx: GenerationContext, emit: EmitProgress): Promise<GenerateResult>;
}
```

### KlingProvider（复用现有两步实现）
- 直接复用：`KlingTaskHandler.runStylizationMultiple()`、`runVirtualTryOnMultiple()`（或 `lib/ai/services/kling.ts` 等价方法）。
- 在关键阶段发进度事件：
  - `stylize_start → stylize_done`，`tryon_start → tryon_done`
  - `submit/poll/save/done`（提交/轮询/持久化/结束）
- 返回：`{ finalImageUrls, stylizedImageUrls, finalPrompt }`

示意：
```ts
// lib/ai/providers/KlingProvider.ts
export class KlingProvider implements ImageGenProvider {
  id: ProviderId = 'kling';
  async generateFinalImages(ctx: GenerationContext, emit: EmitProgress) {
    emit({ step: 'init' });
    emit({ step: 'stylize_start' });
    // 调用 runStylizationMultiple → 得到 stylizedImageUrls & finalPrompt
    emit({ step: 'stylize_done' });

    emit({ step: 'tryon_start' });
    // 调用 runVirtualTryOnMultiple → 得到 finalImageUrls
    emit({ step: 'tryon_done' });

    emit({ step: 'save' });
    // 保存 Blob + 更新 KV
    emit({ step: 'done' });
    return { finalImageUrls: [], stylizedImageUrls: [], finalPrompt: '' };
  }
}
```

### GeminiProvider（一步直出）
- 仅一次 API 调用即可得到最终图：
  - 组装 prompt（可沿用当前统一策略，或按 Gemini 最佳实践精简）
  - 提交（必要时轮询）→ 保存（Blob 可选）→ 更新 KV
  - 发通用事件：`init/submit/poll/save/done`

示意：
```ts
// lib/ai/providers/GeminiProvider.ts
export class GeminiProvider implements ImageGenProvider {
  id: ProviderId = 'gemini';
  async generateFinalImages(ctx: GenerationContext, emit: EmitProgress) {
    emit({ step: 'init' });
    emit({ step: 'submit' });
    // 调用 services/gemini.ts → 返回 finalImageUrls
    emit({ step: 'poll' });
    // 若同步返回则可跳过轮询
    emit({ step: 'save' });
    // 保存 Blob + 更新 KV
    emit({ step: 'done' });
    return { finalImageUrls: [], finalPrompt: '' };
  }
}
```

### ProviderRegistry（选择策略）
```ts
// lib/ai/providers/index.ts
export function getProvider(id?: ProviderId): ImageGenProvider {
  if (id === 'gemini') return new GeminiProvider();
  return new KlingProvider();
}
```
- 选择来源：
  - 请求参数：`generation_provider=gemini|kling`
  - 环境变量：`IMAGE_PROVIDER=gemini|kling`（默认 `kling`）

### API 路由最小改动（以 /api/generation/new 为例）
```ts
// 伪代码片段：app/api/generation/new/route.ts
import { getProvider } from '@/lib/ai/providers';

const providerId = (formData.get('generation_provider') as ProviderId)
  || (process.env.IMAGE_PROVIDER as ProviderId) || 'kling';
const provider = getProvider(providerId);

// 构造 ctx，封装 emitSse → 转换为统一的 SSE 事件
const result = await provider.generateFinalImages(ctx, emitSse);
```

### 事件与兼容性
- 建议标准化 SSE：`init/submit/poll/save/done`。
- Kling 专属的 `stylize_* / tryon_*` 为可选扩展；前端可按需监听，默认仅依赖通用事件。

### 错误与重试
- 定义 `ProviderError`（包含 `providerId/httpStatus/businessCode/message`）。
- 将 Kling 与 Gemini 原生错误映射为统一错误，API 层统一上报与重试策略（指数回退、限次）。

### 配置与密钥
- 通过环境变量隔离：
  - `IMAGE_PROVIDER`（默认 `kling`）
  - 保持各自命名空间：Kling/Gemini 各自的 ACCESS/SECRET。

### 推进路径（最小风险）
1) 封装 `KlingProvider`（复用现有逻辑），API 路由切到 Provider 调用，功能零差异。
2) 实现 `GeminiProvider` 与 `services/gemini.ts`，允许通过参数或 env 切换。
3) 前端仅消费统一 SSE；如需细粒度进度，兼容 Kling 扩展事件。
4) 视需要清理旧直连路由（如 `app/api/generate/route.ts`）或保留为备份。

### 可扩展性
- 新增第三方 Provider 仅需：实现 `ImageGenProvider` → 在 Registry 注册 → API 路由无需改动。


