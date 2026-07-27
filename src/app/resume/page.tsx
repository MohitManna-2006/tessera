import type { Metadata } from "next";
import Link from "next/link";

import { OnboardingHeader } from "@/components/onboarding/onboarding-page";

export const metadata: Metadata = {
  title: "Resume import",
  description:
    "Resume import is the next step in Tessera's portfolio workflow.",
};

export default function ResumeBoundaryPage() {
  return (
    <div className="onboarding-shell">
      <OnboardingHeader />
      <main className="resume-boundary-main">
        <section
          className="resume-boundary-content"
          aria-labelledby="resume-boundary-title"
        >
          <p className="onboarding-eyebrow">Next step</p>
          <h1 id="resume-boundary-title">Resume import is coming next.</h1>
          <p>
            This first stage establishes the path into Tessera. Resume upload
            and extraction will arrive in a later stage; no file is uploaded or
            processed here.
          </p>
          <div className="onboarding-actions">
            <Link className="onboarding-primary-action" href="/">
              Back to Tessera
            </Link>
            <Link className="onboarding-secondary-action" href="/builder">
              Open builder
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
