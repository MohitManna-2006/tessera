# Tessera

## AI-Powered Developer Portfolio Platform

## Final Project Scope, MVP Specification, System Architecture, AI Design, Security, Testing, Deployment, and Delivery Plan

**Document status:** Implementation-ready baseline  
**Version:** 1.0  
**Date:** July 26, 2026  
**Product name:** Tessera  
**Primary audience:** Product owner, AI coding agents, software engineers, reviewers, testers, and future contributors

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Product Summary](#2-product-summary)
3. [Product Principles](#3-product-principles)
4. [Goals and Success Criteria](#4-goals-and-success-criteria)
5. [Non-Goals](#5-non-goals)
6. [User Personas](#6-user-personas)
7. [Core User Journey](#7-core-user-journey)
8. [MVP Scope](#8-mvp-scope)
9. [Future Scope](#9-future-scope)
10. [High-Level System Architecture](#10-high-level-system-architecture)
11. [Technology Stack](#11-technology-stack)
12. [Repository Structure](#12-repository-structure)
13. [Domain Data Model](#13-domain-data-model)
14. [Database Design](#14-database-design)
15. [API Contracts](#15-api-contracts)
16. [Resume Processing Pipeline](#16-resume-processing-pipeline)
17. [GitHub Integration Pipeline](#17-github-integration-pipeline)
18. [AI System Design](#18-ai-system-design)
19. [Portfolio Editor Architecture](#19-portfolio-editor-architecture)
20. [Preview Architecture](#20-preview-architecture)
21. [Export Architecture](#21-export-architecture)
22. [Security Architecture](#22-security-architecture)
23. [Privacy and Data Retention](#23-privacy-and-data-retention)
24. [Error Taxonomy](#24-error-taxonomy)
25. [Observability](#25-observability)
26. [Testing Strategy](#26-testing-strategy)
27. [CI/CD](#27-cicd)
28. [Environment Variables](#28-environment-variables)
29. [Cost-Control Architecture](#29-cost-control-architecture)
30. [Performance and Scalability](#30-performance-and-scalability)
31. [Accessibility Requirements](#31-accessibility-requirements)
32. [SEO Requirements](#32-seo-requirements-for-exported-portfolios)
33. [Design System Requirements](#33-design-system-requirements)
34. [AI Coding-Agent Operating Model](#34-ai-coding-agent-operating-model)
35. [Implementation Milestones](#35-implementation-milestones)
36. [Detailed Initial Backlog](#36-detailed-initial-backlog)
37. [Definition of Done](#37-definition-of-done)
38. [Launch Checklist](#38-launch-checklist)
39. [Risk Register](#39-risk-register)
40. [Architecture Decision Records](#40-architecture-decision-records)
41. [Open Questions](#41-open-questions-requiring-product-decisions)
42. [Recommended First Agent Prompt](#42-recommended-first-agent-prompt)
43. [Final System Definition](#43-final-system-definition)
44. [One-Sentence Architectural Rule](#44-one-sentence-architectural-rule)
45. [Functional Requirements Matrix](#45-functional-requirements-matrix)
46. [Builder Workflow State Machine](#46-builder-workflow-state-machine)
47. [Server Request Lifecycle](#47-server-request-lifecycle)
48. [Caching, Idempotency, and Concurrency](#48-caching-idempotency-and-concurrency)
49. [Coding Standards](#49-coding-standards)
50. [Local Development Setup](#50-local-development-setup)
51. [Versioning and Release Management](#51-versioning-and-release-management)
52. [Support and Incident Procedures](#52-support-and-incident-procedures)

---

## 1. Document Purpose

This document is the single source of truth for building an AI-powered portfolio generator for software engineers, students, and early-career technical candidates.

The product converts verified career evidence into a clean, recruiter-ready, downloadable developer portfolio codebase. Users provide a resume and public GitHub information, review the extracted content, select projects, use controlled AI features to improve the presentation, preview the result, and download a complete deployable project.

This document defines:

- The final product vision
- The exact MVP scope
- Features included and excluded from the MVP
- User personas and user journeys
- Functional and non-functional requirements
- Technical architecture
- Technology choices and rationale
- AI operations, schemas, guardrails, and cost controls
- Resume and GitHub ingestion pipelines
- Portfolio editing and preview behavior
- Exported codebase architecture
- Security, privacy, abuse prevention, and data retention
- Database and API contracts
- Testing and quality strategy
- CI/CD and deployment architecture
- Observability and operational requirements
- AI coding-agent workflow
- Milestones, tickets, acceptance criteria, and launch gates
- Future roadmap and monetization boundaries

No implementation should begin or change direction without checking this document and the associated architecture decision records.

---

## 2. Product Summary

### 2.1 Product statement

> Upload a resume, import selected GitHub projects, generate verified portfolio content with AI, preview the site, download the full codebase, and deploy it anywhere.

### 2.2 Core value proposition

The product solves a specific problem: many software engineering candidates have strong experiences and projects but do not know how to convert them into a polished, coherent, recruiter-friendly portfolio.

The product removes four major barriers:

1. **Content organization:** It structures experience, education, projects, and skills consistently.
2. **Technical storytelling:** It converts repository metadata and resume bullets into understandable project narratives.
3. **Portfolio implementation:** It packages approved content into a tested website template.
4. **Ownership:** It gives users the complete source code with no permanent dependency on the platform.

### 2.3 Product positioning

The product is not a generic AI website builder.

It is:

> A portfolio engineering tool that transforms verified professional evidence into a structured, deployable developer website.

### 2.4 Differentiators

- Built specifically for developers and technical candidates
- Combines resume evidence and GitHub evidence
- AI-generated content remains traceable to sources
- Users review all content before export
- Templates are deterministic and tested
- The LLM does not generate arbitrary application code
- Downloaded portfolios remain functional without the builder platform
- Users own the exported codebase and can deploy it anywhere

---

## 3. Product Principles

Every implementation decision must support the following principles.

### 3.1 Evidence before presentation

The system must begin with source evidence from the resume, GitHub, and explicit user input. AI may rewrite or reorganize evidence, but may not invent facts.

### 3.2 Structured data before UI generation

The system produces validated `PortfolioData` JSON. Curated templates render that data. AI does not dynamically write React components, package files, or deployment configuration.

### 3.3 User confirmation before publishing

AI-generated or AI-inferred text must remain editable. Claims with weak support must be flagged. The user is responsible for final confirmation before export.

### 3.4 One excellent path before many mediocre paths

The MVP should provide one complete and reliable end-to-end experience. Multiple templates, integrations, and customization systems should not delay launch.

### 3.5 Low fixed cost

The initial system should use free or low-cost infrastructure tiers, bounded AI operations, strict usage limits, and minimal persistent storage.

### 3.6 Portable output

The exported portfolio must not require the builder application, its APIs, its database, or its authentication system.

### 3.7 Boring infrastructure

Prefer common, well-supported technology over clever infrastructure. The product should remain understandable to future engineers and AI coding agents.

### 3.8 AI is a constrained service, not the architect

AI calls should be narrow, versioned, schema-bound, observable, and replaceable. Business logic must remain deterministic where possible.

---

## 4. Goals and Success Criteria

### 4.1 MVP goals

The MVP must prove that a user can:

1. Upload a resume PDF.
2. Extract structured career data from that resume.
3. Review and correct the extracted information.
4. Enter a GitHub username.
5. Import public repositories and repository metadata.
6. Select a limited number of repositories.
7. Generate source-grounded portfolio content.
8. Edit the generated content manually.
9. Preview the portfolio responsively.
10. Download a complete codebase as a ZIP file.
11. Install, build, and deploy the downloaded portfolio independently.

### 4.2 Product success criteria

The MVP is successful when:

- A first-time user can complete the workflow without developer assistance.
- At least 90% of valid test resumes produce structurally valid extracted data.
- AI responses pass schema validation or fail safely with actionable errors.
- The exported template builds successfully in automated CI tests.
- No secrets, raw resume files, internal prompts, or builder-specific credentials appear in exported ZIP files.
- A user can deploy the downloaded site using documented commands.
- Median end-to-end completion time remains reasonable for a beta workflow.
- Average AI cost per completed portfolio stays within the configured cost ceiling.
- Users report that the generated content is accurate enough to edit rather than rewrite completely.

### 4.3 Initial product metrics

Track the following for the beta:

- Landing page to builder-start conversion
- Resume upload success rate
- Resume extraction success rate
- GitHub import success rate
- Percentage of users selecting at least one repository
- AI generation success rate
- Validation failure rate by operation
- Average manual edits per generated section
- Preview completion rate
- ZIP download rate
- Export build success rate
- Average AI cost per user
- Average AI cost per completed portfolio
- Rate-limit rejection count
- User-reported accuracy score
- User-reported portfolio quality score

Do not collect raw resume text or sensitive content in analytics.

---

## 5. Non-Goals

The following are intentionally excluded from the first MVP unless explicitly added through a new architecture decision.

- Generic website generation
- Arbitrary AI-generated source code
- Drag-and-drop page builders
- Real-time collaborative editing
- Native mobile applications
- LinkedIn scraping
- Automatic LinkedIn profile import
- Private GitHub repository access
- GitHub OAuth during the earliest private prototype
- One-click deployment
- Custom domains
- Payments and subscriptions
- Portfolio traffic analytics
- Recruiter tracking pixels
- AI chat assistant with unrestricted prompts
- Automatic resume rewriting as a separate product
- Cover-letter generation
- Job-application tracking
- Automated portfolio updates from GitHub
- Multiple user workspaces
- Team collaboration
- Marketplace of community templates
- Custom user-written React components
- Server-side hosting of generated portfolios
- Long-term storage of uploaded resumes
- Full source-code analysis of repositories
- Static code analysis across entire repositories
- Browser extensions
- Vector databases or retrieval infrastructure
- Microservices
- Message brokers
- Kubernetes
- GraphQL
- LangChain or similar orchestration frameworks

---

## 6. User Personas

### 6.1 Primary persona: Student software engineer

Characteristics:

- Has one to three internships or campus experiences
- Has several GitHub projects of uneven quality
- May not have a personal portfolio
- Wants internship or new-grad opportunities
- Needs help explaining technical work clearly
- Has limited money and limited design experience

Primary goals:

- Build a professional portfolio quickly
- Highlight strongest experiences
- Turn technical repositories into understandable project stories
- Download and deploy the code independently

### 6.2 Secondary persona: Early-career engineer

Characteristics:

- Has one to three years of experience
- Wants a cleaner portfolio for job switching
- Has a stronger resume than GitHub presence
- Wants to emphasize business impact and engineering ownership

Primary goals:

- Convert resume accomplishments into a strong narrative
- Choose relevant projects
- Generate a professional website without starting from scratch

### 6.3 Secondary persona: GitHub-heavy builder

Characteristics:

- Has several personal or open-source projects
- May have weak resume writing
- Needs assistance ranking and describing repositories

Primary goals:

- Identify the most portfolio-worthy repositories
- Explain architecture and contribution clearly
- Avoid overwhelming recruiters with too many projects

### 6.4 Future persona: Career coach or bootcamp

This persona is not required for MVP implementation but may influence later features such as reusable templates, review workflows, and student cohorts.

---

## 7. Core User Journey

### 7.1 End-to-end journey

```text
Landing page
  → Start portfolio
  → Upload resume PDF
  → Resume text extraction
  → AI structured extraction
  → Review identity, education, experience, projects, and skills
  → Enter GitHub username
  → Import public profile and repositories
  → Select up to configured repository limit
  → Analyze selected repositories
  → Generate portfolio headline, bio, project copy, and skills grouping
  → Review source evidence and warnings
  → Manually edit portfolio content
  → Configure limited theme options
  → Preview desktop and mobile layouts
  → Run final portfolio review
  → Download complete ZIP
  → Follow README to deploy
```

### 7.2 Required user control points

Users must be able to:

- Reject incorrect resume fields
- Correct dates and titles
- Remove experiences or projects
- Add missing information manually
- Choose which repositories are included
- Edit every AI-generated sentence
- Hide optional sections
- Reorder projects and experiences
- Select from supported theme settings
- Confirm questionable claims
- Download without creating an account during private prototype, if configured

---

## 8. MVP Scope

### 8.1 MVP feature list

#### A. Landing and onboarding

- Product explanation
- Example portfolio preview
- Privacy summary
- Start-building action
- Supported input explanation
- Clear statement that exported code belongs to the user

#### B. Resume upload

- PDF-only upload
- Configurable file-size limit
- Configurable page limit
- MIME-type and extension validation
- Encrypted/unreadable PDF handling
- Text extraction
- Text-quality check
- Temporary processing only
- User-facing error messages

#### C. Resume structured extraction

- Name
- Preferred headline inputs
- Location, when present and explicitly retained
- Email and public links, with privacy controls
- Education
- Work experience
- Projects
- Skills
- Awards and certifications
- Source references
- Confidence values
- Unresolved-field warnings

#### D. Resume review UI

- Editable identity fields
- Editable experience list
- Editable education list
- Editable project list
- Editable skill groups
- Add/remove/reorder actions
- Source indicator per field
- Confidence indicator for uncertain extraction
- Save-to-local-session behavior for prototype

#### E. GitHub import

- Public GitHub username input
- Profile lookup
- Public repository listing
- Repository filtering
- Repository sorting
- Basic repository metadata
- Primary language
- Topics when available
- Stars and forks
- Last updated date
- README retrieval
- User repository selection
- Configurable repository maximum

#### F. GitHub project analysis

- Source-grounded project description
- Problem statement
- Technical summary
- Technology stack
- Notable implementation details
- Suggested portfolio priority
- Suggested recruiter-friendly title
- Confidence and evidence references

#### G. AI portfolio generation

- Headline generation
- Short biography generation
- Experience-summary rewriting
- Project-description generation
- Skills grouping
- Project ranking
- Final consistency and quality review

#### H. Portfolio editor

- Direct editing of all generated text
- Add/remove sections
- Reorder projects
- Reorder experience
- Hide optional sections
- Contact-link editing
- Theme controls limited to supported settings
- Live validation
- Unsaved-change warning

#### I. Portfolio preview

- Desktop preview
- Mobile preview
- Responsive template
- Empty-state handling
- Long-text handling
- Invalid-link warnings
- Missing-image fallback
- Accessible navigation

#### J. Export

- Deterministic template packaging
- Inject validated portfolio JSON
- Add user-selected images when supported
- Generate SEO metadata
- Generate project README
- Generate deployment guide
- Generate license notice
- ZIP download
- Export manifest validation

#### K. Basic protection and reliability

- Server-only AI credentials
- Per-operation input limits
- Per-user or per-session usage limits
- IP rate limits for public beta
- Error logging without sensitive content
- Token and cost logging
- Schema validation
- Retry rules
- Timeout handling

### 8.2 MVP template scope

The MVP includes one production-quality template named `minimal-engineer`.

Required sections:

- Navigation
- Hero
- About
- Experience
- Featured projects
- Skills
- Education
- Contact/footer

Required characteristics:

- Responsive
- Accessible
- SEO-friendly
- Static-export compatible
- No builder platform dependency
- Configurable accent color from an approved set
- Optional light/dark preference if implemented without destabilizing scope
- No animation requirement beyond subtle, accessible transitions

### 8.3 MVP AI scope

The AI system is not a general chatbot. It exposes only approved operations:

- `extract_resume`
- `analyze_repository`
- `generate_headline`
- `generate_bio`
- `rewrite_experience`
- `generate_project_description`
- `group_skills`
- `rank_projects`
- `review_portfolio`

Each operation must have its own request schema, response schema, prompt version, limits, and tests.

---

## 9. Future Scope

### 9.1 Near-term future features

- User accounts
- Cloud project saving
- Multiple portfolio versions
- Additional templates
- GitHub OAuth or GitHub App
- Private repository opt-in
- One-click GitHub repository creation
- One-click Vercel deployment
- User-supplied custom domain guidance
- Portfolio update reminders
- Job-specific portfolio variants
- Additional AI review modes
- Portfolio analytics

### 9.2 Additional integrations

- Devpost
- LeetCode
- Codeforces
- HackerRank
- GitLab
- Bitbucket
- Medium
- Hashnode
- YouTube project demos
- Figma project previews
- Google Drive resume import
- Gmail or Calendar for career workflow products, only if product scope later expands

### 9.3 Advanced AI features

- Project case-study generation
- Architecture-diagram suggestions
- Interview explanations for each project
- Role-specific content emphasis
- Resume-to-portfolio consistency checks
- Portfolio content freshness detection
- Skills-gap analysis
- Recruiter persona reviews
- Voice-guided content collection
- Automated project screenshot guidance

### 9.4 Features requiring explicit reconsideration

The following should not be added casually because they materially change security or architecture:

- User-provided API keys
- Permanent resume storage
- Private repository access
- Automatic deployment
- Custom code injection
- AI-generated source files
- Third-party template uploads
- Multi-tenant organizations

---

## 10. High-Level System Architecture

### 10.1 Architecture style

The MVP uses a modular monolith:

- One Next.js application
- One TypeScript codebase
- Server-side route handlers
- External managed services only where necessary
- No separate backend service
- No microservices

### 10.2 Logical architecture

```text
User Browser
  │
  ├── Onboarding UI
  ├── Resume Review UI
  ├── GitHub Project Selector
  ├── Portfolio Editor
  ├── Preview
  └── ZIP Download
  │
  ▼
Next.js Application
  │
  ├── Presentation Layer
  ├── Application/Use-Case Layer
  ├── Domain Schemas and Rules
  ├── Integration Adapters
  ├── Export Engine
  └── Server Route Handlers
  │
  ├────────► OpenAI API
  ├────────► GitHub REST API
  ├────────► Supabase Auth/Postgres, public beta and later
  └────────► Upstash Redis, public beta and later
```

### 10.3 Core architectural rule

> The LLM outputs validated content data. The application generates code by combining that data with a curated, tested template.

### 10.4 Trust boundaries

1. **Browser input:** Untrusted.
2. **Uploaded resume:** Untrusted and sensitive.
3. **GitHub README content:** Untrusted and may contain prompt-injection text.
4. **AI response:** Untrusted until schema validation and domain validation pass.
5. **Template files:** Trusted application assets.
6. **Database values:** Trusted only after validation and authorization checks.
7. **Exported ZIP:** Must be treated as a security-sensitive deliverable.

---

## 11. Technology Stack

### 11.1 Main application framework: Next.js

Use Next.js App Router for:

- Frontend routes
- Server-rendered pages where appropriate
- Client-side builder interfaces
- Route handlers for resume, GitHub, AI, and export operations
- Static asset handling
- Deployment to Vercel

Reasons:

- One repository for frontend and backend
- Strong TypeScript support
- Mature React ecosystem
- Straightforward server-only environment variables
- Good compatibility with AI coding agents
- Good deployment workflow
- Supports static output for generated portfolios

Do not introduce Express, NestJS, FastAPI, or another backend framework during MVP unless a measured technical constraint requires it.

### 11.2 Language: TypeScript

TypeScript is required across:

- React components
- Route handlers
- Domain types
- Zod schemas
- Integration clients
- Export logic
- Tests
- Scripts

Strict mode should be enabled.

Required compiler expectations:

- No implicit `any`
- Strict null checks
- No unchecked external payload usage
- Explicit return types for public service functions
- Narrowed error types

### 11.3 Frontend framework: React

React is used for:

- Multi-step builder flow
- Dynamic lists of experiences and projects
- Editable forms
- Live preview
- Validation feedback
- Local draft state

Avoid Redux for MVP. Use:

- Server state through route calls
- React Hook Form for form state
- Local React state for small UI state
- Zustand only if cross-page builder state becomes difficult to maintain

### 11.4 Styling: Tailwind CSS

Use Tailwind CSS for:

- Layout
- Spacing
- Typography
- Responsive behavior
- Theme tokens
- Focus states
- Component composition

Rules:

- Avoid excessive arbitrary values
- Use shared design tokens
- Avoid page-specific color systems
- Maintain consistent maximum widths
- Use semantic component wrappers
- Validate mobile layouts at common widths

### 11.5 Component library: shadcn/ui

Use shadcn/ui selectively for:

- Buttons
- Inputs
- Textareas
- Selects
- Dialogs
- Tabs
- Toasts
- Tooltips
- Dropdown menus
- Progress indicators
- Alerts
- Confirmation dialogs

Rules:

- Components are owned in the repository
- Customization must follow central design tokens
- Do not duplicate similar components
- Accessibility behavior must not be removed

### 11.6 Forms: React Hook Form

Use React Hook Form for:

- Resume review form
- Experience editing
- Project editing
- Skills editing
- Theme settings
- Contact-link editing

Use field arrays for dynamic sections.

### 11.7 Validation: Zod

Zod is the canonical runtime validation library.

Required schemas include:

- `ResumeProfileSchema`
- `GitHubProfileSchema`
- `RepositoryCandidateSchema`
- `RepositoryAnalysisSchema`
- `PortfolioDataSchema`
- `ThemeSettingsSchema`
- `AIUsageRecordSchema`
- `ExportRequestSchema`
- `ExportManifestSchema`

All external data must be parsed through a schema before use.

### 11.8 AI provider: OpenAI Responses API

The OpenAI API is used only from server-side code.

Requirements:

- API key stored in server environment variables
- Separate development and production projects
- Structured outputs where supported
- Prompt versioning
- Token usage recording
- Timeout and retry policies
- Model routing by operation
- No user access to the platform API key
- No API key included in downloaded files

### 11.9 GitHub integration: GitHub REST API

MVP behavior:

- Public username lookup
- Public repository listing
- Repository metadata retrieval
- README retrieval
- Language retrieval when cost-effective
- Rate-limit awareness
- Caching where appropriate

Do not download entire repositories.

### 11.10 Resume PDF extraction

Use a Node-compatible PDF text extraction library that works in the chosen server runtime.

Requirements:

- Confirm runtime compatibility before adoption
- Enforce file and page limits
- Reject encrypted or unreadable PDFs
- Avoid OCR in MVP
- Preserve enough line structure for extraction quality
- Never log full extracted text

### 11.11 Database: Supabase Postgres

Database use is optional for the private local prototype and required for a public beta with accounts and usage credits.

Use Supabase for:

- Authentication
- User records
- Portfolio draft metadata
- Portfolio JSON, if cloud saving is enabled
- AI usage records
- Credit balances
- Export events

Use Row Level Security for user-owned rows.

### 11.12 Authentication: Supabase Auth

Public beta login methods:

- GitHub
- Google

Avoid custom password storage.

### 11.13 Rate limiting: Upstash Redis

Use Upstash for:

- Burst limiting
- Per-IP request limits
- Per-user AI operation limits
- Temporary idempotency keys
- Abuse-prevention counters

Long-term generation balances belong in Postgres, not Redis.

### 11.14 ZIP generation

Use a maintained ZIP library such as JSZip or a server-compatible archive library.

Selection criteria:

- Server runtime compatibility
- Memory behavior
- Streaming support if later required
- Safe path handling
- Predictable binary output

### 11.15 Testing

- Vitest for unit and service tests
- React Testing Library for component behavior where valuable
- Playwright for end-to-end browser tests
- GitHub Actions for CI

### 11.16 Deployment

- Vercel for the builder application
- Supabase for data and auth
- Upstash for rate limiting
- GitHub for source control and CI
- Static hosts for user-exported portfolios

---

## 12. Repository Structure

```text
ai-portfolio-generator/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── export-template-build.yml
│   │   └── security-checks.yml
│   └── pull_request_template.md
├── docs/
│   ├── product-requirements.md
│   ├── mvp-scope.md
│   ├── user-flow.md
│   ├── system-architecture.md
│   ├── data-model.md
│   ├── api-contracts.md
│   ├── ai-pipeline.md
│   ├── ai-safety-rules.md
│   ├── export-contract.md
│   ├── privacy-model.md
│   ├── threat-model.md
│   ├── testing-strategy.md
│   ├── deployment-runbook.md
│   ├── incident-response.md
│   └── adr/
│       ├── 001-modular-monolith.md
│       ├── 002-schema-driven-generation.md
│       ├── 003-no-arbitrary-code-generation.md
│       ├── 004-server-owned-ai-key.md
│       ├── 005-stateless-private-prototype.md
│       └── 006-public-beta-persistence.md
├── public/
│   ├── brand/
│   └── examples/
├── scripts/
│   ├── validate-template.ts
│   ├── build-export-fixture.ts
│   ├── inspect-export.ts
│   └── seed-development-data.ts
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── privacy/
│   │   ├── builder/
│   │   │   ├── page.tsx
│   │   │   ├── upload/
│   │   │   ├── resume-review/
│   │   │   ├── github/
│   │   │   ├── generate/
│   │   │   ├── edit/
│   │   │   ├── preview/
│   │   │   └── export/
│   │   └── api/
│   │       ├── resume/
│   │       │   ├── extract/route.ts
│   │       │   └── structure/route.ts
│   │       ├── github/
│   │       │   ├── profile/route.ts
│   │       │   ├── repositories/route.ts
│   │       │   └── analyze/route.ts
│   │       ├── ai/
│   │       │   ├── headline/route.ts
│   │       │   ├── bio/route.ts
│   │       │   ├── experience/route.ts
│   │       │   ├── project/route.ts
│   │       │   ├── rank/route.ts
│   │       │   └── review/route.ts
│   │       └── export/route.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── builder/
│   │   ├── evidence/
│   │   └── preview/
│   ├── features/
│   │   ├── resume/
│   │   ├── github/
│   │   ├── portfolio/
│   │   ├── ai/
│   │   ├── export/
│   │   ├── auth/
│   │   └── usage/
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts
│   │   │   ├── operation-registry.ts
│   │   │   ├── usage.ts
│   │   │   ├── errors.ts
│   │   │   └── prompts/
│   │   ├── github/
│   │   ├── pdf/
│   │   ├── export/
│   │   ├── database/
│   │   ├── rate-limit/
│   │   ├── logging/
│   │   └── security/
│   ├── schemas/
│   ├── types/
│   ├── constants/
│   └── styles/
├── templates/
│   └── minimal-engineer/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── data/portfolio.json
│       │   └── styles/
│       ├── public/
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── README.md
│       └── LICENSE
├── tests/
│   ├── fixtures/
│   │   ├── resumes/
│   │   ├── github/
│   │   ├── ai/
│   │   └── portfolios/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
└── vitest.config.ts
```

---

## 13. Domain Data Model

### 13.1 Core PortfolioData

The `PortfolioData` object is the canonical product output.

```ts
interface PortfolioData {
  schemaVersion: string;
  identity: Identity;
  summary: PortfolioSummary;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: PortfolioProject[];
  skills: SkillGroup[];
  awards: AwardEntry[];
  links: PortfolioLinks;
  sectionVisibility: SectionVisibility;
  ordering: SectionOrdering;
  theme: ThemeSettings;
  metadata: PortfolioMetadata;
}
```

### 13.2 Evidence-aware field

Any AI-generated claim should support source metadata.

```ts
interface EvidenceAwareText {
  value: string;
  sourceType: "resume" | "github" | "user" | "ai_synthesis";
  sourceReferences: SourceReference[];
  confidence: "high" | "medium" | "low";
  userConfirmed: boolean;
  warnings: string[];
}
```

### 13.3 Source reference

```ts
interface SourceReference {
  sourceId: string;
  sourceType: "resume_section" | "resume_bullet" | "github_metadata" | "github_readme" | "user_input";
  label: string;
  excerpt?: string;
}
```

Do not include long sensitive excerpts in persistent storage unless necessary.

### 13.4 Identity

Fields:

- Full name
- Preferred display name
- Headline
- Short bio
- Location, optional
- Email visibility
- Public email, optional
- Profile image path, optional
- Pronouns, optional and user-entered only

### 13.5 Education

Fields:

- Institution
- Degree
- Field of study
- Start date
- End date or expected graduation
- GPA, optional and user-controlled
- Coursework, optional
- Honors, optional

### 13.6 Experience

Fields:

- Organization
- Role
- Employment type, optional
- Location, optional
- Start date
- End date
- Current-role flag
- Summary
- Achievement bullets
- Technologies
- Source evidence
- Display priority

### 13.7 Portfolio project

Fields:

- Stable ID
- Display title
- Original repository name
- Short description
- Long description, optional
- Problem solved
- Technical contributions
- Technology stack
- Repository URL
- Live demo URL, user-confirmed only
- Image path, optional
- Featured flag
- Source evidence
- Confidence
- Ranking score and ranking reasons

### 13.8 Skills

Skill groups may include:

- Languages
- Frameworks
- Backend
- Databases
- Cloud and DevOps
- Testing
- Developer tools
- AI/ML
- Hardware or embedded systems
- Other

The user must be able to rename groups and move skills.

### 13.9 Theme settings

MVP settings:

- Template ID
- Accent preset
- Default appearance mode
- Hero alignment, only if template supports it
- Section visibility

Avoid arbitrary CSS values in user data.

---

## 14. Database Design

### 14.1 Private prototype

The private prototype may avoid a database entirely.

State may exist:

- In browser memory
- In a temporary local draft
- In server memory only during a request

No public launch should rely solely on browser-side counters for AI usage.

### 14.2 Public beta tables

#### `users`

- `id`
- `email`
- `display_name`
- `plan`
- `created_at`
- `updated_at`
- `terms_accepted_at`
- `privacy_accepted_at`

#### `portfolio_projects`

- `id`
- `user_id`
- `name`
- `portfolio_data`
- `schema_version`
- `template_id`
- `created_at`
- `updated_at`
- `last_exported_at`

#### `portfolio_versions`

Optional for later beta.

- `id`
- `portfolio_project_id`
- `version_number`
- `portfolio_data`
- `created_at`
- `change_summary`

#### `ai_usage`

- `id`
- `user_id`
- `request_id`
- `operation`
- `prompt_version`
- `model`
- `input_tokens`
- `output_tokens`
- `cached_tokens`, optional
- `estimated_cost_usd`
- `duration_ms`
- `status`
- `error_code`, optional
- `created_at`

Never store raw API keys.

#### `generation_credits`

- `user_id`
- `billing_period`
- `full_generations_limit`
- `full_generations_used`
- `targeted_rewrites_limit`
- `targeted_rewrites_used`
- `updated_at`

#### `export_events`

- `id`
- `user_id`
- `portfolio_project_id`
- `template_id`
- `schema_version`
- `export_status`
- `manifest_hash`
- `created_at`

### 14.3 Row Level Security

Rules:

- Users may read and update only their own portfolio projects.
- Users may read only their own AI usage summaries.
- Users may not directly modify usage counters.
- Service-role operations must remain server-only.
- Export event writes occur through trusted server routes.

---

## 15. API Contracts

All API endpoints must:

- Validate input with Zod
- Return typed success payloads
- Return a consistent error shape
- Enforce request-size limits
- Enforce authentication when required
- Enforce rate limits
- Generate a request ID
- Avoid logging sensitive content

### 15.1 Standard error response

```json
{
  "error": {
    "code": "RESUME_UNREADABLE",
    "message": "We could not read text from this PDF.",
    "requestId": "req_...",
    "retryable": false,
    "details": []
  }
}
```

### 15.2 Resume extraction endpoint

`POST /api/resume/extract`

Input:

- Multipart PDF file

Output:

- Extracted text metadata
- Page count
- Character count
- Extraction quality status
- Temporary source identifier

The endpoint must not expose full resume text in server logs.

### 15.3 Resume structuring endpoint

`POST /api/resume/structure`

Input:

- Cleaned resume text
- Optional user hints

Output:

- `ResumeProfile`
- Extraction warnings
- Source references
- AI usage summary

### 15.4 GitHub profile endpoint

`GET /api/github/profile?username=...`

Output:

- Validated public profile fields
- Normalized profile URL
- Avatar URL
- Bio
- Public repository count
- Rate-limit metadata when useful

### 15.5 GitHub repositories endpoint

`GET /api/github/repositories?username=...`

Query controls:

- Maximum result count
- Sort order
- Fork inclusion policy
- Archived repository inclusion policy

Output:

- Normalized repository candidates

### 15.6 Repository analysis endpoint

`POST /api/github/analyze`

Input:

- Selected repository IDs
- Desired target role, optional
- Existing resume project evidence, optional

Output:

- One validated analysis per repository
- Ranking signals
- Warnings
- AI usage summary

### 15.7 AI content endpoints

Each operation has a dedicated route or a shared route with a strict operation registry.

Preferred design:

`POST /api/ai/:operation`

The operation must be one of the approved enum values.

The server must reject unknown operations.

### 15.8 Export endpoint

`POST /api/export`

Input:

- Validated `PortfolioData`
- Template ID
- Optional image assets

Output:

- ZIP binary
- Download filename
- Export manifest hash in response headers when appropriate

The route must validate the entire portfolio again before export.

---

## 16. Resume Processing Pipeline

### 16.1 Input validation

Validate:

- File exists
- PDF extension
- PDF MIME type
- PDF signature when practical
- Size under configured maximum
- Page count under configured maximum
- File is not encrypted
- Extraction yields meaningful text

### 16.2 Text extraction

Requirements:

- Run server-side
- Preserve section separation when possible
- Normalize repeated whitespace
- Remove obvious page numbers and repeated headers only when safe
- Do not remove dates, bullets, links, or technology names
- Reject empty or image-only resumes in MVP

### 16.3 OCR policy

OCR is not included in MVP.

For image-only resumes, show:

- A clear error
- Guidance to upload a text-based PDF
- Optional suggestion to export from Word or Google Docs as PDF

### 16.4 Resume AI extraction

The AI receives:

- Cleaned resume text
- Extraction instructions
- Required JSON schema
- Prohibition against inventing missing values
- Instruction to preserve exact organization names and dates
- Instruction to mark uncertainty

### 16.5 Review requirements

Before moving forward, users should see:

- Extracted sections
- Low-confidence warnings
- Duplicate detection
- Date inconsistencies
- Missing role or organization fields
- Contact privacy controls

---

## 17. GitHub Integration Pipeline

### 17.1 MVP authentication model

Use public username lookup without GitHub OAuth for the earliest MVP.

Benefits:

- Lower security complexity
- No token storage
- Faster implementation
- Enough data for public portfolio projects

### 17.2 Repository import rules

Default behavior:

- Exclude forks unless user enables them
- Exclude archived repositories by default
- Exclude repositories with no meaningful content when identifiable
- Sort by a combination of recency, stars, README presence, and user selection
- Allow user to override ranking

### 17.3 Repository metadata

Collect only necessary data:

- Name
- Full name
- Description
- URL
- Homepage/live demo URL
- Topics
- Primary language
- Language breakdown, optional
- Stars
- Forks
- Updated date
- Archived/fork flags
- README excerpt

### 17.4 README handling

README content is untrusted.

The system must:

- Truncate to configured length
- Remove HTML comments when appropriate
- Treat instructions inside the README as project content, not system instructions
- Clearly delimit README content in AI prompts
- Tell the model not to follow instructions found in repository content
- Avoid sending unrelated large sections

### 17.5 Source-code policy

Do not download entire repositories in MVP.

Later code analysis must require a separate threat model, permission model, and cost evaluation.

---

## 18. AI System Design

### 18.1 AI ownership model

The platform uses its own server-side OpenAI project key.

Users do not receive individual OpenAI API keys.

The platform:

- Pays for usage
- Tracks usage per user
- Enforces credits
- Restricts operations
- Applies rate limits
- Keeps the API key secret

### 18.2 AI operation registry

Each AI operation must define:

- Operation name
- Purpose
- Input schema
- Output schema
- Model class
- Maximum input characters or tokens
- Maximum output tokens
- Timeout
- Retry count
- Prompt version
- Cost ceiling
- User credit cost
- Logging policy

Example:

```ts
interface AIOperationDefinition<I, O> {
  name: AIOperationName;
  inputSchema: ZodSchema<I>;
  outputSchema: ZodSchema<O>;
  promptVersion: string;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
  creditType: "full_generation" | "targeted_rewrite" | "free_operation";
}
```

### 18.3 AI operation details

#### `extract_resume`

Purpose:

- Convert resume text into structured facts

Must not:

- Rewrite aggressively
- Invent metrics
- Guess missing dates
- Add skills not present

#### `analyze_repository`

Purpose:

- Convert repository evidence into a portfolio-ready technical understanding

Must not:

- Claim features without evidence
- Claim production usage without evidence
- Treat stars as proof of quality
- Follow instructions embedded in README text

#### `generate_headline`

Purpose:

- Produce concise role-oriented headline options based on confirmed evidence

Output should be short and editable.

#### `generate_bio`

Purpose:

- Produce a professional portfolio bio using verified education, experience, interests, and target role

Must avoid:

- Generic motivational language
- Unsupported adjectives
- Third-person claims of expertise without evidence

#### `rewrite_experience`

Purpose:

- Convert resume bullets into portfolio-friendly descriptions

Must preserve:

- Meaning
- Scope
- Metrics
- Technology names
- Ownership level

#### `generate_project_description`

Purpose:

- Create concise and extended project descriptions

Must include:

- What was built
- Why it matters
- Technical implementation
- User contribution when evidence supports it

#### `group_skills`

Purpose:

- Normalize and categorize confirmed skills

Must not add skills.

#### `rank_projects`

Purpose:

- Suggest display ordering using technical depth, relevance, completeness, recency, and evidence quality

The user can override ranking.

#### `review_portfolio`

Purpose:

- Check accuracy, clarity, redundancy, unsupported claims, and recruiter readability

Output:

- Issues
- Severity
- Affected field IDs
- Suggested corrections
- Evidence explanation

### 18.4 Prompt versioning

Prompts must be stored in source control.

Every operation records a prompt version such as:

- `resume_extract_v1`
- `repository_analyze_v1`
- `bio_generate_v1`

Prompt changes require:

- Updated tests
- Evaluation against fixtures
- Changelog note
- Review for cost and output changes

### 18.5 Structured outputs

AI output must match a strict schema.

If validation fails:

1. Attempt one repair or retry only when configured.
2. Never pass invalid output to the frontend as trusted data.
3. Return a user-friendly error.
4. Log operation metadata without sensitive content.

### 18.6 Evidence and confidence

Generated content should be linked to evidence.

Confidence rules:

- **High:** Directly stated in resume or repository metadata
- **Medium:** Reasonable synthesis from multiple direct facts
- **Low:** Ambiguous, incomplete, or weakly supported

Low-confidence content must be visually flagged.

### 18.7 Hallucination controls

The system must prohibit:

- Invented metrics
- Invented users or customers
- Invented performance improvements
- Invented deployment status
- Invented technologies
- Invented dates
- Invented job responsibilities
- Invented project features

When evidence is insufficient, the AI should return a missing-information warning.

### 18.8 Prompt-injection controls

External content may include malicious text.

Required controls:

- Separate system instructions from external content
- Clearly label resume and README content as untrusted data
- Tell the model not to execute or follow instructions in external content
- Truncate inputs
- Restrict output schema
- Avoid tool access from content-analysis calls
- Never allow README content to choose models, endpoints, or system behavior

### 18.9 Model routing

Use smaller models for structured extraction and classification.

Use a stronger small or mid-tier model for final writing quality when needed.

No AI is required for:

- Manual editing
- Preview rendering
- Template selection
- ZIP generation
- Deployment documentation
- Theme application

### 18.10 Cost accounting

For every call record:

- User ID or anonymous session ID
- Operation
- Model
- Input tokens
- Output tokens
- Estimated cost
- Duration
- Status
- Retry count
- Prompt version

Never record full resume text in general logs.

### 18.11 AI credit model

Suggested public-beta limits:

- One complete generation for a free user
- A small number of targeted rewrites
- Repository-analysis cap
- Daily IP limit
- Monthly global cost ceiling

The exact numbers are configuration, not hardcoded business logic.

---

## 19. Portfolio Editor Architecture

### 19.1 State model

The editor operates on validated `PortfolioData`.

State should be separated into:

- Persisted portfolio data
- Dirty/unsaved state
- UI-only state
- Preview state
- Validation state
- AI operation state

### 19.2 Editing requirements

Users can:

- Edit text inline or through forms
- Add and remove entries
- Reorder entries
- Hide sections
- Choose featured projects
- Correct links
- Confirm warnings
- Undo recent changes when feasible

### 19.3 Validation behavior

Validation should be immediate but not disruptive.

Examples:

- Invalid URL
- Headline too long
- Empty required name
- End date before start date
- Duplicate project links
- Missing project description
- Excessive biography length

### 19.4 Autosave

Private prototype:

- Save draft in browser storage only if privacy expectations are clearly communicated

Public beta:

- Save normalized portfolio JSON to the user-owned database row
- Debounce writes
- Show save state
- Handle conflicts conservatively

### 19.5 Accessibility

The editor must support:

- Keyboard navigation
- Visible focus
- Proper labels
- Screen-reader announcements for generation state
- Accessible drag/reorder alternatives
- Error summaries
- Sufficient contrast

---

## 20. Preview Architecture

### 20.1 Shared renderer

The builder preview and exported template should share the same rendering contract.

Preferred approach:

- Keep template components reusable or mirrored through a controlled package boundary
- Ensure the same `PortfolioData` fixture produces equivalent visual output

### 20.2 Preview modes

- Desktop
- Tablet, optional
- Mobile

The preview may use a responsive container rather than an iframe if the component structure permits it safely.

### 20.3 Empty and error states

Every section must handle:

- No data
- Very long text
- Missing optional image
- Broken external link
- One project only
- Many skills
- No awards
- No experience, for student users

---

## 21. Export Architecture

### 21.1 Export principle

The exporter never asks AI to generate source code.

It:

1. Loads a trusted template.
2. Validates portfolio data.
3. Injects data and approved assets.
4. Updates metadata files.
5. Creates a ZIP.
6. Validates the export manifest.
7. Returns the ZIP.

### 21.2 Exported codebase structure

```text
my-portfolio/
├── src/
│   ├── app/
│   ├── components/
│   ├── data/
│   │   └── portfolio.json
│   └── styles/
├── public/
│   └── assets/
├── package.json
├── next.config.ts
├── tsconfig.json
├── README.md
├── DEPLOYMENT.md
└── LICENSE
```

### 21.3 Required export properties

- Builds without builder API access
- Contains no secrets
- Contains no private database identifiers
- Contains no internal prompts
- Contains no raw resume file unless user explicitly asks in a future feature
- Uses relative local asset paths
- Includes editable data file
- Includes installation instructions
- Includes deployment instructions
- Includes dependency versions
- Includes static-export configuration

### 21.4 Export manifest

The exporter should create or internally validate a manifest containing:

- Template ID
- Template version
- Portfolio schema version
- Export timestamp
- Expected file list
- Asset list
- Hashes for critical files when practical

### 21.5 Export validation

Before download:

- Portfolio schema passes
- Template exists
- Required files exist
- Output paths are safe
- No path traversal is possible
- Assets fit size limits
- Generated metadata is escaped
- No secret patterns are detected

### 21.6 CI export build test

CI must:

1. Generate an export from a fixture.
2. Extract the ZIP.
3. Install dependencies.
4. Run lint.
5. Run typecheck.
6. Run tests if included.
7. Run production build.
8. Confirm static output exists.

This is a release-blocking test.

---

## 22. Security Architecture

### 22.1 Secrets

Secrets include:

- OpenAI API key
- Supabase service-role key
- GitHub App secrets, future
- Monitoring credentials

Rules:

- Store only in server environment configuration
- Never expose through `NEXT_PUBLIC_*`
- Never log secrets
- Never include secrets in exports
- Rotate after suspected exposure
- Use separate development and production credentials

### 22.2 File-upload security

Controls:

- PDF-only allowlist
- File-size limit
- Page-count limit
- Timeout
- No arbitrary file execution
- Random temporary names
- Immediate cleanup
- No user-controlled filesystem paths

### 22.3 Injection and XSS

Controls:

- Escape all user content during rendering
- Do not render arbitrary HTML from resumes or README files
- Sanitize markdown if rendered
- Validate URLs
- Restrict protocols to `https`, `http`, and approved schemes
- Do not use `dangerouslySetInnerHTML` for untrusted content

### 22.4 Authorization

For public beta:

- Every saved project belongs to a user
- Server verifies ownership on every request
- Usage counters cannot be modified by clients
- Service-role keys remain server-only

### 22.5 Rate limiting

Apply limits to:

- Resume extraction
- AI operations
- GitHub import
- Export generation
- Authentication attempts where applicable

Use both:

- IP-based limits
- User-based limits

### 22.6 Abuse prevention

Potential abuse:

- Bot-generated AI spending
- Oversized resumes
- Repeated long README analysis
- Attempted prompt injection
- ZIP generation abuse
- Scraping public GitHub through the platform

Controls:

- Authentication before expensive operations in public beta
- CAPTCHA or equivalent on suspicious signup paths
- Generation credits
- Global spending ceiling
- Request body limits
- Repository count limits
- README truncation
- Circuit breaker for AI spend

### 22.7 Dependency security

- Lock dependency versions
- Use automated dependency alerts
- Avoid unnecessary packages
- Review packages that process PDFs and archives carefully
- Run security scans in CI

---

## 23. Privacy and Data Retention

### 23.1 Data classification

Sensitive data may include:

- Name
- Email
- Phone number
- Address
- Employment history
- Education history
- Immigration-related text accidentally included in resumes
- Private personal links

### 23.2 MVP retention policy

Private prototype:

- Process resume temporarily
- Do not persist raw PDF
- Do not persist raw extracted text beyond the active workflow
- Do not log content

Public beta:

- Persist normalized portfolio data only when user chooses to save
- Do not store raw PDF by default
- Provide project deletion
- Delete associated saved content on user request
- Retain operational usage metadata separately from resume content

### 23.3 AI data handling

The privacy notice must explain:

- Which content is sent to the AI provider
- Why it is sent
- What is not stored by the application
- That users should review generated text
- That users can remove sensitive information before generation

### 23.4 Logging policy

Allowed:

- Request ID
- Operation name
- Status
- Token usage
- Duration
- Error code
- User ID or hashed session identifier

Disallowed in normal logs:

- Full resume text
- Full README content
- Full AI prompt
- Full AI response containing personal data
- Email or phone number
- API keys

### 23.5 User deletion

Public beta must support deletion of:

- Saved portfolio projects
- Portfolio versions
- User-owned profile data

Operational logs may be retained only according to a documented limited policy.

---

## 24. Error Taxonomy

### 24.1 Resume errors

- `RESUME_MISSING`
- `RESUME_TOO_LARGE`
- `RESUME_TOO_MANY_PAGES`
- `RESUME_INVALID_TYPE`
- `RESUME_ENCRYPTED`
- `RESUME_UNREADABLE`
- `RESUME_NO_TEXT`
- `RESUME_EXTRACTION_TIMEOUT`

### 24.2 GitHub errors

- `GITHUB_USER_NOT_FOUND`
- `GITHUB_RATE_LIMITED`
- `GITHUB_REPOSITORY_NOT_FOUND`
- `GITHUB_README_UNAVAILABLE`
- `GITHUB_UPSTREAM_ERROR`

### 24.3 AI errors

- `AI_LIMIT_EXCEEDED`
- `AI_RATE_LIMITED`
- `AI_TIMEOUT`
- `AI_INVALID_OUTPUT`
- `AI_PROVIDER_ERROR`
- `AI_CONTENT_TOO_LARGE`
- `AI_CREDIT_EXHAUSTED`

### 24.4 Export errors

- `EXPORT_INVALID_PORTFOLIO`
- `EXPORT_TEMPLATE_NOT_FOUND`
- `EXPORT_ASSET_TOO_LARGE`
- `EXPORT_UNSAFE_PATH`
- `EXPORT_GENERATION_FAILED`
- `EXPORT_VALIDATION_FAILED`

### 24.5 Authentication and authorization errors

- `AUTH_REQUIRED`
- `AUTH_FORBIDDEN`
- `AUTH_SESSION_EXPIRED`
- `RESOURCE_NOT_OWNED`

### 24.6 Error message requirements

Messages should:

- Be understandable
- State whether retrying helps
- Avoid exposing internal implementation
- Include request ID for support
- Provide a next action

---

## 25. Observability

### 25.1 Required telemetry

- Route latency
- Error count by code
- AI latency by operation
- AI validation failure rate
- AI token usage
- Estimated AI cost
- GitHub upstream failures
- Export generation time
- Export validation failures
- Rate-limit events

### 25.2 Dashboards

Minimum operational views:

- System health
- AI usage and cost
- AI operation failure rates
- Export reliability
- User funnel
- Abuse events

### 25.3 Alerts

Alert on:

- Unexpected AI spending spike
- Repeated invalid AI output
- Export build failures
- Elevated server errors
- GitHub integration outage
- Authentication failure spike
- Secret exposure warning

### 25.4 Sensitive data protection

Telemetry must use redaction rules and structured metadata only.

---

## 26. Testing Strategy

### 26.1 Testing pyramid

#### Unit tests

Test:

- Schema validation
- Date normalization
- URL validation
- Resume text cleanup
- GitHub payload normalization
- Skill grouping rules
- Cost calculations
- Usage-credit calculations
- Export path handling
- Manifest generation

#### Integration tests

Test:

- Resume extraction service with fixture PDFs
- AI operation wrapper with mocked provider responses
- GitHub client with mocked API responses
- Database authorization behavior
- Rate-limit behavior
- Export generation

#### Contract tests

Test:

- AI response schemas
- API request and response shapes
- Template-to-PortfolioData compatibility
- Database payload expectations
- Export manifest

#### End-to-end tests

Test full user flows with Playwright.

### 26.2 Required fixtures

Resume fixtures:

- Student resume
- Experienced engineer resume
- Two-page resume
- Resume with tables
- Resume with missing dates
- Resume with duplicate skills
- Empty PDF
- Encrypted PDF
- Image-only PDF

GitHub fixtures:

- Normal public profile
- No public repositories
- Many repositories
- Fork-heavy profile
- Archived repositories
- Missing README
- Long README
- README containing prompt-injection text
- Rate-limited response

Portfolio fixtures:

- Full student portfolio
- Experience-heavy portfolio
- Project-heavy portfolio
- No experience
- No awards
- Long text
- Missing optional images
- Invalid URL

### 26.3 AI evaluation suite

For each prompt version evaluate:

- Schema validity
- Fact preservation
- Unsupported-claim rate
- Metric preservation
- Date preservation
- Skill invention rate
- Writing clarity
- Output length
- Cost

Human review should score a fixed evaluation set before prompt changes are released.

### 26.4 Golden tests

Store approved structural outputs for fixed fixtures.

Do not require exact prose equality when model output is non-deterministic. Compare:

- Required fields
- Evidence references
- No invented skills
- Date preservation
- Warning behavior
- Length constraints

### 26.5 Export build test

Release-blocking.

### 26.6 Accessibility testing

- Automated accessibility scan
- Keyboard-only test
- Screen-reader spot check
- Contrast review
- Form error review

### 26.7 Performance testing

Measure:

- Resume extraction latency
- AI call latency
- GitHub import latency
- Preview responsiveness
- Export generation latency
- ZIP size

---

## 27. CI/CD

### 27.1 Pull request checks

Every pull request must run:

- Formatting check
- Lint
- Typecheck
- Unit tests
- Integration tests
- Contract tests
- Security scan
- Template validation
- Export fixture generation

### 27.2 Main-branch checks

Additionally run:

- Full Playwright suite
- Exported-project install and build
- Production application build

### 27.3 Deployment environments

- Local
- Preview
- Staging, recommended before public beta
- Production

Each environment should have separate:

- OpenAI project/key
- Supabase project or isolated configuration
- Rate-limit namespace
- Monitoring environment

### 27.4 Deployment policy

- Preview deployment for each PR
- Production deployment only from protected main branch
- Required review before merge
- Rollback procedure documented

---

## 28. Environment Variables

Example categories:

```text
OPENAI_API_KEY=
OPENAI_PROJECT_ID=
OPENAI_DEFAULT_MODEL=
OPENAI_MONTHLY_COST_CEILING_USD=

GITHUB_API_BASE_URL=
GITHUB_TOKEN= optional for server-side authenticated public API access

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

APP_BASE_URL=
APP_ENV=
LOG_LEVEL=

MAX_RESUME_BYTES=
MAX_RESUME_PAGES=
MAX_GITHUB_REPOSITORIES=
MAX_SELECTED_REPOSITORIES=
MAX_README_CHARACTERS=
MAX_EXPORT_ASSET_BYTES=
```

Rules:

- Validate environment variables at startup
- Fail fast for missing required production variables
- Never expose server secrets to client bundles
- Document all variables in `.env.example`

---

## 29. Cost-Control Architecture

### 29.1 Fixed-cost strategy

Use free tiers during prototype and private beta where permitted.

Avoid paying for:

- Multiple redundant AI coding subscriptions
- Dedicated servers
- Background workers
- Databases before persistence is needed
- Large object storage
- Premium analytics before launch

### 29.2 Variable AI cost controls

- Hard input limits
- Hard output limits
- Repository-selection cap
- README truncation
- One retry maximum
- Field-level regeneration
- No unrestricted chat
- Cached deterministic processing where safe
- User generation credits
- IP rate limits
- Global monthly cost ceiling
- Emergency disable switch for AI operations

### 29.3 Cost-per-operation tracking

Maintain estimated maximum and actual average costs for:

- Resume extraction
- Repository analysis
- Bio generation
- Experience rewrite
- Project rewrite
- Final review

### 29.4 Free-tier policy

A user should receive enough free usage to experience the product but not enough to create uncontrolled cost.

Suggested concept:

- One complete portfolio generation
- Limited targeted rewrites
- One final review

The exact limits should be configurable.

---

## 30. Performance and Scalability

### 30.1 MVP scale assumptions

The MVP should handle:

- Small private alpha
- Early public beta
- Bursty but modest AI usage
- Limited concurrent ZIP exports

### 30.2 Bottlenecks

Potential bottlenecks:

- PDF parsing
- AI latency
- GitHub rate limits
- ZIP memory use
- Serverless execution time

### 30.3 Scaling path

Only after measured need:

1. Add caching for GitHub metadata.
2. Stream or offload large ZIP generation.
3. Add background jobs for expensive workflows.
4. Split services only when operational data justifies it.

Do not preemptively create microservices.

---

## 31. Accessibility Requirements

The builder and template must target WCAG-conscious implementation.

Required:

- Semantic HTML
- Keyboard navigation
- Visible focus
- Proper labels
- Form-error association
- Sufficient contrast
- Reduced-motion respect
- Accessible modal behavior
- Descriptive link text
- Alt text for user images
- No color-only status communication

The exported portfolio should maintain the same accessibility quality.

---

## 32. SEO Requirements for Exported Portfolios

Generate:

- Page title
- Meta description
- Open Graph title
- Open Graph description
- Social preview image support, later optional
- Canonical base guidance
- Structured heading hierarchy
- Sitemap and robots file when appropriate

Avoid exposing private contact details unless the user enables them.

---

## 33. Design System Requirements

Define before building full pages:

- Typography scale
- Spacing scale
- Border radius
- Color tokens
- Accent presets
- Surface hierarchy
- Form states
- Error states
- Loading states
- Empty states
- Success states

The builder UI and exported template may have different visual identities, but each must be internally consistent.

Avoid:

- Excessive gradients
- Decorative glass effects without purpose
- Uncontrolled animations
- Inconsistent cards
- Random icon libraries
- AI-generated placeholder copy in production

---

## 34. AI Coding-Agent Operating Model

### 34.1 Role assignment

#### Product owner

The human owner decides:

- Scope
- UX quality
- Priorities
- Acceptance
- Budget
- Launch timing

#### Architecture/review agent

Claude or another reasoning-focused agent may:

- Draft specifications
- Review architecture
- Identify edge cases
- Review diffs
- Challenge unnecessary complexity

#### Primary implementation agent

Codex may:

- Implement scoped tickets
- Write tests
- Run checks
- Produce commits and pull requests

#### Interactive development agent

Cursor may:

- Inspect code
- Debug UI state
- Make small targeted changes
- Help with local runtime issues

#### Independent reviewer

Antigravity or another agent may:

- Review UX
- Test instructions
- Identify inconsistencies
- Compare implementation against acceptance criteria

### 34.2 Branch rules

- One feature or fix per branch
- One primary agent editing a branch at a time
- No simultaneous conflicting agents
- Atomic commits
- No unrelated refactors
- No dependency additions without justification

### 34.3 Ticket format

Every implementation ticket must include:

- Objective
- Background
- In-scope files or modules
- Explicit non-goals
- Acceptance criteria
- Required tests
- Security considerations
- Documentation updates
- Definition of done

### 34.4 AGENTS.md rules

Required rules include:

- Follow this architecture document
- Do not generate arbitrary portfolio source code with AI
- Validate all external data
- Do not expose secrets
- Do not introduce infrastructure outside scope
- Do not alter unrelated files
- Run required checks before completion
- Update ADRs when architectural decisions change
- Report assumptions and unresolved issues

### 34.5 Review checklist

Reviewers verify:

- Scope compliance
- Architecture compliance
- Security
- Error handling
- Accessibility
- Tests
- Dependency necessity
- No hidden data persistence
- No AI hallucination path
- No generated-code drift

---

## 35. Implementation Milestones

### Milestone 0: Documentation and architecture freeze

Deliverables:

- Product requirements
- MVP scope
- User flow
- Architecture
- Data schemas
- AI contracts
- API contracts
- Export contract
- Security and privacy model
- Test plan
- ADRs
- Backlog

Exit criteria:

- A new engineer can explain the system without guessing.
- All major boundaries are documented.
- Non-goals are explicit.

### Milestone 1: Static vertical slice

Build with fixture data only:

- Builder shell
- Portfolio editor
- Preview
- Single template
- ZIP export
- Export build validation

Exit criteria:

- Fixture portfolio can be edited.
- Preview matches export.
- Downloaded project builds successfully.

### Milestone 2: Resume ingestion

Build:

- PDF upload
- Validation
- Text extraction
- Resume structuring
- Review UI
- Error handling

Exit criteria:

- Supported fixture resumes produce valid structured data.
- Raw files are not permanently stored.
- Invalid files fail safely.

### Milestone 3: GitHub import

Build:

- Username lookup
- Repository listing
- Filters
- Selection
- README retrieval
- Rate-limit handling

Exit criteria:

- User can select public projects.
- Prompt-injection fixture is safely treated as data.

### Milestone 4: AI synthesis

Build:

- Headline
- Bio
- Experience rewrite
- Project analysis and descriptions
- Skills grouping
- Ranking
- Evidence display

Exit criteria:

- All outputs validate.
- Unsupported claims are flagged.
- Costs are recorded.

### Milestone 5: Hardening

Build:

- Rate limiting
- Usage credits
- Security checks
- Logging
- Monitoring
- Accessibility improvements
- Performance limits
- Error analytics

Exit criteria:

- Abuse controls tested.
- Sensitive logging reviewed.
- Operational dashboards available.

### Milestone 6: Public beta deployment

Build or configure:

- Authentication
- Database persistence
- Privacy and terms pages
- Feedback collection
- Staging and production
- Launch runbook

Exit criteria:

- End-to-end production smoke test passes.
- Cost ceiling configured.
- Incident response documented.

---

## 36. Detailed Initial Backlog

### Epic A: Repository foundation

1. Initialize Next.js TypeScript project.
2. Configure strict TypeScript.
3. Configure linting and formatting.
4. Add Vitest.
5. Add Playwright.
6. Add CI workflow.
7. Create repository architecture.
8. Add environment validation.
9. Add standard error model.
10. Add request-ID middleware/helper.

### Epic B: Domain schemas

1. Define `PortfolioDataSchema`.
2. Define resume schemas.
3. Define GitHub schemas.
4. Define evidence schemas.
5. Define theme schema.
6. Add schema unit tests.
7. Add schema-version policy.

### Epic C: Static template

1. Create `minimal-engineer` template.
2. Build hero section.
3. Build experience section.
4. Build projects section.
5. Build skills section.
6. Build education section.
7. Build contact section.
8. Add responsive behavior.
9. Add accessibility checks.
10. Add static-export configuration.

### Epic D: Builder editor

1. Create builder navigation.
2. Create portfolio form.
3. Add experience field array.
4. Add project field array.
5. Add skill grouping editor.
6. Add reorder controls.
7. Add section visibility.
8. Add theme selection.
9. Add validation summary.
10. Add unsaved-change warning.

### Epic E: Preview

1. Create shared portfolio renderer.
2. Add desktop preview.
3. Add mobile preview.
4. Add empty states.
5. Add long-content tests.
6. Add preview accessibility review.

### Epic F: Export

1. Create template loader.
2. Create portfolio data injector.
3. Create asset copier.
4. Create metadata generator.
5. Create README generator.
6. Create ZIP generator.
7. Add manifest validator.
8. Add secret-pattern scanner.
9. Add export endpoint.
10. Add exported-build CI job.

### Epic G: Resume

1. Add upload component.
2. Add file validation.
3. Add PDF parser.
4. Add extraction cleanup.
5. Add extraction quality checks.
6. Add resume AI schema.
7. Add AI extraction operation.
8. Add resume review form.
9. Add low-confidence warnings.
10. Add resume fixture tests.

### Epic H: GitHub

1. Add GitHub client.
2. Add username validation.
3. Add profile endpoint.
4. Add repository endpoint.
5. Add normalization.
6. Add filters.
7. Add repository selection UI.
8. Add README retrieval.
9. Add rate-limit handling.
10. Add prompt-injection fixtures.

### Epic I: AI operations

1. Add OpenAI server client.
2. Add operation registry.
3. Add usage calculation.
4. Add prompt versioning.
5. Add resume extraction prompt.
6. Add repository analysis prompt.
7. Add headline prompt.
8. Add bio prompt.
9. Add experience rewrite prompt.
10. Add project description prompt.
11. Add skill grouping prompt.
12. Add ranking prompt.
13. Add portfolio review prompt.
14. Add validation retry policy.
15. Add AI evaluation suite.

### Epic J: Public-beta controls

1. Add Supabase Auth.
2. Add users table.
3. Add portfolio projects table.
4. Add AI usage table.
5. Add generation credits.
6. Add Row Level Security.
7. Add Upstash rate limiting.
8. Add global spend guard.
9. Add account deletion.
10. Add privacy copy.

---

## 37. Definition of Done

A ticket is complete only when:

- Acceptance criteria pass
- Required tests exist and pass
- Typecheck passes
- Lint passes
- Error states are implemented
- Security implications are reviewed
- Accessibility implications are reviewed
- Documentation is updated
- No unrelated changes are included
- No secrets are introduced
- The implementation follows architecture decisions

A milestone is complete only when its exit criteria are demonstrated, not merely coded.

---

## 38. Launch Checklist

### Product

- Core flow works
- Copy is clear
- Example portfolio is accurate
- Privacy explanation is visible
- Feedback mechanism exists

### Technical

- Production build passes
- E2E smoke test passes
- Exported project builds
- Environment variables validated
- Rate limits active
- Cost ceiling active
- Error monitoring active

### Security

- Secrets reviewed
- Logs reviewed
- File limits active
- Authorization tested
- RLS tested
- Export secret scan active

### AI

- Prompt versions frozen
- Evaluation set passes
- Usage tracked
- Invalid output handling tested
- Unsupported-claim warnings work

### Operations

- Rollback procedure exists
- Incident-response contact exists
- Service status checks exist
- Support request IDs are visible

---

## 39. Risk Register

### Risk: AI invents claims

Mitigation:

- Evidence references
- Strict schemas
- Confidence labels
- User confirmation
- Final review operation

### Risk: Cost abuse

Mitigation:

- Authentication
- Credits
- Rate limits
- Input limits
- Global spending ceiling

### Risk: Broken downloaded project

Mitigation:

- Deterministic template
- Export schema validation
- CI build of exported fixture

### Risk: Privacy incident

Mitigation:

- No raw resume storage by default
- Sensitive-log redaction
- Server-only secrets
- Clear retention policy

### Risk: GitHub API limits

Mitigation:

- Repository caps
- Caching
- Authenticated server token when appropriate
- Graceful retry messaging

### Risk: AI-generated application slop

Mitigation:

- Architecture freeze
- Small tickets
- One primary implementation agent
- Strong code review
- No arbitrary code generation
- Shared schemas and templates

### Risk: Scope explosion

Mitigation:

- Explicit non-goals
- Milestone gates
- ADR requirement
- Public backlog separation

---

## 40. Architecture Decision Records

### ADR 001: Modular monolith

Decision:

Use one Next.js TypeScript application for the MVP.

Reason:

Lowest operational complexity and strongest consistency.

### ADR 002: Schema-driven portfolio generation

Decision:

Use validated `PortfolioData` as the boundary between ingestion, AI, editing, preview, and export.

### ADR 003: No arbitrary AI source-code generation

Decision:

AI generates content data only. Trusted templates generate code.

### ADR 004: Platform-owned AI API key

Decision:

The server uses a platform-owned OpenAI project key. Users do not provide or receive keys.

### ADR 005: Stateless private prototype

Decision:

The earliest prototype may operate without accounts or a database.

### ADR 006: Persistence for public beta

Decision:

Public beta introduces authentication, user-owned project storage, and usage accounting.

### ADR 007: Public GitHub import first

Decision:

Use public username import before OAuth or private repository support.

### ADR 008: One template at launch

Decision:

Ship one excellent template before adding more.

---

## 41. Open Questions Requiring Product Decisions

These do not block architecture documentation but must be resolved before corresponding implementation.

1. What is the product name?
2. Does the private prototype require login?
3. What is the maximum resume size and page count?
4. How many repositories may a user select?
5. Which exact AI models are assigned to each operation?
6. What are the free generation limits?
7. Is browser-local draft saving enabled before accounts?
8. Are user-uploaded profile images included in MVP?
9. Is dark mode included in the first template?
10. Which analytics service, if any, is approved?
11. What retention duration applies to operational logs?
12. Does public beta allow users to save portfolios in the cloud?
13. Is one-click deployment a post-beta feature or a paid feature?

Recommended defaults:

- No login for local demo; login for public beta
- Resume limit around a few megabytes and a small page count
- Maximum five selected repositories
- One template
- No permanent raw resume storage
- One free full generation
- Browser draft only for private prototype
- Profile image optional, with strict size and type limits

---

## 42. Recommended First Agent Prompt

Use this before application implementation:

> Read the project specification and all ADRs. Do not create application code yet. Audit the documents for contradictions, missing contracts, security gaps, ambiguous ownership, unbounded AI operations, and features that violate MVP scope. Produce a written architecture review with severity-ranked findings. For every finding, cite the affected section and propose a concrete correction. Do not introduce microservices, arbitrary AI source-code generation, permanent resume storage, private GitHub access, payments, or one-click deployment. Finish with a revised milestone backlog containing small, independently testable tickets and explicit acceptance criteria.

After the architecture review is accepted, use a separate prompt for Milestone 1 only.

---

## 43. Final System Definition

The completed MVP is a full-stack web application that:

- Accepts a resume PDF
- Extracts and structures career information
- Imports selected public GitHub projects
- Uses controlled AI operations to improve portfolio presentation
- Preserves source evidence and warns about uncertainty
- Lets users edit and confirm all content
- Renders one polished, responsive developer template
- Packages the validated portfolio into a complete downloadable codebase
- Requires no ongoing connection to the builder after export
- Protects the platform API key and limits usage cost
- Avoids unnecessary infrastructure and arbitrary generated code

The product should feel like a carefully engineered career tool, not an AI demo.

---

## 44. One-Sentence Architectural Rule

> Generate verified structured content, render it through tested templates, and give the user a clean codebase they fully own.


---

## 45. Functional Requirements Matrix

The following requirements are mandatory unless marked as a later-phase item.

| ID | Area | Requirement | MVP Priority | Verification |
|---|---|---|---|---|
| FR-001 | Resume | Accept a valid text-based PDF resume | Must | Upload integration test |
| FR-002 | Resume | Reject unsupported, oversized, encrypted, or unreadable files | Must | Negative fixture tests |
| FR-003 | Resume | Extract normalized text without permanent raw-file storage | Must | Service and retention tests |
| FR-004 | Resume | Convert extracted text into validated structured data | Must | AI contract test |
| FR-005 | Resume | Show uncertainty and missing information | Must | UI and schema test |
| FR-006 | Resume | Let the user edit every extracted field | Must | Playwright flow |
| FR-007 | GitHub | Resolve a public GitHub username | Must | API integration test |
| FR-008 | GitHub | List normalized public repositories | Must | Fixture contract test |
| FR-009 | GitHub | Let the user select and reorder repositories | Must | Component/E2E test |
| FR-010 | GitHub | Retrieve bounded README content | Must | Integration and limit test |
| FR-011 | AI | Generate a source-grounded headline | Must | AI evaluation fixture |
| FR-012 | AI | Generate an editable professional biography | Must | AI evaluation fixture |
| FR-013 | AI | Rewrite confirmed experiences without changing facts | Must | Fact-preservation test |
| FR-014 | AI | Generate project summaries using resume and GitHub evidence | Must | Evidence contract test |
| FR-015 | AI | Group only confirmed skills | Must | Skill-invention test |
| FR-016 | AI | Rank projects with reasons and permit user override | Must | Unit and UI test |
| FR-017 | AI | Flag unsupported or conflicting claims | Must | Review-operation test |
| FR-018 | Editor | Add, edit, remove, hide, and reorder supported content | Must | E2E test |
| FR-019 | Editor | Validate required values and links | Must | Unit and E2E test |
| FR-020 | Preview | Render the current validated portfolio responsively | Must | Visual/E2E test |
| FR-021 | Export | Package a trusted template with portfolio data | Must | Export contract test |
| FR-022 | Export | Produce a ZIP that builds successfully | Must | Release-blocking CI |
| FR-023 | Export | Include setup and deployment documentation | Must | Manifest test |
| FR-024 | Security | Keep all platform secrets server-side | Must | Build inspection and secret scan |
| FR-025 | Security | Enforce bounded input and output sizes | Must | Limit tests |
| FR-026 | Usage | Record AI tokens, cost estimate, operation, and status | Public beta | Database integration test |
| FR-027 | Usage | Enforce per-user and burst limits | Public beta | Rate-limit test |
| FR-028 | Auth | Authenticate public-beta users | Public beta | Auth E2E test |
| FR-029 | Persistence | Save only normalized user-owned portfolio data | Public beta | RLS and persistence test |
| FR-030 | Privacy | Delete saved user projects on request | Public beta | Deletion integration test |

### 45.1 Requirement traceability

Each ticket should reference one or more requirement IDs. Each release checklist should identify which requirement tests ran. Changes to a requirement must update:

- This matrix
- Relevant schemas
- Acceptance criteria
- Tests
- ADRs when architecture changes

---

## 46. Builder Workflow State Machine

The builder should be modeled as explicit states rather than loosely connected pages.

### 46.1 States

```text
NOT_STARTED
RESUME_SELECTED
RESUME_EXTRACTING
RESUME_EXTRACTION_FAILED
RESUME_STRUCTURING
RESUME_REVIEW_REQUIRED
RESUME_CONFIRMED
GITHUB_LOOKUP
GITHUB_LOOKUP_FAILED
REPOSITORY_SELECTION
REPOSITORY_ANALYSIS
PORTFOLIO_GENERATION
PORTFOLIO_REVIEW_REQUIRED
PORTFOLIO_EDITING
PORTFOLIO_VALID
EXPORTING
EXPORT_FAILED
EXPORT_READY
```

### 46.2 Transition rules

- A resume cannot be structured until text extraction succeeds.
- GitHub import cannot silently overwrite resume projects.
- AI synthesis should run only on confirmed resume data and selected repositories.
- Export must be disabled when required validation errors exist.
- Failed operations should return the user to the last stable state.
- Refreshing the page should not accidentally repeat a paid AI operation.
- A user may return to earlier steps, but downstream generated content should be marked stale when upstream facts change.

### 46.3 Staleness model

Examples:

- Editing a project title does not require reanalysis.
- Replacing a selected repository marks its generated project description stale.
- Changing target role marks headline, bio, ranking, and final review stale.
- Correcting an experience metric marks its rewritten portfolio copy stale.

Stale data should remain visible but clearly marked until regenerated or manually confirmed.

### 46.4 Recovery behavior

For every unstable state:

- Preserve the last valid data snapshot.
- Show a retry action only when the failure is retryable.
- Never charge duplicate credits for a server-confirmed failed request.
- Never trigger automatic repeated AI calls from component rerenders.

---

## 47. Server Request Lifecycle

Every sensitive or billable server request should follow a consistent lifecycle.

### 47.1 Standard lifecycle

```text
Receive request
  → Create request ID
  → Check content length
  → Parse input
  → Validate input schema
  → Authenticate user when required
  → Verify resource ownership
  → Apply IP and user rate limits
  → Check generation credits or global circuit breaker
  → Normalize and minimize external content
  → Execute operation with timeout
  → Validate external response
  → Apply domain invariants
  → Record usage and operational metadata
  → Commit credit usage atomically
  → Return typed response
```

### 47.2 Failure accounting

- Client validation failures consume no AI credit.
- Rate-limit failures consume no AI credit.
- Provider failures before a usable response generally consume no product credit, even if the provider reports minimal usage.
- Successful AI responses that fail application validation should follow a documented repair policy and should not double-charge the user.
- The database usage record should distinguish provider cost from user-facing credit consumption.

### 47.3 Timeouts

Each external dependency must have an explicit timeout. Do not rely on platform defaults.

Timeout errors should identify:

- Which operation timed out
- Whether retrying is safe
- Whether the user was charged a product credit

### 47.4 Response headers

Useful response metadata may include:

- Request ID
- Rate-limit remaining count
- Retry-after duration
- Export filename
- Export manifest hash

Do not expose provider secrets, internal stack traces, or raw prompts.

---

## 48. Caching, Idempotency, and Concurrency

### 48.1 Caching policy

Cache only data that is safe and useful.

Good cache candidates:

- Public GitHub profile metadata
- Public repository lists
- Repository README content for a short period
- Deterministic template metadata

Do not broadly cache:

- Raw resume text
- Personalized AI prompts
- Sensitive AI responses
- ZIP files containing personal information, unless a future explicit storage policy exists

### 48.2 Cache keys

Cache keys should include enough versioning to prevent stale schema collisions.

Examples:

```text
github:profile:v1:{normalizedUsername}
github:repos:v1:{normalizedUsername}
github:readme:v1:{owner}:{repo}:{defaultBranch}
```

### 48.3 Idempotency

Billable operations should accept or create an idempotency key.

Purpose:

- Prevent double charges from double clicks
- Prevent retries from creating duplicate usage records
- Prevent network reconnection from repeating an export or AI call

An idempotency record should store:

- User/session ID
- Operation
- Request hash
- Status
- Result reference or safe response metadata
- Expiration

### 48.4 Concurrent edits

Private prototype:

- Single browser session is assumed.

Public beta:

- Use `updated_at` or version numbers for optimistic concurrency.
- Reject or reconcile stale writes.
- Do not silently overwrite a newer portfolio version.

### 48.5 Duplicate submissions

UI controls must disable while an operation is active, but server-side idempotency remains required because client controls alone are insufficient.

---

## 49. Coding Standards

### 49.1 TypeScript

- Use strict typing.
- Avoid `any`; use `unknown` and narrow it.
- Prefer discriminated unions for operation states and errors.
- Do not cast external payloads before validation.
- Keep domain types separate from provider payload types.
- Use immutable transformations where practical.

### 49.2 Module boundaries

- UI components do not call provider SDKs directly.
- Route handlers remain thin.
- Business workflows belong in feature services or use cases.
- Integration adapters convert provider-specific data to domain models.
- Export logic does not depend on browser-only APIs.
- AI prompts do not live inside React components or route handlers.

### 49.3 Functions

- Prefer small, named functions.
- Make side effects obvious.
- Return typed result objects for expected failures.
- Throw only for truly exceptional or framework-handled failures.
- Do not hide provider retries in generic utility functions.

### 49.4 React

- Keep server and client components intentional.
- Add `use client` only when needed.
- Avoid large monolithic page components.
- Extract domain-specific form sections.
- Never trigger paid calls from render effects without explicit user action.
- Use stable IDs for dynamic field arrays.

### 49.5 Styling

- Reuse tokens and components.
- Do not create one-off visual systems per page.
- Maintain responsive behavior down to narrow mobile widths.
- Preserve focus outlines.
- Avoid animation that blocks interaction or ignores reduced-motion settings.

### 49.6 Comments and documentation

Comments should explain:

- Why a non-obvious decision exists
- Security assumptions
- Provider limitations
- Schema-version compatibility

Comments should not merely restate code.

### 49.7 Dependencies

Every new dependency requires:

- Purpose
- Why built-in or existing tools are insufficient
- Runtime compatibility
- Security/maintenance consideration
- Bundle or server impact

### 49.8 Generated code review

AI-generated implementation must receive the same review as human-written code. “The agent wrote it” is not evidence of correctness.

---

## 50. Local Development Setup

### 50.1 Prerequisites

- Supported Node.js LTS version
- Package manager selected and locked for the repository
- Git
- OpenAI development project key for AI phases
- Optional local or hosted Supabase development project for public-beta phases
- Optional Upstash development database for rate-limit phases

### 50.2 Initial setup

Expected workflow:

```bash
git clone <repository>
cd ai-portfolio-generator
cp .env.example .env.local
npm install
npm run dev
```

Use the repository's chosen package manager consistently. Do not mix lockfiles.

### 50.3 Development modes

Support clear modes:

- **Fixture mode:** No external API calls; ideal for UI and export development.
- **Integration mode:** Uses GitHub and mocked AI.
- **AI development mode:** Uses development OpenAI project with strict limits.
- **Public-beta mode:** Uses auth, database, and rate limiting.

### 50.4 Seed data

Provide fixtures for:

- Student profile
- Experienced engineer profile
- Project-heavy profile
- Minimal profile

Agents should use fixtures rather than repeatedly spending API tokens during UI work.

### 50.5 Required local commands

```text
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run validate:template
npm run test:export
```

Command names may vary, but equivalent capabilities are required and documented.

---

## 51. Versioning and Release Management

### 51.1 Application versioning

Use semantic versioning or a documented release convention.

### 51.2 Independent versions

Track separately:

- Builder application version
- Portfolio schema version
- Template version
- Prompt version for each AI operation
- API contract version when breaking changes occur

### 51.3 Schema migrations

When `PortfolioData` changes:

- Increment schema version when required.
- Add migration logic for saved projects.
- Maintain template compatibility rules.
- Update fixtures and export tests.

### 51.4 Template compatibility

Each template declares:

- Template ID
- Template version
- Supported portfolio schema range
- Supported sections
- Supported theme controls

### 51.5 Release notes

Release notes should identify:

- User-visible features
- Schema changes
- Prompt changes that may alter output
- Security fixes
- Known limitations

### 51.6 Rollback

A release must be reversible without corrupting saved portfolio data. Database migrations should follow backward-compatible deployment practices when possible.

---

## 52. Support and Incident Procedures

### 52.1 User-support data

Support should request:

- Request ID
- Approximate time
- Operation attempted
- Browser/device details when relevant

Support should not ask users to send API keys or full resumes through insecure channels.

### 52.2 Common support paths

#### Resume could not be read

- Verify file type and size
- Check whether the PDF is image-only or encrypted
- Suggest exporting a text-based PDF

#### GitHub profile could not be imported

- Verify username
- Check upstream status and rate limits
- Allow manual project entry as a future fallback

#### AI content is inaccurate

- Show source evidence
- Encourage correction and regeneration of the specific field
- Record anonymized issue category, not raw content

#### Export does not build

- Capture template and schema versions
- Reproduce using the export manifest
- Treat confirmed failures as release-blocking defects

### 52.3 Incident severity

- **SEV-1:** Secret exposure, widespread data leak, uncontrolled spending, or total production outage
- **SEV-2:** Major workflow unavailable, exports broadly broken, authentication failure
- **SEV-3:** Degraded individual operation, elevated errors, upstream dependency issue
- **SEV-4:** Minor UI defect or isolated content-quality issue

### 52.4 Emergency controls

Production should support:

- Disable all AI calls
- Disable a single AI operation
- Lower user limits
- Block export temporarily
- Rotate secrets
- Disable new signups
- Put application in maintenance mode when necessary

### 52.5 Post-incident review

For significant incidents document:

- Timeline
- Impact
- Root cause
- Detection gap
- Resolution
- Preventive actions
- Owners and deadlines

---

## 53. Final Implementation Guardrails

Before accepting any implementation, verify the following:

- The feature is inside the current milestone.
- The implementation uses validated domain data.
- No external content is trusted directly.
- No secret can enter the browser or export.
- No paid AI request can repeat accidentally.
- No AI content bypasses evidence and review controls.
- The exported project remains deterministic and buildable.
- The user can understand and recover from failure.
- Tests prove the behavior rather than only exercising code paths.
- Documentation and architecture decisions remain synchronized.

The project should optimize for a reliable first release, not maximum feature count.
