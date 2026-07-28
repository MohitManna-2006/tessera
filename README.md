# Tessera

Tessera is an AI-powered developer portfolio platform in early development.

The product vision is to transform a developer's resume and selected public
GitHub projects into validated, editable portfolio data, render that data
through curated templates, and export a complete Next.js portfolio codebase that
works independently of Tessera.

## Current Repository State

This repository contains Tessera's onboarding entry point, deterministic
server-side PDF resume text extraction, and a working portfolio builder with
live preview, validation, and deterministic ZIP export. It also contains an
opt-in, feature-flagged AI resume drafting flow that produces an evidence-backed
private `ResumeDraftV1` for guided review. GitHub import, authentication,
durable persistence, and conversion of a confirmed resume draft into builder
state are not implemented.

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
persist the raw file or perform OCR. AI drafting is a separate explicit action:
when enabled, only extracted plain text and bounded source metadata are sent to
the configured provider. The original PDF is never sent, and a reviewed draft
does not hydrate the builder.

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

### AI resume drafting

AI resume drafting is disabled by default and becomes available only when all
three server-only variables are configured:

| Variable                       | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `AI_RESUME_EXTRACTION_ENABLED` | Must be exactly `true` to show the action |
| `OPENAI_API_KEY`               | Server-only OpenAI credential             |
| `OPENAI_RESUME_MODEL`          | Explicit model used for resume drafting   |

The operation is fixed to `extract_resume`, uses a strict structured-output
schema, does not enable provider tools, and stores the temporary review state
only in the current tab's `sessionStorage` for up to 30 minutes. Automated tests
mock the provider or network boundary and never require a real key.

Do not enable the AI route for public traffic until durable rate limiting,
request accounting, and abuse controls are deployed at the application or edge
boundary.

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
