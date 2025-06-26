# StyleAI-RP: AI时尚穿搭推荐平台

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/jiameng1991-gmailcoms-projects/v0-fasionapp)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Powered by OpenAI](https://img.shields.io/badge/Powered%20by-OpenAI-green?style=for-the-badge&logo=openai)](https://openai.com/)

> 一个基于AI的个性化时尚穿搭推荐平台，通过智能对话和图像分析为用户提供专业的穿搭建议。

## ✨ 特性亮点

- 🤖 **AI智能对话** - 基于大语言模型的穿搭顾问
- 📸 **图像分析** - 上传照片获取个性化穿搭建议
- 🎨 **风格管理** - 个人风格库和搭配历史
- 👤 **用户引导** - 新用户友好的引导流程
- 📱 **响应式设计** - 支持多设备访问
- ⚡ **实时交互** - 流畅的用户体验

## 🚀 在线体验

**生产环境**: [https://vercel.com/jiameng1991-gmailcoms-projects/v0-fasionapp](https://vercel.com/jiameng1991-gmailcoms-projects/v0-fasionapp)

## 🛠️ 技术栈

### 前端

- **Next.js 15.2.4** - React全栈框架
- **React 19** - 用户界面库
- **TypeScript** - 类型安全的JavaScript
- **Tailwind CSS** - 原子化CSS框架
- **Radix UI** - 无障碍组件库

### 后端

- **Next.js API Routes** - 服务端API
- **Vercel KV** - Redis数据库
- **Vercel Blob** - 文件存储
- **OpenAI API** - AI模型服务

### 开发工具

- **ESLint & Prettier** - 代码质量和格式化
- **Zod** - 数据验证
- **React Hook Form** - 表单管理

## 🏗️ 项目结构

\`\`\`
styleai-rp/
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   ├── chat/              # 聊天页面
│   ├── my-style/          # 个人风格管理
│   ├── onboarding/        # 用户引导
│   └── ...
├── components/            # 共享组件
├── lib/                   # 工具函数
├── public/                # 静态资源
├── docs/                  # 项目文档
└── styles/                # 全局样式
\`\`\`

## 📚 详细文档

完整的项目文档请查看 [docs](./docs/) 目录：

- 📋 **[项目结构概览](./docs/project-structure-overview.md)** - 完整架构说明
- 🏗️ **[系统设计](./docs/system-design.md)** - 系统架构设计
- 💬 **[聊天室设计](./docs/chat-room-design.md)** - AI聊天功能设计
- 🚀 **[部署指南](./docs/deployment-guide.md)** - 部署和环境配置

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 本地开发

1. **克隆项目**

\`\`\`bash
git clone <repository-url>
cd styleai-rp
\`\`\`

2. **安装依赖**

\`\`\`bash
npm install
# 或
pnpm install
\`\`\`

3. **环境配置**

\`\`\`bash
cp .env.local.example .env.local
# 编辑 .env.local 添加必要的API密钥
\`\`\`

4. **启动开发服务器**

\`\`\`bash
npm run dev
# 或
pnpm dev
\`\`\`

5. **访问应用**
打开 [http://localhost:3000](http://localhost:3000) 查看应用

### 构建部署

\`\`\`bash
npm run build
npm start
\`\`\`

## 🎯 核心功能

### 🤖 AI对话助手

- 智能穿搭建议
- 多轮对话支持
- 上下文理解

### 📸 图像分析

- 照片上传和分析
- 风格识别
- 色彩搭配建议

### 👤 个人中心

- 用户账户管理
- 个人风格库
- 搭配历史记录

### 🎨 风格管理

- 风格偏好设置
- 个性化推荐
- 风格趋势分析

## 🛣️ 开发路线图

### ✅ 已完成

- [x] 基础UI框架搭建
- [x] 用户认证系统
- [x] AI对话功能
- [x] 图片上传分析
- [x] 用户引导流程

### 🚧 进行中

- [ ] 聊天室功能升级
- [ ] 实时消息推送
- [ ] 风格管理优化
- [ ] 移动端适配

### 📋 计划中

- [ ] 语音交互
- [ ] 社交分享
- [ ] 个性化推荐算法
- [ ] 多语言支持

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 和 Prettier 规则
- 编写必要的测试用例
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

- **项目问题**: [GitHub Issues](https://github.com/your-repo/issues)
- **功能建议**: [Discussions](https://github.com/your-repo/discussions)
- **邮箱联系**: [your-email@example.com](mailto:your-email@example.com)

## 🙏 致谢

- [Next.js](https://nextjs.org/) - 强大的React框架
- [OpenAI](https://openai.com/) - 提供AI模型支持
- [Vercel](https://vercel.com/) - 优秀的部署平台
- [Radix UI](https://www.radix-ui.com/) - 无障碍组件库
- [Tailwind CSS](https://tailwindcss.com/) - 实用的CSS框架

---

**维护者**: StyleAI Team
**最后更新**: 2024年12月
