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

| 字段    | 类型   | 描述                           | 是否必须 |
|---------|--------|--------------------------------|----------|
| `image` | File   | 用户上传的图片。               | 是       |
| `style` | string | 用户选择的风格 (例如, "casual")。 | 是       |

#### 成功响应 (200 OK)

后端将返回一个包含新生成图片 URL 的 JSON 对象。

```json
{
  "imageUrl": "https://path.to/generated-image.png"
}
```

#### 错误响应

- **400 Bad Request**: 如果请求中缺少 `image` 或 `style` 字段。
  ```json
  {
    "error": "缺少图片或风格参数"
  }
  ```
- **500 Internal Server Error**: 如果服务器发生任何意外错误，包括与外部 AI 服务通信失败。
  ```json
  {
    "error": "生成图片失败"
  }
  ```

## 4. 逻辑与数据流

1.  **请求发起**: 用户在前端点击"生成我的造型"按钮。客户端代码构建一个 `FormData` 对象，并向 `/api/generate` 发起一个 `POST` 请求。
2.  **请求处理**: 位于 `app/api/generate/route.ts` 的 Next.js API Route 接收到该请求。
3.  **输入验证**: 处理函数首先验证 `FormData`，确保 `image` 和 `style` 都存在。如果不存在，则返回 400 错误。
4.  **与外部 AI 服务通信**:
    - 处理函数准备一个新的请求，用于发送给外部的 AI 图像生成服务（例如 Replicate, Midjourney 或自定义模型）。
    - 用户的图片被附加到这个新请求中。
    - 用于外部服务的 API 密钥从环境变量 (`process.env.AI_SERVICE_API_KEY`) 中检索，以确保它不会在客户端暴露。
5.  **响应转发**:
    - 从 AI 服务收到成功响应后，处理函数会提取生成的图片 URL。
    - 然后，它向前端发送一个 200 OK 的 JSON 响应，其中包含此 URL。
6.  **错误处理**: 如果与 AI 服务的通信失败或发生任何其他服务器端错误，处理函数会捕获异常，记录错误以供调试，并向前端返回 500 错误。

## 5. 安全性与可扩展性

- **API 密钥管理**: 所有用于外部服务的密钥**必须**存储在环境变量中（例如，在根目录的 `.env.local` 文件中），并通过 `process.env` 访问。它们绝不能被硬编码或暴露给客户端。
- **可扩展性**: 由于 Next.js API Routes 是作为无服务器函数运行的（在 Vercel 等平台上），后端将根据需求自动扩展。无需管理服务器。
- **数据传输**: 使用 `FormData` 是处理从客户端到服务器文件传输的一种高效方式。

## 6. 实施计划

1.  创建一个新文件: `app/api/generate/route.ts`。
2.  在此文件中，根据上述逻辑实现 `POST` 处理函数。
3.  在项目根目录添加一个 `.env.local` 文件，用于存储 AI 服务的 API 密钥。
4.  更新前端组件（`app/page.tsx` 或其子组件），使其能够调用新的 API 端点。
