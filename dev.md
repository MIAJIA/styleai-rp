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

这是该功能所需的唯一端点。

- **方法**: `POST`
- **内容类型 (Content-Type)**: `multipart/form-data` (用于处理文件上传)

#### 请求体

前端将发送一个 `FormData` 对象，其中包含：

| 字段            | 类型   | 描述                               | 是否必须 |
|-----------------|--------|------------------------------------|----------|
| `human_image` | File   | 用户的肖像图片 (全身、正面)。      | 是       |
| `garment_image`  | File   | 要试穿的服装图片 (平铺或上身图)。  | 是       |

#### 成功响应 (200 OK)

后端将 **立即** 返回一个包含任务ID的JSON对象，表示生成任务已成功提交。

```json
{
  "taskId": "some-unique-task-id-from-kling"
}
```

#### 错误响应

- **400 Bad Request**: 如果请求中缺少 `human_image` 或 `garment_image` 字段。
  ```json
  {
    "error": "缺少肖像或服装图片"
  }
  ```
- **500 Internal Server Error**: 如果向Kling AI提交任务时发生错误。
  ```json
  {
    "error": "提交生成任务失败"
  }
  ```

### 新增端点: `POST /api/webhook`

这个端点用于接收来自Kling AI服务的回调。

- **方法**: `POST`
- **验证**: 需要验证请求是否真的来自Kling AI（例如，通过一个共享的密钥）。

#### 请求体 (由Kling AI发送)

```json
{
  "task_id": "some-unique-task-id-from-kling",
  "status": "succeeded",
  "image_url": "https://path.to/generated-image.png"
}
```

## 4. 逻辑与数据流 (异步模型)

1.  **请求发起**: 用户在前端点击"生成我的造型"按钮。客户端代码构建一个 `FormData` 对象，并向 `/api/generate` 发起一个 `POST` 请求。
2.  **任务提交 (`/api/generate`)**:
    - `/api/generate` 端点接收到前端的图片。
    - 它将这些图片上传到一个临时的公共可访问地址（例如，AWS S3或Vercel Blob Storage），因为Kling AI需要URL作为输入。
    - 它调用 Kling AI 的 `kolors-virtual-try-on` API，请求体中包含两个图片的URL和一个 `webhook_url` (指向我们自己的 `/api/webhook`)。
    - Kling AI 接收任务并立即返回一个 `task_id`。
    - `/api/generate` 将这个 `task_id` 返回给前端。
3.  **前端等待**: 前端收到 `task_id` 后，进入等待状态。它可以开始轮询（Polling）一个用于获取结果的API，或者通过WebSocket等待服务器的推送。
4.  **AI处理与回调**: Kling AI 在后台完成图像生成。完成后，它会向我们在步骤2中提供的 `/api/webhook` 地址发送一个`POST`请求，其中包含了 `task_id` 和最终的 `image_url`。
5.  **结果处理 (`/api/webhook`)**:
    - `/api/webhook` 端点接收到回调。
    - 它将 `task_id` 和 `image_url` 存入数据库或缓存中，以便前端可以查询。
    - (可选) 如果使用了WebSocket，服务器会通过它将 `image_url` 直接推送给对应的客户端。
6.  **前端获取结果**: 前端通过轮询或WebSocket接收到 `image_url` 后，更新UI，将用户重定向到结果页并显示图片。

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

## 6. 安全性与可扩展性

- **API 密钥管理**: 所有用于外部服务的密钥（特别是 `KLING_AI_API_KEY`）**必须**存储在环境变量中（例如，在根目录的 `.env.local` 文件中），并通过 `process.env` 访问。
- **Webhook安全**: `/api/webhook` 端点必须被保护，以防止恶意调用。可以通过在Kling AI请求中设置一个共享密钥（`webhook_secret`）并在收到回调时进行验证来实现。
- **临时文件存储**: 上传的图片需要一个临时的公共存储。Vercel Blob Storage 或 AWS S3 是很好的选择，并且应该配置生命周期规则，在处理完成后自动删除这些临时文件。
- **可扩展性**: 异步架构非常适合这种耗时操作，它不会阻塞服务器进程，具有很好的可扩展性。

## 7. 实施计划

1.  **配置云存储**: 设置一个对象存储服务（如Vercel Blob）用于临时存放用户上传的图片。
2.  **创建 `/api/generate/route.ts`**: 实现任务提交逻辑。
3.  **创建 `/api/webhook/route.ts`**: 实现接收Kling AI回调的逻辑。
4.  **修改前端页面**:
    -   更新 `app/page.tsx` 以调用 `/api/generate`，并在获取到 `task_id` 后处理等待逻辑。
    -   更新 `app/results/page.tsx` 以显示最终的图片，并实现 `localStorage` 的读取和写入逻辑来管理历史记录。
5.  **添加环境变量**: 在 `.env.local` 文件中添加 `KLING_AI_API_KEY` 和云存储相关的密钥。
