import type { Metadata } from "next";

import { OnboardingHeader } from "@/components/onboarding/onboarding-page";
import { GitHubImport } from "@/components/github/github-import";
import { getGitHubLimits } from "@/lib/github/server-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GitHub import",
  description: "Import public GitHub repositories to your portfolio.",
};

export default function GitHubPage() {
  const limits = getGitHubLimits();
  return (
    <div className="onboarding-shell">
      <OnboardingHeader />
      <GitHubImport maxSelectedRepos={limits.maxSelectedRepos} />
    </div>
  );
}
