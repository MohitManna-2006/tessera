import type { Metadata } from "next";

import { OnboardingPage } from "@/components/onboarding/onboarding-page";

export const metadata: Metadata = {
  title: "Tessera · Developer portfolios you own",
  description:
    "Bring your developer experience together in an editable portfolio and download the complete codebase.",
};

export default function HomePage() {
  return <OnboardingPage />;
}
