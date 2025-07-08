# Chat 页面重构计划

## 当前状况

- **文件大小**: 1912 行，72KB
- **问题**: 违反了项目规则（超过600行限制）
- **架构问题**: 单一巨型组件，包含过多职责

## 重构目标

将单一的1912行组件拆分为模块化、可维护的架构，遵循单一职责原则。

## 分析现有代码结构

### 1. 类型定义 (约50行)

```typescript
type ChatMessage = { ... }
type ChatModeData = { ... }
type ChatStep = "suggestion" | "generating" | "complete" | "error"
```

### 2. 常量定义 (约80行)

```typescript
const styles = [...]
const stylePrompts = {...}
```

### 3. 工具函数 (约100行)

```typescript
const createChatMessage = (...)
const generateUniqueId = ()
const getOccasionName = (occasionId: string)
const getFileFromPreview = async (...)
```

### 4. UI组件 (约200行)

```typescript
function QuickReplyButtons({...})
function AIAvatar()
function ChatBubble({...})
```

### 5. 自定义Hooks逻辑 (约500行)

- 状态管理
- 图片处理
- 消息处理
- 轮询逻辑
- 生成流程控制

### 6. 主组件逻辑 (约900行)

- 事件处理
- 渲染逻辑
- 副作用处理

## 重构方案

### Step 1: 创建类型定义文件

**目标文件**: `app/chat/types.ts`

```typescript
// 导出所有聊天相关的类型定义
export type ChatMessage = { ... }
export type ChatModeData = { ... }
export type ChatStep = "suggestion" | "generating" | "complete" | "error"
```

### Step 2: 创建常量配置文件
好的请帮我把目前的change 总结一下 submit
**目标文件**: `app/chat/constants.ts`

```typescript
// 导出样式配置和提示词
export const styles = [...]
export const stylePrompts = {...}
```

### Step 3: 创建工具函数文件

**目标文件**: `app/chat/utils.ts`

```typescript
// 导出纯函数工具
export const createChatMessage = (...)
export const generateUniqueId = ()
export const getOccasionName = (occasionId: string)
export const getFileFromPreview = async (...)
```

### Step 4: 拆分UI组件

**目标文件结构**:

```
app/chat/components/
├── QuickReplyButtons.tsx     (约30行)
├── AIAvatar.tsx             (约15行)
├── ChatBubble.tsx           (约120行)
├── StatusIndicator.tsx      (约40行)
├── ChatInput.tsx            (约80行)
├── DebugPanel.tsx           (约60行)
└── index.ts                 (导出文件)
```

### Step 5: 创建自定义Hooks

**目标文件结构**:

```
app/chat/hooks/
├── useChat.ts               (聊天状态管理，约150行)
├── useImageHandling.ts      (图片处理逻辑，约100行)
├── useGeneration.ts         (生成流程控制，约200行)
├── usePolling.ts            (轮询逻辑，约100行)
├── useSessionManagement.ts  (会话管理，约50行)
└── index.ts                 (导出文件)
```

### Step 6: 重构主页面组件

**目标文件**: `app/chat/page.tsx` (约200-300行)

```typescript
// 仅保留页面级别的组合逻辑和布局
export default function ChatPage() {
  // 使用各种hooks
  // 组合各种组件
  // 处理页面级别的路由和状态
}
```

## 详细实施步骤

### Phase 1: 基础重构 (不破坏现有功能)

1. **Step 1**: 在现有文件中添加注释标记各个部分
2. **Step 2**: 创建 `types.ts` 并移动类型定义
3. **Step 3**: 创建 `constants.ts` 并移动常量
4. **Step 4**: 创建 `utils.ts` 并移动纯函数

### Phase 2: 组件拆分

5. **Step 5**: 拆分 `QuickReplyButtons` 组件
6. **Step 6**: 拆分 `AIAvatar` 组件
7. **Step 7**: 拆分 `ChatBubble` 组件
8. **Step 8**: 拆分 `StatusIndicator` 组件
9. **Step 9**: 拆分 `ChatInput` 组件
10. **Step 10**: 拆分 `DebugPanel` 组件

### Phase 3: Hooks抽取

11. **Step 11**: 创建 `useSessionManagement` hook
12. **Step 12**: 创建 `useImageHandling` hook
13. **Step 13**: 创建 `usePolling` hook
14. **Step 14**: 创建 `useGeneration` hook
15. **Step 15**: 创建 `useChat` hook

### Phase 4: 主组件精简

16. **Step 16**: 重构主页面组件，整合所有hooks和组件
17. **Step 17**: 清理和优化导入语句
18. **Step 18**: 添加适当的错误边界和加载状态

## 预期结果

### 文件大小分布

- `page.tsx`: ~250行 (符合规则)
- `components/*`: 每个组件 15-120行
- `hooks/*`: 每个hook 50-200行
- `utils.ts`: ~100行
- `types.ts`: ~50行
- `constants.ts`: ~80行

### 架构优势

1. **可维护性**: 每个文件职责单一，易于理解和修改
2. **可复用性**: 组件和hooks可以在其他地方复用
3. **可测试性**: 独立的函数和组件更容易单元测试
4. **团队协作**: 多人可以同时工作在不同的模块上
5. **性能优化**: 更细粒度的组件更新和懒加载

## 风险评估

- **低风险**: 类型定义、常量、工具函数的抽取
- **中风险**: UI组件的拆分，需要确保props传递正确
- **高风险**: Hooks的抽取，需要仔细处理状态依赖和副作用

## 验证计划

1. 每个步骤完成后运行完整测试
2. 确保聊天功能完全正常
3. 确保图片上传和生成功能正常
4. 确保轮询和状态更新正常
5. 性能测试确保没有回归

## 时间估算

- Phase 1: 2-3小时
- Phase 2: 4-5小时
- Phase 3: 6-8小时
- Phase 4: 2-3小时
- **总计**: 14-19小时

## 注意事项

1. 保持现有的功能完全不变
2. 确保所有的状态管理逻辑正确迁移
3. 注意React hooks的依赖关系
4. 保持良好的TypeScript类型安全
5. 遵循项目的代码风格和命名约定
