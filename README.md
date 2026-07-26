# Tessera

**AI-Powered Developer Portfolio Platform**

Tessera transforms a developer’s resume and selected GitHub projects into a polished, editable portfolio and a downloadable codebase they fully own and can deploy anywhere.

## Core Product Principle

> Tessera generates validated, evidence-backed portfolio data and injects it into tested templates. It does not use an LLM to generate arbitrary application source code.

## MVP Flow

1. Upload a resume PDF.
2. Extract and review structured experience data.
3. Import public GitHub repositories.
4. Select projects to feature.
5. Generate evidence-backed portfolio content with AI.
6. Edit and verify the generated content.
7. Preview the portfolio using a curated template.
8. Download a complete Next.js codebase as a ZIP.
9. Deploy independently to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or another compatible host.

## Architecture Documentation

The complete product scope, MVP specification, system design, AI architecture, security model, testing strategy, delivery plan, and implementation backlog are maintained in:

- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)

This specification is the source of truth for implementation. Coding agents and contributors should read the relevant sections before modifying the system.

## Planned Stack

- Next.js, React, and TypeScript
- Tailwind CSS and shadcn/ui
- React Hook Form and Zod
- OpenAI Responses API with structured outputs
- GitHub REST API
- Supabase Auth and PostgreSQL for the public beta
- Upstash Redis for rate limiting
- Vitest, Playwright, and GitHub Actions
- Vercel for the builder application

## Current Status

**Phase 0: Architecture and product-definition baseline**

Implementation begins with a static vertical slice using fixture data:

```text
Fixture portfolio data
    → Editor
    → Template preview
    → ZIP export
    → Extracted portfolio builds successfully
```

Resume processing, GitHub integration, and AI generation are added only after the deterministic editor-preview-export path is proven.

## License

No open-source license has been selected yet. All rights are reserved unless a license is added later.
