
# 架构决策记录：客户端直传方案

**日期**: 2025年7月8日

## 1. 问题背景

在将耗时的AI调用从 `/api/generation/start` 接口移出以解决Heroku的H12（30秒）超时问题后，我们在Vercel部署上遇到了更长时间的504（300秒）超时错误。

这表明，即使没有AI计算，仅文件上传步骤本身在某些情况下（如大文件、慢网络）就可能持续超过5分钟，这暴露了当前架构的根本性瓶颈。

## 2. 根本原因分析

当前的流程是“服务器中转上传”：

1. 前端将图片文件发送到 `/api/generation/start`。
2. 后端的Serverless Function接收文件。
3. 后端**同步等待** (`await`) 将文件上传到Vercel Blob。
4. 上传完成后，后端才返回响应。

这个流程的瓶颈在于，后端函数的执行时间完全受制于文件上传的时间，上传多久，函数就运行多久，极易导致超时。

## 3. 解决方案：客户端直传 (Client-Side Direct Upload)

为了彻底解耦API响应时间和文件上传时间，我们决定采用客户端直传方案。这是处理云存储文件上传的行业标准实践。

### 新流程

1. **前端申请上传许可**: 用户点击生成后，前端调用一个新的、轻量的API，例如 `/api/generation/upload-token`。
2. **后端分发上传许可**: 该API向Vercel Blob请求一个临时的、安全的上传凭证（Pre-signed URL），并将其返回给前端。此过程耗时极短。
3. **前端直接上传**: 前端使用这个凭证，绕过我们的服务器，直接将图片文件从浏览器上传到Vercel Blob。这个过程的耗时完全由用户的网络和Vercel的服务器决定，不影响我们的后端服务。
4. **前端通知后端**: 上传成功后，前端会获得图片在云端的最终URL。然后，它再调用 `/api/generation/start` 接口，但这次只发送这两个URL字符串作为JSON数据。
5. **后端创建任务**: `/api/generation/start` 接口现在只处理轻量的URL数据，可以在几十毫秒内完成任务创建并返回响应。

## 4. 实施步骤

1. **创建新后端API (`/api/generation/upload-token`)**:
    * 使用 `@vercel/blob` SDK 的 `handleUpload` 或类似方法生成客户端上传所需的凭证。
2. **改造前端 (`app/chat/hooks/useGeneration.ts`)**:
    * 修改 `startGeneration` 函数的逻辑。
    * 集成 `@vercel/blob/client` 的 `upload` 函数来处理客户端上传。
    * 管理上传状态，并在成功后调用 `/api/generation/start`。
3. **改造 `/api/generation/start` 接口**:
    * 修改接口，使其不再接收 `FormData`，而是接收包含 `humanImageUrl` 和 `garmentImageUrl` 的JSON对象。
    * 移除所有文件处理和对Vercel Blob的 `put` 操作。

## 5. 预期收益

* **彻底解决超时问题**: `/api/generation/start` 的响应时间将从分钟级降低到毫秒级，根除Vercel 504和Heroku H12错误。
* **提升用户体验**: 前端可以实现精确的、实时的上传进度条。
* **优化服务器性能与成本**: 减少Serverless Function的执行时间和资源消耗，降低潜在费用。
