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
