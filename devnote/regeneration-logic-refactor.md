### **重构计划：统一图片生成逻辑**

#### **1. 问题背景与目标**

**问题描述:**
在之前的代码清理中，我们发现了一个潜在的架构问题：系统中存在两套独立的图片"重新生成"逻辑。

1. 一套位于 `app/api/generation/start/route.ts` (在`runImageGenerationPipeline`函数内)。
2. 另一套位于 `app/api/generation/change-style/route.ts` (在`triggerRegeneration`函数内)。

当我们修复了其中一套逻辑（在`start`路由中）而未同步修改另一套时，导致用户点击"换一套搭配风格"（调用`change-style`路由）时，出现了图片错位的BUG。这是典型的代码重复（违反DRY原则）所导致的问题。

**重构目标:**

* **修复BUG：** 彻底解决因逻辑不一致导致的图片错位问题。
* **统一逻辑：** 将所有图片生成（包括首次生成和风格切换）的执行逻辑统一到一个地方。
* **提高可维护性：** 确保未来对生成流程的任何修改都只需要在一处进行，避免同样的错误再次发生。

---

#### **2. 方案设计 (最小化改动)**

这个方案的核心是 **"代码搬家"** 而不是 **"代码重写"**。我们把已经验证过、能正确工作的逻辑，移动到一个公共的地方，然后让所有需要它的地方都来调用它。

**Phase 1: 逻辑集中化 (Centralize)**

* **任务 1.1: 移动 `runImageGenerationPipeline` 函数**
  * **操作:** 将 `runImageGenerationPipeline` 整个函数从 `app/api/generation/start/route.ts` 文件中剪切出来。
  * **操作:** 将其粘贴到 `lib/ai.ts` 文件的末尾，并添加 `export` 关键字，使其可以被外部调用。

        ```typescript
        // lib/ai.ts
        // ... (existing code) ...
        export async function runImageGenerationPipeline(jobId: string) {
          // ... (the entire function logic) ...
        }
        ```

  * **风险分析:** 低风险。这只是文件位置的移动。函数本身的功能、输入和输出都没有改变。
  * **如何避免过度工程化:** 我们没有引入新的抽象层或设计模式。仅仅是把一个独立的函数放到了更合理的公共模块(`lib/ai.ts`)中，这是非常标准的重构实践。

**Phase 2: 重构API端点 (Refactor Callers)**

* **任务 2.1: 更新 `start` 路由**
  * **文件:** `app/api/generation/start/route.ts`
  * **操作:** 在文件顶部，从 `lib/ai` 导入 `runImageGenerationPipeline` 函数。

        ```typescript
        import {
          // ... other imports
          runImageGenerationPipeline,
        } from '@/lib/ai';
        ```

  * **风险分析:** 低风险。我们只是改变了函数的调用来源，从本地调用变成了导入调用。

* **任务 2.2: 更新 `change-style` 路由**
  * **文件:** `app/api/generation/change-style/route.ts`
  * **操作:**
        1. **删除** 文件内整个的 `triggerRegeneration` 函数。这是重复的、有问题的逻辑，将被彻底移除。
        2. 在文件顶部，从 `lib/ai` 导入 `runImageGenerationPipeline` 函数。
        3. 将原先调用 `triggerRegeneration(jobId)` 的地方，改为调用 `runImageGenerationPipeline(jobId)`。
  * **风险分析:** 中等风险，因为我们在替换一段核心逻辑。但由于我们替换的是 **已知能正确工作的逻辑**，风险是可控的。这是本次重构最关键的一步。
  * **如何避免过度工程化:** 我们是在删除代码，而不是增加代码。代码总量会减少，重复逻辑被消除，这是简化的直接体现。

---

#### **3. 验证计划 (确保无新BUG)**

在完成上述代码修改后，我们将执行以下端到端测试，以确保功能正确且没有引入新问题。

1. **测试场景一：首次生成**
    * **操作:** 发起一个全新的生成请求。
    * **预期结果:**
        * UI正常显示建议和图片。
        * KV数据库中的任务状态流转正确 (`pending` -> `suggestion_generated` -> `completed`)。
        * 最终生成的图片与第一个建议匹配。
        * 控制台日志显示 `runImageGenerationPipeline` 被调用，且没有错误。

2. **测试场景二：切换风格**
    * **操作:** 在首次生成成功后，点击"换一套搭配风格"按钮，选择第二个建议。
    * **预期结果:**
        * UI中出现新的建议消息，并正确显示加载状态。
        * KV数据库中的任务状态流转正确 (`completed` -> `regenerating_style` -> `completed`)。
        * **关键验证点：** 最终生成的新图片 **必须** 与第二个建议匹配，而不是覆盖第一个建议的图片。
        * 控制台日志再次显示 `runImageGenerationPipeline` 被调用，且没有错误。
    * **操作:** 再次点击按钮，选择第三个建议，重复验证。

---

#### **4. 总结**

这个计划通过一次聚焦的、最小化的重构，遵循了DRY原则，旨在从根本上解决问题，而不是打补丁。它的目标是让代码更简单、更健壮。
