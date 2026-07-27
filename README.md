# Tessera

Tessera is an AI-powered developer portfolio platform in early development.

The product vision is to transform a developer's resume and selected public
GitHub projects into validated, editable portfolio data, render that data
through curated templates, and export a complete Next.js portfolio codebase that
works independently of Tessera.

## Current Repository State

This repository contains Tessera's onboarding entry point and a working
portfolio builder with live preview, validation, and deterministic ZIP export.
Resume import, GitHub import, AI operations, authentication, and persistence are
not implemented.

The frozen architectural invariant is:

```text
Resume and selected GitHub data
-> normalized evidence
-> structured Portfolio JSON
-> schema validation
-> user review and confirmation
-> curated template renderer
-> deterministic ZIP export
-> independently deployable portfolio
```

AI may eventually generate structured professional content. AI must not generate
arbitrary application source code.

## Tech Foundation

- Next.js App Router
- React
- TypeScript with strict mode
- Tailwind CSS
- ESLint
- Prettier
- Vitest with React Testing Library and jsdom
- Playwright

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 for onboarding, or visit
http://localhost:3000/builder to open the builder directly. The `/resume` route
is an explicit Stage 1 boundary page; resume upload and extraction are not
implemented.

## Quality Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Project Specification

The product and architecture baseline is documented in
[`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).
