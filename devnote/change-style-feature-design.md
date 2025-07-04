# "换一套搭配风格"功能设计文档

## 核心思路

### 问题背景

用户在看到第一套搭配的场景预览后，如果不满意，目前只能选择"不喜欢这套搭配"来取消整个生成流程。这导致用户需要重新开始整个流程，体验不佳，且浪费了已经生成的 AI 建议。

### 解决方案

**预生成多套方案策略**：在初始 OpenAI 调用时一次性生成3套完全不同风格的搭配建议，然后按需使用：

- 默认使用第一套搭配进行图像生成
- 用户不满意时，直接使用第二套、第三套搭配
- 避免重复调用 OpenAI API，提高响应速度
- 提供更丰富的用户选择

## 核心设计原则

1. **向后兼容**：由于项目处于开发阶段且 Job 数据为临时数据，采用最小化兼容处理
2. **重用现有逻辑**：最大程度复用现有的 pipeline 和状态管理逻辑
3. **渐进式降级**：当多套建议用完后，引导用户重新开始

## 数据结构变更

### 当前结构

```typescript
// Job 接口
export interface Job {
  suggestion?: {
    outfit_suggestion: any; // 单个搭配
    image_prompt: string;   // 单个提示
  };
}

// OpenAI Schema
const styleSuggestionsSchema = z.object({
  outfit_suggestion: outfitSuggestionSchema,
  image_prompt: z.string()
});
```

### 新结构

```typescript
// 更新后的 Job 接口
export interface Job {
  suggestions?: {
    outfit_suggestions: any[]; // 3个搭配数组
    image_prompts: string[];   // 3个提示数组
    currentIndex: number;      // 当前使用的索引 (0-2)
    usedIndices: number[];     // 已使用的索引记录
  };
  // 保持向后兼容
  suggestion?: {
    outfit_suggestion: any;
    image_prompt: string;
  };
}

// 更新后的 OpenAI Schema
const styleSuggestionsSchema = z.object({
  outfit_suggestions: z.array(outfitSuggestionSchema).length(3),
  image_prompts: z.array(z.string()).length(3)
});
```

## 流程变更

### 当前流程

1. 用户上传图片 → 2. OpenAI 生成1套建议 → 3. 图像生成 → 4. 用户查看结果

### 新流程

1. 用户上传图片
2. **OpenAI 生成3套不同风格建议**
3. 使用第一套建议进行图像生成
4. 用户查看场景预览
5. **用户选择**：
   - "继续生成最终效果" → 继续当前流程
   - "换一套搭配风格" → 使用下一套建议重新生成
   - "不喜欢这套搭配" → 取消整个流程

### Quick Reply 选项更新

```typescript
// 场景预览后的选项
metadata: {
  suggestions: [
    "继续生成最终效果",
    "换一套搭配风格",     // 新增
    "不喜欢这套搭配",
    "重新生成场景"
  ]
}
```

## 状态管理设计

### 1. Job 状态扩展

```typescript
// 新增状态
type JobStatus =
  | "pending"
  | "suggestion_generated"
  | "stylization_completed"
  | "succeed"
  | "failed"
  | "cancelled"
  | "regenerating_style";  // 新增：正在使用新风格重新生成

// 状态转换
"suggestion_generated" → "stylization_completed" → "regenerating_style" → "stylization_completed"
```

### 2. 前端状态管理

```typescript
// Chat 组件新增状态
const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
const [availableSuggestions, setAvailableSuggestions] = useState<number>(3);

// 处理换风格请求
const handleChangeStyle = async () => {
  if (currentSuggestionIndex >= 2) {
    // 已用完所有建议
    showRestartPrompt();
    return;
  }

  await triggerStyleRegeneration(currentSuggestionIndex + 1);
  setCurrentSuggestionIndex(prev => prev + 1);
};
```

### 3. 向后兼容处理

```typescript
// 在读取 Job 数据时进行兼容处理
const getJobSuggestion = (job: Job, index: number = 0) => {
  // 新格式
  if (job.suggestions?.outfit_suggestions) {
    return {
      outfit_suggestion: job.suggestions.outfit_suggestions[index],
      image_prompt: job.suggestions.image_prompts[index]
    };
  }

  // 旧格式兼容
  if (job.suggestion) {
    return job.suggestion;
  }

  throw new Error("No suggestion data found");
};
```

## 核心函数修改

### 1. OpenAI 调用修改

```typescript
// lib/prompts.ts - 更新 system prompt
"Generate 3 completely different outfit suggestions with distinct styles,
occasions, and aesthetics. Each should offer a unique fashion direction."

// lib/ai.ts - 更新 schema 和处理逻辑
const styleSuggestionsSchema = z.object({
  outfit_suggestions: z.array(outfitSuggestionSchema).length(3),
  image_prompts: z.array(z.string()).length(3)
});
```

### 2. Pipeline 函数适配

```typescript
// 所有 pipeline 函数添加 suggestionIndex 参数
export async function executeSimpleScenePipeline(
  job: Job,
  suggestionIndex: number = 0
): Promise<string[]> {
  const suggestion = getJobSuggestion(job, suggestionIndex);
  // 其余逻辑保持不变
}
```

### 3. 新增 API 端点

```typescript
// /api/generation/change-style
export async function POST(request: Request) {
  const { jobId, suggestionIndex } = await request.json();

  // 验证索引有效性
  if (suggestionIndex < 0 || suggestionIndex > 2) {
    return NextResponse.json({ error: "Invalid suggestion index" });
  }

  // 更新 Job 状态并触发重新生成
  await kv.hset(jobId, {
    'suggestions.currentIndex': suggestionIndex,
    status: 'regenerating_style',
    statusMessage: '正在生成新的搭配风格...'
  });

  // 触发对应的 pipeline
  return NextResponse.json({ success: true });
}
```

## 用户体验流程

### 场景1：用户满意第一套搭配

```
用户上传图片 → 生成3套建议 → 显示第一套场景预览 → 用户选择"继续生成" → 完成流程
```

### 场景2：用户要换风格

```
显示第一套预览 → 用户选择"换一套搭配风格" → 使用第二套建议重新生成 → 显示新预览
```

### 场景3：用户用完所有建议

```
第三套预览 → 用户仍选择"换风格" → 系统提示"已尝试所有风格，建议重新开始" → 引导回首页
```

## 实现优先级

### Phase 1: 核心功能

1. 更新 OpenAI schema 生成3套建议
2. 修改 Job 数据结构
3. 添加向后兼容逻辑
4. 更新 Quick Reply 选项

### Phase 2: 状态管理

1. 新增 API 端点处理风格切换
2. 更新前端状态管理
3. 修改 polling 逻辑处理新状态

### Phase 3: 用户体验优化

1. 添加风格切换的过渡动画
2. 优化错误处理和边界情况
3. 添加使用统计和分析

## 风险评估

### 低风险

- 数据结构变更（项目处于开发阶段）
- 向后兼容（Job 数据为临时数据）

### 中等风险

- OpenAI API 调用成本增加（3套建议 vs 1套）
- 响应时间可能增加（生成3套建议）

### 缓解措施

- 监控 OpenAI API 使用量和成本
- 优化 prompt 减少不必要的详细信息
- 考虑实现建议缓存机制

## 成功指标

1. **用户体验**：用户完成搭配流程的成功率提升
2. **效率**：减少用户重新开始流程的次数
3. **满意度**：用户对最终搭配结果的满意度提升
4. **技术指标**：API 调用次数减少，响应时间保持合理范围

## 技术实现细节

### 现有代码影响分析

#### 高风险区域需要修改

1. **`getStyleSuggestionFromAI` 函数** (lib/ai.ts)
   - 需要修改 schema 从单个建议改为3个建议数组
   - 更新 system prompt 要求生成3套不同风格

2. **`displaySuggestionSequentially` 函数** (app/chat/page.tsx)
   - 当前依赖 `suggestion.outfit_suggestion`
   - 需要适配新的数据结构 `suggestions.outfit_suggestions[index]`

3. **Pipeline 函数** (lib/ai.ts)
   - `executeSimpleScenePipeline`
   - `executeAdvancedScenePipeline`
   - `executeSimpleScenePipelineV2`
   - 需要添加 `suggestionIndex` 参数支持

4. **`startPolling` 函数** (app/chat/page.tsx)
   - 需要处理新的 Quick Reply "换一套搭配风格"
   - 需要跟踪当前使用的建议索引

#### 需要新增的组件

1. **API 端点**: `/api/generation/change-style`
2. **前端状态**: `currentSuggestionIndex`, `availableSuggestions`
3. **兼容函数**: `getJobSuggestion(job, index)`

### 向后兼容策略

由于项目处于开发阶段且 Job 数据为临时数据，采用最小化兼容处理：

```typescript
// 简单的运行时检查和适配
const getJobSuggestion = (job: Job, index: number = 0) => {
  if (job.suggestions?.outfit_suggestions) {
    // 新格式
    return {
      outfit_suggestion: job.suggestions.outfit_suggestions[index],
      image_prompt: job.suggestions.image_prompts[index]
    };
  }

  if (job.suggestion) {
    // 旧格式兼容
    return job.suggestion;
  }

  throw new Error("No suggestion data found");
};
```

### 部署策略

1. **阶段1**: 更新后端数据结构和 OpenAI 调用
2. **阶段2**: 更新前端组件适配新数据结构
3. **阶段3**: 添加新的 API 端点和前端交互逻辑
4. **阶段4**: 测试和优化用户体验

这个设计既解决了用户体验问题，又最大程度地重用了现有架构，是一个平衡的技术方案。



//todo： final image继续生成