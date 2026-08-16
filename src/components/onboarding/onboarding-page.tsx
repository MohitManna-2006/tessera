import Link from "next/link";

import { TesseraAssembly } from "./tessera-assembly";

const workflowSteps = [
  {
    number: "01",
    title: "Import your experience",
    description: "Start with the experience and projects you already have.",
  },
  {
    number: "02",
    title: "Review and personalize",
    description: "Shape every detail before it becomes part of your portfolio.",
  },
  {
    number: "03",
    title: "Download what you own",
    description: "Export a complete codebase you can run and deploy anywhere.",
  },
] as const;

export function OnboardingHeader() {
  return (
    <header className="onboarding-header">
      <div className="onboarding-container onboarding-header-inner">
        <Link className="onboarding-wordmark wordmark" href="/">
          Tessera
        </Link>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Link className="open-builder-link" href="/github">
            GitHub import
          </Link>
          <Link className="open-builder-link" href="/builder">
            Open builder
          </Link>
        </div>
      </div>
    </header>
  );
}

function WorkflowSequence() {
  return (
    <section className="onboarding-workflow" aria-labelledby="workflow-heading">
      <h2 id="workflow-heading" className="visually-hidden">
        How Tessera works
      </h2>
      <ol>
        {workflowSteps.map((step) => (
          <li key={step.number}>
            <span className="workflow-number">{step.number}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OnboardingPage() {
  return (
    <div className="onboarding-shell">
      <OnboardingHeader />
      <main>
        <section className="onboarding-hero" aria-labelledby="onboarding-title">
          <div className="onboarding-container onboarding-hero-grid">
            <div className="onboarding-hero-copy">
              <p className="onboarding-eyebrow">
                AI-powered developer portfolios
              </p>
              <h1 id="onboarding-title">
                Turn your experience into a portfolio <span>you own.</span>
              </h1>
              <p className="onboarding-supporting-copy">
                Bring your experience, projects, and skills together in a
                polished portfolio—then download the complete codebase.
              </p>
              <div className="onboarding-actions">
                <Link className="onboarding-primary-action" href="/resume">
                  Build from my resume
                </Link>
                <Link className="onboarding-secondary-action" href="/github">
                  Import from GitHub
                </Link>
                <Link
                  className="onboarding-secondary-action"
                  href="/builder?source=sample"
                >
                  Explore a sample
                </Link>
              </div>
            </div>
            <TesseraAssembly />
          </div>
        </section>

        <div className="onboarding-container">
          <WorkflowSequence />
          <p className="onboarding-trust-line">
            <span aria-hidden="true" />
            No account required. Your exported portfolio remains yours.
          </p>
        </div>
      </main>
    </div>
  );
}
