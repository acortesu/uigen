# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

Use comments sparingly. Only comment complex code.

## Setup & Commands

```bash
# Initial setup (install deps + run DB migrations)
npm run setup

# Development server (uses Turbopack)
npm run dev

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Lint
npm run lint

# Reset database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate && npx prisma migrate dev
```

Set `ANTHROPIC_API_KEY` in `.env` to use real AI generation. Without it, the app uses a mock provider that returns static components.

## Architecture Overview

UIGen is a Next.js 15 app that lets users generate React components via AI chat, with live preview.

### Core Data Flow

1. User sends a chat message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. The API reconstructs a `VirtualFileSystem` from serialized file data sent in the request body
3. Claude (via Vercel AI SDK) streams a response, calling tools to modify the virtual file system
4. Tool calls are streamed back to the client and applied to the client-side `VirtualFileSystem`
5. `PreviewFrame` re-renders whenever `refreshTrigger` increments, transforming virtual files into a sandboxed iframe preview

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is the central abstraction — an in-memory tree of files and directories, never written to disk. It exists in two places simultaneously:
- On the client, owned by `FileSystemProvider` / `useFileSystem` context
- On the server, reconstructed per-request from JSON in the request body

`serialize()` / `deserializeFromNodes()` convert between the internal `Map<string, FileNode>` structure and plain JSON for transport and DB storage.

### AI Tools

The AI has two tools defined in `src/lib/tools/`:
- **`str_replace_editor`**: create, view, str_replace, insert operations on virtual files
- **`file_manager`**: rename and delete operations

Both tools operate on the server-side `VirtualFileSystem` instance. The client mirrors these tool calls via `handleToolCall` in `FileSystemContext` — so both sides stay in sync during a streaming response.

### Preview Pipeline (`src/lib/transform/jsx-transformer.ts`)

`createImportMap()` takes all files from the virtual FS, transforms each JSX/TSX via Babel standalone into plain JS, creates blob URLs for each, and assembles an ES module import map. Third-party package imports are resolved via `esm.sh`. `createPreviewHTML()` generates an HTML document injected into a sandboxed `<iframe>`.

The entry point defaults to `/App.jsx`. All local imports in generated code use the `@/` alias, which maps to the virtual FS root `/`.

### Contexts

- **`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`): owns the `VirtualFileSystem` instance, exposes file CRUD, and handles incoming AI tool calls to update state and trigger re-renders via `refreshTrigger`
- **`ChatContext`** (`src/lib/contexts/chat-context.tsx`): wraps Vercel AI SDK's `useChat`, wires `onToolCall` → `FileSystemContext.handleToolCall`, and serializes the current VFS state into each request body

### Database Schema

The database schema is defined in the `prisma/schema.prisma` file. Reference it anytime to understand the structure of data stored in the database.

### Auth & Persistence

- JWT sessions via `jose` with httpOnly cookies (7-day expiry) — `src/lib/auth.ts`
- SQLite via Prisma; `Project.messages` and `Project.data` store JSON-stringified chat history and serialized VFS state respectively
- Anonymous users can work without signing in; work is tracked in `src/lib/anon-work-tracker.ts` for later claim on sign-up
- `src/middleware.ts` handles session-based auth redirects

### Provider / Mock

`src/lib/provider.ts` exports `getLanguageModel()`. With `ANTHROPIC_API_KEY` set it returns `claude-haiku-4-5`. Without it, returns `MockLanguageModel`, which streams static predefined components (counter, form, or card depending on prompt keywords).

### Generation Prompt

`src/lib/prompts/generation.tsx` contains the system prompt. Key constraints enforced by the prompt:
- Every project must have `/App.jsx` as the root entry point with a default export
- Style with Tailwind, not inline styles
- Local imports must use `@/` alias (e.g. `@/components/Button`)
- No HTML files — `/App.jsx` is the only entry point
