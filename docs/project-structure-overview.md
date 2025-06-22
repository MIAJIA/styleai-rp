# StyleAI-RP 项目结构概览

## 📋 项目基本信息

**项目名称**: StyleAI-RP (Fashion AI Recommendation Platform)
**版本**: v0.1.0
**框架**: Next.js 15.2.4 + React 19
**部署**: Vercel
**开发语言**: TypeScript

## 🏗️ 项目架构

### 整体架构

```
StyleAI-RP/
├── 🎨 前端应用 (Next.js App Router)
├── 🔌 API 接口 (Next.js API Routes)
├── 🧩 组件库 (Radix UI + Tailwind CSS)
├── 💾 数据存储 (Vercel KV + Blob)
├── 🤖 AI 集成 (OpenAI API)
└── 📚 文档系统 (Markdown)
```

## 📁 详细目录结构

### 核心应用目录

```
app/
├── 🏠 Root & Layout
├── 📄 Pages
│   ├── about/           # 关于页面
│   ├── account/         # 用户账户管理
│   ├── chat/           # AI对话聊天室
│   ├── my-style/       # 个人风格管理
│   ├── onboarding/     # 用户引导流程
│   ├── result/         # 结果展示页面
│   ├── results/        # 历史结果列表
│   ├── settings/       # 设置页面
│   └── welcome/        # 欢迎页面
├── 🔌 API Routes
│   ├── account/
│   │   └── balance/    # 账户余额管理
│   ├── analyze-photos/ # 照片分析
│   ├── generate/       # 通用生成
│   ├── generate-style/ # 风格生成
│   ├── generation/     # 生成任务管理
│   │   ├── start/      # 开始生成
│   │   └── status/     # 生成状态
│   ├── looks/          # 搭配建议
│   │   └── migrate/    # 数据迁移
│   └── tryon/          # 虚拟试穿
└── 🧩 Components
    └── onboarding/     # 引导流程组件
```

### 共享组件库

```
components/
└── ui/                 # 基础UI组件
    ├── 🎨 Radix UI组件封装
    ├── 🎯 业务组件
    └── 🔧 工具组件
```

### 静态资源

```
public/
├── cloth/              # 服装图片资源
├── examples/           # 示例图片
└── idols/             # 明星/模特图片
```

### 数据与配置

```
data/
└── cloth/             # 服装数据

lib/                   # 工具函数库
styles/               # 全局样式
```

### 开发与部署

```
.next/                # Next.js构建输出
.vercel/              # Vercel部署配置
docs/                 # 项目文档
devnote/              # 开发笔记
```

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
| **Vercel KV** | 3.0.0 | Redis数据库 |
| **Vercel Blob** | 1.1.1 | 文件存储 |
| **OpenAI API** | Latest | AI模型接入 |

### AI & 机器学习

| 技术 | 用途 |
|------|------|
| **OpenAI GPT** | 对话和内容生成 |
| **计算机视觉** | 图片分析和风格识别 |
| **推荐算法** | 个性化穿搭建议 |

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

```
用户输入 → 前端处理 → API调用 → AI处理 → 数据存储 → 结果返回
```

### AI处理流程

```
图片/文本输入 → 预处理 → OpenAI API → 后处理 → 结果输出
```

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

```bash
# 克隆项目
git clone <repository-url>

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建项目
npm run build
```

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

**最后更新**: 2024年12月
**维护者**: StyleAI Team
**联系方式**: [项目Issues](https://github.com/your-repo/issues)
