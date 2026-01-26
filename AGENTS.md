# Project Context

## Code

<package.json>

{
  "name": "my-v0-project",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.12.3+sha512.467df2c586056165580ad6dfb54ceaad94c5a30f80893ebdec5a44c5aa73c205ae4a5bb9d5ed6bb84ea7c249ece786642bbb49d06a307df218d03da41c317417",
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "lint": "next lint",
    "start": "next start",
    "test-deploy": "echo hello"
  },
  "dependencies": {
    "@google/genai": "^1.30.0",
    "@hookform/resolvers": "^3.9.1",
    "@langchain/community": "^0.3.47",
    "@langchain/core": "^0.3.60",
    "@langchain/openai": "^0.3.8",
    "@radix-ui/react-accordion": "latest",
    "@radix-ui/react-alert-dialog": "latest",
    "@radix-ui/react-aspect-ratio": "latest",
    "@radix-ui/react-avatar": "latest",
    "@radix-ui/react-checkbox": "latest",
    "@radix-ui/react-collapsible": "latest",
    "@radix-ui/react-context-menu": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-hover-card": "latest",
    "@radix-ui/react-label": "latest",
    "@radix-ui/react-menubar": "latest",
    "@radix-ui/react-navigation-menu": "latest",
    "@radix-ui/react-popover": "latest",
    "@radix-ui/react-progress": "latest",
    "@radix-ui/react-radio-group": "latest",
    "@radix-ui/react-scroll-area": "latest",
    "@radix-ui/react-select": "latest",
    "@radix-ui/react-separator": "latest",
    "@radix-ui/react-slider": "latest",
    "@radix-ui/react-slot": "latest",
    "@radix-ui/react-switch": "latest",
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-toast": "latest",
    "@radix-ui/react-toggle": "latest",
    "@radix-ui/react-toggle-group": "latest",
    "@radix-ui/react-tooltip": "latest",
    "@supabase/supabase-js": "2.50.0",
    "@types/ws": "^8.18.1",
    "@vercel/blob": "latest",
    "@vercel/kv": "latest",
    "autoprefixer": "^10.4.20",
    "browser-image-compression": "^2.0.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "latest",
    "crypto": "latest",
    "date-fns": "4.1.0",
    "embla-carousel-react": "latest",
    "input-otp": "latest",
    "is-extglob": "^2.1.1",
    "js-tiktoken": "^1.0.20",
    "jsonwebtoken": "latest",
    "langchain": "^0.3.29",
    "lucide-react": "^0.454.0",
    "nanoid": "^5.1.5",
    "next": "15.2.4",
    "next-auth": "^4.24.11",
    "next-themes": "latest",
    "openai": "latest",
    "react": "^19",
    "react-day-picker": "latest",
    "react-dom": "^19",
    "react-hook-form": "latest",
    "react-markdown": "^10.1.0",
    "react-resizable-panels": "latest",
    "recharts": "latest",
    "sonner": "latest",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7",
    "use-interval": "^1.4.0",
    "vaul": "latest",
    "ws": "latest",
    "zod": "^3.24.1",
    "zod-to-json-schema": "^3.24.6",
    "sharp": "^0.34.2"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.16",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "dotenv-cli": "^8.0.0",
    "postcss": "^8.5",
    "prettier": "^3.5.3",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.3",
    "typescript": "^5"
  },
  "engines": {
    "node": "18.x"
  }
}

</package.json>

## Docs

<docs/project-structure-overview.md>

# StyleAI-RP 项目结构概览

## 📋 项目基本信息

**项目名称**: StyleAI-RP (Fashion AI Recommendation Platform)
**版本**: v0.1.0
**框架**: Next.js 15.2.4 + React 19
**部署**: Vercel
**开发语言**: TypeScript

## 🏗️ 项目架构

### 整体架构

\`\`\`
StyleAI-RP/
├── 🎨 前端应用 (Next.js App Router)
├── 🔌 API 接口 (Next.js API Routes)
├── 🧩 组件库 (Radix UI + Tailwind CSS)
├── 💾 数据存储 (Vercel KV + Blob + Supabase)
├── 🤖 AI 集成 (OpenAI, Google GenAI, Kling AI, LangChain)
└── 📚 文档系统 (Markdown)
\`\`\`

## 📁 详细目录结构

### 核心应用目录

\`\`\`
app/
├── 🏠 Root & Layout
├── 📄 Pages
│   ├── chat/           # AI对话聊天室
│   ├── chat1/          # 聊天室备用版本
│   ├── gemini/         # Gemini AI 功能
│   │   ├── lookbook/   # Lookbook 功能
│   │   └── resource/   # 资源管理
│   ├── login/          # 登录页面
│   ├── my-style/       # 个人风格管理
│   ├── onboarding/     # 用户引导流程
│   ├── results/        # 历史结果列表
│   ├── test-chat-kv/   # 聊天KV测试页
│   └── welcome/        # 欢迎页面
├── 🔌 API Routes
│   ├── analyze-photos/ # 照片分析
│   ├── apple/          # Apple平台API
│   │   ├── aichat/     # AI聊天
│   │   ├── chat/       # 聊天消息
│   │   ├── foryou/     # 个性化推荐
│   │   ├── gemini/     # Gemini AI
│   │   ├── generate/   # 图像生成
│   │   ├── kling/      # Kling AI
│   │   ├── lookbook/   # Lookbook
│   │   ├── openai/     # OpenAI
│   │   ├── suggest/    # 建议推荐
│   │   ├── upload/     # 文件上传
│   │   ├── web/        # Web端API
│   │   └── webhook/    # Webhook处理
│   ├── auth/           # NextAuth认证
│   ├── blob/upload/    # Blob存储上传
│   ├── chat/           # 聊天API
│   │   ├── messages/   # 消息管理
│   │   └── simple/     # 简单聊天
│   ├── generate/       # 通用生成
│   ├── generate-insight/ # 洞察生成
│   ├── generation/     # 生成任务管理
│   │   ├── cancel/     # 取消任务
│   │   ├── new/        # 新建任务
│   │   ├── start/      # 开始生成
│   │   ├── start-image-task/ # 图像任务
│   │   └── status/     # 生成状态
│   ├── image-vote/     # 图像投票
│   ├── looks/          # 搭配建议
│   │   └── migrate/    # 数据迁移
│   └── user/           # 用户管理
│       ├── job-count/  # 任务计数
│       └── profile/    # 用户资料
└── 🧩 Components
    └── onboarding/     # 引导流程组件
\`\`\`

### 共享组件库

\`\`\`
components/
└── ui/                 # 基础UI组件
    ├── 🎨 Radix UI组件封装
    ├── 🎯 业务组件
    └── 🔧 工具组件
\`\`\`

### 静态资源

\`\`\`
public/
├── cloth/              # 服装图片资源
├── examples/           # 示例图片
├── idols/              # 明星/模特图片
└── onboarding/         # 引导流程图片
\`\`\`

### 工具函数库

\`\`\`
lib/
├── ai/                 # AI服务模块
│   ├── pipelines/      # AI处理流水线
│   ├── providers/      # AI服务提供者
│   └── services/       # AI服务封装
├── apple/              # Apple平台服务
├── db/                 # 数据库操作
├── geminiService/      # Gemini服务
├── hooks/              # React Hooks
├── types/              # 类型定义
└── *.ts                # 通用工具函数

styles/                 # 全局样式
\`\`\`

### 开发与部署

\`\`\`
.next/                # Next.js构建输出
.vercel/              # Vercel部署配置
docs/                 # 项目文档
devnote/              # 开发笔记
\`\`\`

## 🛠️ 技术栈详解

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 15.2.4 | 全栈React框架 |
| **React** | 19 | UI库 |
| **TypeScript** | 5.x | 类型安全 |
| **Tailwind CSS** | 3.4.17 | 样式框架 |
| **Radix UI** | Latest | 无障碍UI组件 |

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js API Routes** | 15.2.4 | 后端API |
| **Vercel KV** | Latest | Redis数据库 |
| **Vercel Blob** | Latest | 文件存储 |
| **Supabase** | 2.50.0 | 数据库服务 |
| **NextAuth** | 4.24.11 | 用户认证 |

### AI & 机器学习

| 技术 | 用途 | 状态 |
|------|------|------|
| **Google GenAI (Gemini)** | 图像生成、风格分析、Lookbook | ✅ 主要使用 |
| **OpenAI GPT** | 对话和内容生成 | ✅ 主要使用 |
| **LangChain** | AI工作流编排 | ✅ 主要使用 |
| **Kling AI** | 虚拟试穿 (旧版 pipeline) | ⚠️ Legacy，逐步弃用 |

### 开发工具

| 工具 | 用途 |
|------|------|
| **ESLint** | 代码检查 |
| **Prettier** | 代码格式化 |
| **Zod** | 数据验证 |
| **React Hook Form** | 表单管理 |

## 🎯 核心功能模块

### 1. 用户系统

- **账户管理**: 用户注册、登录、资料管理
- **余额系统**: 积分/代币管理
- **个人设置**: 偏好设置、隐私设置

### 2. AI 穿搭助手

- **智能聊天**: 基于LLM的对话系统
- **风格分析**: 个人风格识别和建议
- **照片分析**: 上传照片获取穿搭建议
- **虚拟试穿**: AI生成试穿效果

### 3. 风格管理

- **个人风格库**: 收藏喜欢的风格
- **搭配历史**: 历史搭配记录
- **风格推荐**: 基于偏好的个性化推荐

### 4. 用户引导

- **Onboarding流程**: 新用户引导
- **风格测试**: 帮助用户发现个人风格
- **功能介绍**: 产品功能演示

## 🔄 数据流设计

### 用户交互流程

\`\`\`
用户输入 → 前端处理 → API调用 → AI处理 → 数据存储 → 结果返回
\`\`\`

### AI处理流程

\`\`\`
图片/文本输入 → 预处理 → OpenAI API → 后处理 → 结果输出
\`\`\`

## 🚀 部署架构

### Vercel部署

- **前端**: Vercel Edge Network
- **API**: Vercel Serverless Functions
- **数据库**: Vercel KV (Redis)
- **存储**: Vercel Blob Storage

### 环境配置

- **开发环境**: localhost:3000
- **生产环境**: Vercel域名
- **API密钥**: 环境变量管理

## 📊 性能优化

### 前端优化

- **代码分割**: Next.js自动代码分割
- **图片优化**: Next.js Image组件
- **缓存策略**: 浏览器缓存 + CDN
- **懒加载**: 组件懒加载

### 后端优化

- **API缓存**: Redis缓存热点数据
- **图片处理**: 服务端图片优化
- **数据库优化**: 查询优化和索引

## 🔐 安全措施

### 数据安全

- **JWT认证**: 用户身份验证
- **API密钥管理**: 环境变量存储
- **数据加密**: 敏感数据加密存储
- **输入验证**: Zod数据验证

### 隐私保护

- **图片处理**: 临时存储，定期清理
- **用户数据**: 最小化收集原则
- **第三方集成**: 严格的API调用控制

## 📈 监控与分析

### 性能监控

- **Vercel Analytics**: 访问统计
- **Error Tracking**: 错误监控
- **API监控**: 接口性能监控

### 用户分析

- **使用统计**: 功能使用情况
- **用户行为**: 交互路径分析
- **反馈收集**: 用户体验反馈

## 🛣️ 开发路线图

### 已完成功能 ✅

- [x] 基础聊天界面
- [x] 用户认证系统
- [x] 照片上传和分析
- [x] 基础AI对话
- [x] 用户引导流程

### 正在开发 🚧

- [ ] 聊天室升级（多轮对话）
- [ ] 风格管理系统优化
- [ ] 虚拟试穿功能
- [ ] 社交分享功能

### 计划功能 📋

- [ ] 语音交互
- [ ] 实时推荐
- [ ] 社区功能
- [ ] 移动端适配

## 📚 文档索引

### 设计文档

- [聊天室系统设计](./chat-room-design.md)
- [系统架构设计](./system-design.md)
- [风格生成流程](./style-generation-flow.md)

### 开发文档

- [部署指南](./deployment-guide.md)
- [数据库迁移](./database-migration.md)
- [功能实现检查](./waiting-tips-implementation-check.md)

### 用户体验

- [聊天泡泡建议](./chat-bubble-suggestions.md)

## 🤝 贡献指南

### 开发环境设置

\`\`\`bash
# 克隆项目
git clone <repository-url>

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建项目
npm run build
\`\`\`

### 代码规范

- 使用TypeScript进行类型检查
- 遵循Prettier代码格式化规则
- 使用ESLint进行代码检查
- 提交前进行代码测试

### 提交规范

- 使用语义化提交信息
- 每个功能独立分支开发
- PR前进行代码review
- 确保所有测试通过

---

**最后更新**: 2026年1月
**维护者**: StyleAI Team
**联系方式**: [项目Issues](https://github.com/your-repo/issues)

</docs/project-structure-overview.md>

<docs/deployment-guide.md>

# 部署指南

## 环境变量配置

### 本地开发环境
创建 `.env.local` 文件并添加以下变量：

\`\`\`bash
# Vercel KV (Redis) Database
# 从 Vercel Dashboard > Storage > KV 获取
KV_URL=redis://your-kv-url
KV_REST_API_URL=https://your-kv-rest-api-url
KV_REST_API_TOKEN=your-kv-rest-api-token
KV_REST_API_READ_ONLY_TOKEN=your-kv-read-only-token

# Vercel Blob Storage
# 从 Vercel Dashboard > Storage > Blob 获取
BLOB_READ_WRITE_TOKEN=your-blob-read-write-token

# Supabase Database
# 从 Supabase Dashboard 获取
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# AI API Keys (主要)
OPENAI_API_KEY=your-openai-api-key
GOOGLE_GENAI_API_KEY=your-google-genai-api-key  # 主要图像生成服务

# AI API Keys (Legacy - 旧版 pipeline，可选)
# KLING_AI_ACCESS_KEY=your-kling-access-key
# KLING_AI_SECRET_KEY=your-kling-secret-key
# RAPIDAPI_KEY=your-rapidapi-key-for-face-swap

# Image Provider 选择 (默认使用 gemini)
IMAGE_PROVIDER=gemini  # 可选值: gemini, kling

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
\`\`\`

### 生产环境 (Vercel)
1. 在 Vercel Dashboard 中进入项目设置
2. 转到 "Environment Variables" 选项卡
3. 添加上述所有环境变量

## 存储服务设置

### 1. Vercel KV 设置
1. 登录 Vercel Dashboard
2. 进入项目页面
3. 点击 "Storage" 选项卡
4. 点击 "Create Database" > "KV"
5. 输入数据库名称（如 `styleai-kv`）
6. 选择地区（建议选择离用户最近的地区）
7. 点击 "Create"
8. 复制生成的环境变量到项目设置中

### 2. Vercel Blob 设置
1. 在同一个 "Storage" 页面
2. 点击 "Create Database" > "Blob"
3. 输入存储名称（如 `styleai-blob`）
4. 点击 "Create"
5. 复制生成的环境变量到项目设置中

## 部署步骤

### 1. 代码部署
\`\`\`bash
# 推送代码到 Git 仓库
git add .
git commit -m "Add database migration system"
git push origin main

# 或者直接从 Vercel Dashboard 导入 Git 仓库
\`\`\`

### 2. 验证部署
1. 访问部署的应用
2. 检查控制台是否有错误
3. 测试数据库连接：访问 `/test-migration`
4. 验证 API 端点：
   - `GET /api/looks`
   - `POST /api/looks/migrate`

### 3. 监控设置
1. 在 Vercel Dashboard 中设置函数监控
2. 配置错误通知
3. 设置存储使用量告警

## 测试清单

### 功能测试
- [ ] 生成测试数据
- [ ] 测试数据库保存
- [ ] 测试数据库读取
- [ ] 测试数据迁移
- [ ] 测试图片上传
- [ ] 测试错误处理

### 性能测试
- [ ] 大量数据加载速度
- [ ] 图片上传速度
- [ ] API 响应时间
- [ ] 并发请求处理

### 安全测试
- [ ] 数据隔离验证
- [ ] API 访问控制
- [ ] 输入验证测试

## 故障排除

### 常见部署问题

#### 1. 环境变量未设置
\`\`\`bash
Error: KV_URL is not defined
\`\`\`
**解决方案**: 检查 Vercel 项目设置中的环境变量配置

#### 2. KV 连接失败
\`\`\`bash
Error: Failed to connect to KV database
\`\`\`
**解决方案**:
- 验证 KV 数据库是否已创建
- 检查环境变量值是否正确
- 确认项目已连接到正确的 KV 实例

#### 3. Blob 上传失败
\`\`\`bash
Error: Failed to upload to blob storage
\`\`\`
**解决方案**:
- 检查 BLOB_READ_WRITE_TOKEN 是否正确
- 验证 Blob 存储是否已启用
- 检查文件大小是否超过限制

#### 4. 迁移失败
\`\`\`bash
Migration failed: Invalid look data
\`\`\`
**解决方案**:
- 检查 localStorage 数据格式
- 验证必需字段是否存在
- 查看详细错误日志

#### 5. 生成超时问题 ⭐ 新增
\`\`\`bash
Error [AbortError]: This operation was aborted
\`\`\`
**解决方案**:
- 检查 `vercel.json` 配置是否正确部署
- 验证所有 AI API 密钥是否配置正确
- 监控 Vercel 函数执行日志
- 如果问题持续，可以尝试重新生成

**超时问题详细排查**:
1. **Face Swap 超时**: 最常见的超时原因
   - 现已增加到 3 分钟超时
   - 添加了自动重试机制
   - 如果仍然失败，可能是 RapidAPI 服务问题

2. **Kling AI 超时**: 图像生成或虚拟试穿超时
   - 轮询时间已优化到 5 分钟总时长
   - 检查 KLING_AI_ACCESS_KEY 和 KLING_AI_SECRET_KEY
   - 确认 Kling AI 账户余额充足

3. **文件下载超时**: 图片 URL 访问失败
   - 增加了重试机制
   - 检查网络连接
   - 验证图片 URL 是否有效

#### 6. Blob 存储冲突 ⭐ 新增
\`\`\`bash
Error: Vercel Blob: This blob already exists
\`\`\`
**解决方案**:
- 系统现已自动处理文件名冲突
- 使用 `addRandomSuffix: true` 生成唯一文件名
- 重复保存同一造型会被自动跳过
- 不影响用户体验，后台自动处理

**冲突处理机制**:
1. **自动去重**: 保存前检查是否已存在相同 ID 的造型
2. **文件名唯一化**: 所有上传的图片都添加随机后缀
3. **优雅降级**: 数据库失败时自动回退到 localStorage
4. **错误恢复**: 重复操作不会导致系统错误

#### 7. Redis Null 值错误 ⭐ 新增修复
\`\`\`bash
Error [UpstashError]: Command failed: ERR null args are not supported
\`\`\`
**问题原因**:
- Vercel KV (Redis) 不支持 `null` 或 `undefined` 值
- 数据库保存时包含了这些不支持的值

**解决方案**:
- 实现了自动数据清理功能
- 保存前过滤掉所有 `null` 和 `undefined` 值
- 递归清理嵌套对象和数组
- 保留空字符串和数字 0 等有效值

**修复详情**:
1. **数据清理函数**: `cleanObjectForRedis()` 递归清理对象
2. **自动过滤**: 保存前自动清理不支持的值
3. **保持完整性**: 不影响有效数据的存储
4. **错误恢复**: 清理失败时提供明确的错误信息

## 监控和维护

### 1. 日志监控
- 使用 Vercel 函数日志查看错误
- 设置 Sentry 或其他错误追踪服务
- 监控 API 响应时间和成功率

### 2. 存储监控
- 定期检查 KV 数据库使用量
- 监控 Blob 存储大小和请求数
- 设置使用量告警

### 3. 性能优化
- 启用 Vercel Edge Functions（如果适用）
- 配置 CDN 缓存策略
- 优化图片压缩和格式

## 扩展计划

### 短期优化
- 添加数据压缩
- 实现批量操作
- 增加缓存层

### 长期规划
- 用户认证系统
- 多地区部署
- 数据分析功能

## 成本估算

### Vercel KV
- 免费额度：1GB 存储，100万次请求/月
- 付费计划：$20/月起

### Vercel Blob
- 免费额度：1GB 存储，1万次请求/月
- 付费计划：$20/月起

### 建议
- 开发阶段使用免费额度
- 生产环境根据实际使用量选择合适计划
- 定期监控使用量避免超额费用

## 函数超时配置

### Vercel 函数超时设置
项目包含 `vercel.json` 配置文件，设置了以下超时限制：

\`\`\`json
{
  "regions": ["hnd1"],
  "functions": {
    "app/api/generation/status/route.ts": {
      "maxDuration": 300
    },
    "app/api/generation/start/route.ts": {
      "maxDuration": 300
    },
    "app/api/generate/route.ts": {
      "maxDuration": 300
    },
    "app/api/generate-style/route.ts": {
      "maxDuration": 300
    }
  }
}
\`\`\`

> **注意**: Heroku 部署时有 30 秒硬性超时限制，`maxDuration` 配置在 Heroku 上不生效。建议在代码中添加适当的超时处理机制。

### 超时处理改进
- **Face Swap API**: 超时从 90 秒增加到 180 秒，添加重试机制
- **Kling API**: 轮询间隔从 3 秒增加到 5 秒，最大尝试次数从 40 增加到 60
- **文件下载**: 超时从 60 秒增加到 120 秒，添加重试机制
- **网络请求**: 所有关键 API 调用都有指数退避重试策略

</docs/deployment-guide.md>

## System

<README.md>

# StyleAI-RP: AI Fashion Styling Recommendation App

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/jiameng1991-gmailcoms-projects/v0-fasionapp)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Powered by OpenAI](https://img.shields.io/badge/Powered%20by-OpenAI-green?style=for-the-badge&logo=openai)](https://openai.com/)

> A personalized AI-based fashion styling recommendation platform that provides professional styling advice through intelligent conversations and image analysis.

## ✨ Key Features

- 🤖 **AI Intelligent Conversation** - Fashion consultant based on large language models
- 📸 **Image Analysis** - Upload photos to get personalized styling advice
- 🎨 **Style Management** - Personal style library and matching history
- 👤 **User Guidance** - New user-friendly onboarding process
- 📱 **Responsive Design** - Supports access on multiple devices
- ⚡ **Real-time Interaction** - Smooth user experience

## 🚀 Online Experience

**Production Environment**: [https://vercel.com/jiameng1991-gmailcoms-projects/v0-fasionapp](https://vercel.com/jiameng1991-gmailcoms-projects/v0-fasionapp)

## 🛠️ Technology Stack

### Frontend

- **Next.js 15.2.4** - Full-stack React framework
- **React 19** - User interface library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Atomic CSS framework
- **Radix UI** - Accessible component library

### Backend

- **Next.js API Routes** - Server-side API
- **Vercel KV** - Redis database
- **Vercel Blob** - File storage
- **Google GenAI (Gemini)** - Primary image generation service
- **OpenAI API** - Chat and content generation
- **LangChain** - AI workflow orchestration

### Development Tools

- **ESLint & Prettier** - Code quality and formatting
- **Zod** - Data validation
- **React Hook Form** - Form management

## 🏗️ Project Structure

```
styleai-rp/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── chat/              # Chat page
│   ├── my-style/          # Personal style management
│   ├── onboarding/        # User onboarding
│   └── ...
├── components/            # Shared components
├── lib/                   # Utility functions
├── public/                # Static resources
├── docs/                  # Project documentation
└── styles/                # Global styles
```

## 📚 Detailed Documentation

For complete project documentation, please see the [docs](./docs/) directory:

- 📋 **[Project Structure Overview](./docs/project-structure-overview.md)** - Complete architecture description
- 🏗️ **[System Design](./docs/system-design.md)** - System architecture design
- 💬 **[Chat Room Design](./docs/chat-room-design.md)** - AI chat feature design
- 🚀 **[Deployment Guide](./docs/deployment-guide.md)** - Deployment and environment configuration

## 🚀 Quick Start

### Environment Requirements

- Node.js 18+
- npm or pnpm

### Local Development

1. **Clone the Project**

```bash
git clone <repository-url>
cd styleai-rp
```

2. **Install Dependencies**

```bash
npm install
# or
pnpm install
```

3. **Environment Configuration**

```bash
cp .env.local.example .env.local
# Edit .env.local to add necessary API keys
```

4. **Start Development Server**

```bash
npm run dev
# or
pnpm dev
```

5. **Access the Application**
Open [http://localhost:3000](http://localhost:3000) to view the application

### Build and Deploy

```bash
npm run build
npm start
```

## 🎯 Core Features

### 🤖 AI Chat Assistant

- Intelligent styling advice
- Multi-turn conversation support
- Context understanding

### 📸 Image Analysis

- Photo upload and analysis
- Style recognition
- Color matching advice

### 👤 Personal Center

- User account management
- Personal style library
- Matching history records

### 🎨 Style Management

- Style preference settings
- Personalized recommendations
- Style trend analysis

## 🛣️ Development Roadmap

### ✅ Completed

- [x] Basic UI framework setup
- [x] User authentication system
- [x] AI chat feature
- [x] Image upload analysis
- [x] User onboarding process

### 🚧 In Progress

- [ ] Chat room feature upgrade
- [ ] Real-time message push
- [ ] Style management optimization
- [ ] Mobile adaptation

### 📋 Planned

- [ ] Voice interaction
- [ ] Social sharing
- [ ] Personalized recommendation algorithm
- [ ] Multi-language support

## 🤝 Contribution Guide

We welcome all forms of contributions!

### How to Contribute

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Standards

- **Anti-Overengineering**: Keep it simple. Practical solutions > Perfect code.
- Develop using TypeScript
- Follow ESLint and Prettier rules
- Write necessary test cases
- Update relevant documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 📞 Contact Us

- **Project Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Feature Suggestions**: [Discussions](https://github.com/your-repo/discussions)
- **Email Contact**: [your-email@example.com](mailto:your-email@example.com)

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - Powerful React framework
- [OpenAI](https://openai.com/) - Provides AI model support
- [Vercel](https://vercel.com/) - Excellent deployment platform
- [Radix UI](https://www.radix-ui.com/) - Accessible component library
- [Tailwind CSS](https://tailwindcss.com/) - Practical CSS framework

---

**Maintainers**: StyleAI Team
**Last Updated**: June 2025

</README.md>

<docs/README.md>

# StyleAI-RP 项目文档

欢迎来到 StyleAI-RP 项目文档中心！这里包含了项目的完整技术文档和设计资料。

## 📚 文档导航

### 🏗️ 项目概览

- **[项目结构概览](./project-structure-overview.md)** - 完整的项目架构和技术栈说明
- **[系统架构设计](./system-design.md)** - 系统整体设计和架构图

### 🎯 功能设计

- **[聊天室系统设计](./chat-room-design.md)** - AI聊天室功能的详细设计方案
- **[风格生成流程](./style-generation-flow.md)** - 个性化风格生成的工作流程
- **[聊天泡泡建议](./chat-bubble-suggestions.md)** - 聊天界面交互优化建议

### 🛠️ 开发文档

- **[部署指南](./deployment-guide.md)** - 项目部署和环境配置
- **[数据库迁移](./database-migration.md)** - 数据库结构变更和迁移
- **[功能实现检查](./waiting-tips-implementation-check.md)** - 功能实现状态追踪

## 🎯 快速开始

### 新开发者必读

1. **[项目结构概览](./project-structure-overview.md)** - 了解项目整体架构
2. **[部署指南](./deployment-guide.md)** - 搭建开发环境
3. **[系统架构设计](./system-design.md)** - 理解系统设计理念

### 功能开发参考

- 开发聊天功能 → [聊天室系统设计](./chat-room-design.md)
- 开发风格推荐 → [风格生成流程](./style-generation-flow.md)
- 数据库操作 → [数据库迁移](./database-migration.md)

## 📂 文档类型说明

### 🏗️ 架构文档

包含系统整体设计、技术栈选择、模块划分等高层次的设计决策。

### 🎯 功能设计文档

详细描述各个功能模块的设计思路、实现方案和用户体验考虑。

### 🛠️ 技术文档

具体的技术实现细节、部署指南、API文档等开发相关内容。

### 📝 项目管理文档

项目进度、任务分配、问题追踪等项目管理相关内容。

## 🔍 文档搜索指南

### 按功能搜索

- **聊天相关**: chat-room-design.md, chat-bubble-suggestions.md
- **用户系统**: system-design.md, database-migration.md
- **AI功能**: style-generation-flow.md, chat-room-design.md
- **部署运维**: deployment-guide.md, project-structure-overview.md

### 按开发阶段搜索

- **需求分析**: system-design.md, chat-room-design.md
- **架构设计**: project-structure-overview.md, system-design.md
- **开发实施**: waiting-tips-implementation-check.md
- **部署上线**: deployment-guide.md

## 📋 文档维护规范

### 文档命名规范

- 使用小写字母和连字符
- 文件名要简洁明了，体现文档主要内容
- 格式：`功能-类型.md`，如：`chat-room-design.md`

### 文档结构规范

每个文档应包含：

- 标题和简介
- 目录（如果内容较长）
- 详细内容
- 相关链接
- 最后更新时间

### 更新维护

- 功能变更时同步更新相关文档
- 定期检查文档内容的准确性
- 及时补充新功能的设计文档

## 🤝 贡献指南

### 如何贡献文档

1. 发现文档问题或需要补充内容
2. 创建新的文档或修改现有文档
3. 确保文档格式符合规范
4. 提交 Pull Request

### 文档审核流程

1. 内容准确性检查
2. 格式规范性检查
3. 与现有文档的一致性检查
4. 技术细节验证

## 📞 联系方式

如果您对文档有任何疑问或建议，请：

- 创建 Issue 讨论
- 直接修改文档并提交 PR
- 联系项目维护者

---

**文档维护者**: StyleAI Team
**最后更新**: 2024年12月
**文档版本**: v1.0

</docs/README.md>

<docs/ai-rules.md>

# AI Rules & Guidelines

## Tech Stack
- **Framework**: Next.js 15.2.4 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Radix UI components
- **Backend**: Next.js API Routes
- **Database**: Vercel KV (Redis)
- **Storage**: Vercel Blob
- **AI**: Google GenAI (Gemini, 主要), OpenAI API, LangChain | Kling AI (legacy, 逐步弃用)
- **Package Manager**: pnpm (preferred)

## Development Commands
```bash
pnpm dev                 # Start development server
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run ESLint
```

## Code Conventions

### File Structure
- **File Naming**: `kebab-case.ts/tsx` (preferred for all files including components)
- **Component Naming**: `PascalCase` for exports
- **API Routes**: REST conventions in `app/api/`

### React/TypeScript
- Functional components with hooks
- TypeScript for all new code
- Use Radix UI components when possible
- Follow existing component patterns in `components/`

### Styling
- Tailwind CSS classes for styling
- Consistent spacing using Tailwind scale
- Responsive design with mobile-first approach
- Use existing color palette and design tokens

### State Management
- React hooks for local state
- Context providers for shared state
- Server state handled by API routes

## Engineering Standards (Production Phase)

⚠️ **CONTEXT**: The product is live. We prioritize **Maintainability**, **Stability**, and **Scalability** while avoiding unnecessary complexity.

### 1. Pragmatic Architecture
- **Justified Abstraction**: Create abstractions only when they provide clear benefits (e.g., code reuse, testing, separation of concerns).
- **Rule of Three**: It is acceptable to duplicate code once or twice. On the third instance, refactor into a shared component or utility.
- **Colocation**: Keep related logic (types, utils, sub-components) close to where they are used unless they are truly global.

### 2. Code Quality & Safety
- **Strict Typing**: Avoid `any`. Define interfaces for props and API responses. Zod validation is required for all inputs.
- **Error Handling**: Production code must handle edge cases gracefully. Do not let the UI crash silently. Use specific error boundaries or toast notifications.
- **Readable > Clever**: Write code that is easy to debug. Prefer explicit logic over "clever" one-liners that obscure intent.

### 3. Red Flags (Anti-Patterns)
❌ **Speculative Generality**: Don't build features or configurations "just in case" we need them in the future. Solve the problem at hand.
❌ **Premature Optimization**: Don't optimize performance until you have measured a bottleneck. Readability comes first.
❌ **Deep Nesting**: Avoid deeply nested folder structures or component trees. Keep the hierarchy flat where possible.
❌ **Global State Abuse**: Don't put everything in Global Context. Keep state as local as possible.

### 4. Implementation Checklist
✅ **Is it robust?** Does it handle loading states and error states?
✅ **Is it maintainable?** Can another developer understand this without reading the whole file?
✅ **Is it tested?** Critical business logic should have basic verification.

## Notes for AI Assistants
1. **Context First**: Understand the existing codebase structure before adding new files.
2. **Consistency**: Match the style of adjacent code.
3. **Safety**: Always check for `null` or `undefined` in data flows.
4. **Clean Up**: Remove unused imports and console logs before finishing.
5. **Linting**: Ensure code passes `pnpm lint`.

</docs/ai-rules.md>

