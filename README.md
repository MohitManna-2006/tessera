# Tessera

Tessera is an AI-powered developer portfolio platform in early development.

The product vision is to transform a developer's resume and selected public
GitHub projects into validated, editable portfolio data, render that data
through curated templates, and export a complete Next.js portfolio codebase that
works independently of Tessera.

## Current Repository State

This repository contains Tessera's onboarding entry point, deterministic
server-side PDF resume text extraction, and a working portfolio builder with
live preview, validation, and deterministic ZIP export. Structured AI resume
extraction, GitHub import, authentication, and persistence are not implemented.

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

Open http://localhost:3000 for onboarding, visit http://localhost:3000/resume
to extract plain text from a PDF, or visit http://localhost:3000/builder to open
the builder directly.

The resume route processes the PDF temporarily in server memory. It does not
persist the raw file, call an AI service, perform OCR, or hydrate the builder.

### Resume processing limits

Safe defaults are used when the following server-only environment variables are
missing, invalid, zero, negative, non-integer, or outside their accepted bounds:

| Variable                                        | Default | Accepted range  |
| ----------------------------------------------- | ------- | --------------- |
| `RESUME_MAX_UPLOAD_BYTES`                       | 5 MiB   | 1 KiB–25 MiB    |
| `RESUME_MAX_PAGES`                              | 20      | 1–100           |
| `RESUME_MAX_TEXT_CHARACTERS`                    | 200,000 | 1,000–1,000,000 |
| `RESUME_MIN_MEANINGFUL_ALPHANUMERIC_CHARACTERS` | 40      | 10–1,000        |

Meaningful text must also contain at least five substantive tokens and enough
letters to reject page numbers, isolated symbols, and punctuation-only parser
output. The server remains authoritative; the client mirrors only the default
5 MiB upload size for immediate feedback.

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
