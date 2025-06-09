# File Structure

app
components
components.json
dev.md
hooks
lib
next-env.d.ts
next.config.mjs
node_modules
package.json
pnpm-lock.yaml
postcss.config.mjs
public
README.md
styles
tailwind.config.ts
tsconfig.json

./app:
about
components
globals.css
layout.tsx
loading.tsx
page.tsx
result
results

./app/about:
page.tsx

./app/components:
ios-header.tsx
ios-tab-bar.tsx
ios-upload.tsx
navigation.tsx
style-selector.tsx
upload-zone.tsx

./app/result:
page.tsx

./app/results:
page.tsx

./components:
theme-provider.tsx
ui

./components/ui:
accordion.tsx
alert-dialog.tsx
alert.tsx
aspect-ratio.tsx
avatar.tsx
badge.tsx
breadcrumb.tsx
button.tsx
calendar.tsx
card.tsx
carousel.tsx
chart.tsx
checkbox.tsx
collapsible.tsx
command.tsx
context-menu.tsx
dialog.tsx
drawer.tsx
dropdown-menu.tsx
form.tsx
hover-card.tsx
input-otp.tsx
input.tsx
label.tsx
menubar.tsx
navigation-menu.tsx
pagination.tsx
popover.tsx
progress.tsx
radio-group.tsx
resizable.tsx
scroll-area.tsx
select.tsx
separator.tsx
sheet.tsx
sidebar.tsx
skeleton.tsx
slider.tsx
sonner.tsx
switch.tsx
table.tsx
tabs.tsx
textarea.tsx
toast.tsx
toaster.tsx
toggle-group.tsx
toggle.tsx
tooltip.tsx
use-mobile.tsx
use-toast.ts

./hooks:
use-mobile.tsx
use-toast.ts

./lib:
utils.ts

./node_modules:
@hookform
@radix-ui
@types
autoprefixer
class-variance-authority
clsx
cmdk
date-fns
embla-carousel-react
input-otp
lucide-react
next
next-themes
postcss
react
react-day-picker
react-dom
react-hook-form
react-resizable-panels
recharts
sonner
tailwind-merge
tailwindcss
tailwindcss-animate
typescript
vaul
zod

./node_modules/@hookform:
resolvers

./node_modules/@radix-ui:
react-accordion
react-alert-dialog
react-aspect-ratio
react-avatar
react-checkbox
react-collapsible
react-context-menu
react-dialog
react-dropdown-menu
react-hover-card
react-label
react-menubar
react-navigation-menu
react-popover
react-progress
react-radio-group
react-scroll-area
react-select
react-separator
react-slider
react-slot
react-switch
react-tabs
react-toast
react-toggle
react-toggle-group
react-tooltip

./node_modules/@types:
node
react
react-dom

./public:
casual-chic-woman.png
casual-outfit.png
elegant-outfit.png
fashion-model-outfit.png
fashionable-woman-elegant-dress.png
placeholder-logo.png
placeholder-logo.svg
placeholder-user.jpg
placeholder.jpg
placeholder.svg
professional-woman.png
work-outfit.png

./styles:
globals.css

---

# 后端系统设计

## 1. 概述

本文档概述了"生成我的造型"功能的后端架构。该后端将使用 Next.js API Routes 实现，它在现有的 Next.js 应用中提供了一个无服务器函数（Serverless Function）环境。

该后端的主要职责是：
- 从前端接收一张图片和一个风格偏好。
- 安全地与外部的 AI 图像生成服务进行通信。
- 将生成后的图片 URL 返回给前端。

## 2. 技术栈

- **框架**: Next.js 14+
- **架构**: 无服务器函数 (通过 API Routes)
- **语言**: TypeScript

选择此方案是因为它简单、可扩展，并且能与前端无缝集成，将整个代码库保留在单个项目中。

## 3. API 端点设计

### 端点: `POST /api/generate`

这是该功能所需的**唯一**后端端点。它将作为一个长轮询（long-polling）函数工作。

- **方法**: `POST`
- **内容类型**: `multipart/form-data`

#### 请求体 (由前端发送)

| 字段            | 类型   | 描述                         | 是否必须 |
|-----------------|--------|------------------------------|----------|
| `human_image`   | File   | 用户的肖像图片。             | 是       |
| `garment_image` | File   | 要试穿的服装图片。           | 是       |

#### 成功响应 (200 OK)

后端在完成所有处理和轮询后，将 **直接** 返回一个包含最终图片URL的JSON对象。

\`\`\`json
{
  "imageUrl": "https://path.to/generated-image.png"
}
\`\`\`

#### 错误响应

- **400 Bad Request**: 如果请求中缺少图片。
- **500 Internal Server Error**: 如果处理过程中发生任何错误（包括AI生成超时）。

## 4. 逻辑与数据流 (简化同步模型)

1.  **请求发起**: 用户在前端点击"生成"按钮，将两张图片文件通过 `FormData` 发送到 `/api/generate`。
2.  **后端处理 (`/api/generate`)**:
    a. **接收与转换**: 后端接收图片文件，读取其内容并转换为 **Base64** 编码的字符串。
    b. **提交任务**: 调用 Kling AI API 提交生成任务，请求体中包含图片的Base64数据。Kling AI 立即返回一个 `task_id`。
    c. **后端轮询**: 后端服务进入一个循环，**代替前端进行轮询**。它会每隔几秒钟使用 `task_id` 调用 Kling AI 的状态查询接口。
    d. **获取结果**: 当状态查询接口返回"成功"时，后端从响应中提取最终的 `imageUrl`。
    e. **直接返回**: 后端将这个 `imageUrl` 作为对前端最初请求的响应，直接返回给前端。
3.  **前端等待与渲染**:
    -   前端在这整个过程中，只需要等待 `/api/generate` 这一个API请求返回结果。
    -   收到包含 `imageUrl` 的响应后，将其作为URL参数传递给结果页进行展示和 `localStorage` 存储。

## 5. 前端持久化方案 (无数据库)

为了在不使用后端数据库的情况下保存用户生成的历史记录，我们将采用浏览器的 `localStorage` 技术。

-   **技术选型**: `localStorage`
-   **存储内容**: 一个JSON字符串化的数组，包含所有生成图片的URL。
-   **键 (Key)**: `generatedLooks`

### 工作流程:

1.  **结果页加载**: 当 `/results` 页面加载时，它首先会从 `localStorage` 中读取 `generatedLooks` 键，并将其解析为图片URL数组，用于展示历史记录。
2.  **新图片抵达**: 当一个新的 `imageUrl` 通过URL参数传递到结果页时，该URL会被添加到现有图片数组的末尾。
3.  **更新存储**: 更新后的数组被再次JSON字符串化，并保存回 `localStorage` 的 `generatedLooks` 键中，从而实现持久化。

此方案确保了即使用户刷新页面或关闭浏览器，其生成历史也能被保留在当前设备和浏览器上。

## 6. 安全性与可扩展性 (简化版)

-   **API 密钥管理**: `KLING_AI_API_KEY` 依然必须存储在环境变量中。
-   **风险**: 此简化方案的主要风险在于 **服务器函数超时**。如果AI生成+后端轮询的总时长超过了平台限制（如Vercel免费版为10-15秒），请求将失败。**此风险在Demo阶段被认为是可接受的。**
-   **此方案不推荐用于生产环境**，生产环境应采用我们之前设计的、包含Webhook和独立存储的健壮异步架构。

## 7. 实施计划 (最简化Demo版)

1.  **环境变量配置**:
    -   创建 `.env.local` 文件。
    -   添加 `KLING_AI_API_KEY` 用于存放 Kling AI 的 API 密钥。

2.  **后端API实现**:
    -   创建并实现**唯一**的后端接口 `POST /api/generate/route.ts`。
    -   在该接口内完成接收文件、转换为Base64、提交任务给Kling AI、获取`task_id`、循环轮询任务状态、直到获取最终`imageUrl`并返回的全部逻辑。

3.  **前端实现**:
    -   更新 `app/page.tsx`，使其调用 `/api/generate` 接口，并耐心等待其返回最终结果。
    -   收到结果后，通过URL参数 `router.push(\`/results?imageUrl=\${imageUrl}\`)` 跳转。
    -   `app/results/page.tsx` 的逻辑保持不变：从URL参数读取`imageUrl`，并使用 `localStorage` 进行历史记录的存取和展示。


# 计划
1 修改主页 (app/page.tsx)，实现生成逻辑
找到页面上的“生成”按钮。
为其绑定一个新的 onClick 事件处理函数。
在该函数中，实现一个加载状态 (Loading State)，例如点击后按钮变为“生成中...”并禁用，同时可以在界面上显示一个加载指示器。
调用 fetch 函数向我们的后端端点 /api/generate 发送一个 POST 请求。
获取到后端返回的包含 Base64 图片数据的 JSON 响应。
2 实现生成结果的传递与展示
获取到 API 响应后，使用 Next.js 的 useRouter hook，将用户重定向到结果页 (/results)。
在重定向时，将获取到的 Base64 图片字符串作为URL查询参数（Query Parameter）传递过去。
修改结果页 (app/results/page.tsx)，使其不再使用硬编码的图片，而是从 URL 的查询参数中读取 Base64 数据，并将其作为 src 展示出来。
3 实现本地历史记录功能 (localStorage)
在成功获取并展示图片后（可以在结果页完成），将这张图片的 Base64 数据存入浏览器的 localStorage 中。
在主页 (app/page.tsx) 上，添加一小块UI，用于读取 localStorage 中的历史记录并将其展示为一个图片列表。
