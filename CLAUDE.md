# CLAUDE.md - Instructions for AI Assistant

This document provides essential context and instructions for AI assistants working on the StyleAI-RP project.

## Project Overview

StyleAI-RP is an AI-powered fashion recommendation platform that provides personalized styling advice through intelligent chat and image analysis. The platform helps users discover their personal style and get professional fashion recommendations.

## Tech Stack

- **Framework**: Next.js 15.2.4 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Radix UI components
- **Backend**: Next.js API Routes
- **Database**: Vercel KV (Redis)
- **Storage**: Vercel Blob
- **AI**: OpenAI API, LangChain
- **Package Manager**: pnpm (preferred)

## Development Commands

```bash
# Development
pnpm dev                 # Start development server
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run ESLint

# Testing
# No specific test command - check for test scripts in package.json
```

## Key Directories

- `app/` - Next.js App Router pages and API routes
  - `api/` - Backend API endpoints
  - `chat/` - Chat interface pages
  - `onboarding/` - User onboarding flow
  - `my-style/` - Personal style management
- `components/` - Reusable React components
- `lib/` - Utility functions, database, AI services
- `docs/` - Project documentation
- `public/` - Static assets including fashion images

## Code Conventions

### File Structure
- Use kebab-case for file and directory names
- Components use PascalCase exports
- API routes follow REST conventions

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

## Important Files

- `lib/ai.ts` - AI service integrations
- `lib/database.ts` - Database operations
- `lib/prompts.ts` - AI prompt templates
- `app/api/chat/` - Chat API endpoints
- `components/onboarding/` - User onboarding components

## Development Guidelines

### Before Making Changes
1. Check existing components in `components/` for reusable patterns
2. Review similar API routes in `app/api/` for consistency
3. Check `lib/` for existing utility functions
4. Ensure Tailwind classes follow project conventions

### When Adding Features
1. Follow the existing file structure
2. Use TypeScript interfaces for data types
3. Add proper error handling
4. Maintain responsive design
5. Test on mobile devices

### API Development
- Use proper HTTP status codes
- Include error handling and validation
- Follow existing API patterns
- Use Zod for request validation where applicable

### Debugging
- Check browser console for frontend issues
- Use Next.js development tools
- Review network requests in DevTools
- Check Vercel deployment logs for production issues

## Common Tasks

### Adding New Components
1. Create in `components/` directory
2. Follow existing naming conventions
3. Use TypeScript interfaces for props
4. Include proper accessibility attributes
5. Use Tailwind for styling

### Adding API Routes
1. Create in `app/api/` directory
2. Export named functions for HTTP methods
3. Use proper error handling
4. Include request validation
5. Follow REST conventions

### Styling Updates
1. Use existing Tailwind classes
2. Check `globals.css` for custom styles
3. Maintain responsive design
4. Test across different screen sizes

## Deployment

- **Platform**: Vercel
- **Environment**: Production builds automatically deploy from main branch
- **Environment Variables**: Set in Vercel dashboard
- **Database**: Vercel KV for production

## Resources

- **Documentation**: See `docs/` directory for detailed guides
- **Components**: Radix UI + custom components in `components/`
- **Icons**: Lucide React icons
- **Fonts**: Custom fonts defined in `app/font.css`

## Anti-Overengineering Best Practices

⚠️ **CRITICAL**: This project prioritizes simplicity and speed over perfect architecture. Follow these principles:

### 1. Keep It Simple (KISS)
- **Use existing patterns** - Don't create new abstractions unless absolutely necessary  
- **Favor composition over inheritance** - Build with existing components
- **Avoid premature optimization** - Make it work first, optimize later if needed
- **No unnecessary layers** - If you can do it in one file, don't split it into multiple

### 2. Practical Solutions Over Perfect Code
- **Copy-paste is OK** - Better than creating complex abstractions for 2-3 uses
- **Inline styles/logic are fine** - Don't extract everything into separate files
- **Use libraries as-is** - Don't wrap every third-party library in custom abstractions
- **Ship working code** - Perfect code that's never shipped is worthless

### 3. Red Flags to Avoid
❌ **DON'T**: Create elaborate folder structures for small features  
❌ **DON'T**: Add complex state management for simple data  
❌ **DON'T**: Build generic solutions for specific problems  
❌ **DON'T**: Add unnecessary configuration or customization layers  
❌ **DON'T**: Create interfaces for single implementations  
❌ **DON'T**: Abstract everything "just in case"  

### 4. When to Add Complexity
✅ **ONLY add complexity when**:
- You have 3+ identical implementations (Rule of Three)
- Performance requirements demand it
- Business logic genuinely requires it
- You're fixing a real bug, not a theoretical one

## Notes for AI Assistants

1. **Start simple** - Use the most straightforward solution that works
2. **Check existing code first** - Reuse before creating new
3. **Follow established patterns** - Don't reinvent the wheel
4. **Test responsive design** - Mobile-first platform
5. **Use existing dependencies** - Check package.json before adding new ones
6. **Ship incrementally** - Working code > perfect code
7. **Use pnpm** as package manager
8. **Lint with** `pnpm lint` before committing