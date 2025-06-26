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
- **OpenAI API** - AI model service

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
