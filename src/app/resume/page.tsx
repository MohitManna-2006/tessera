import type { Metadata } from "next";

import { OnboardingHeader } from "@/components/onboarding/onboarding-page";
import { ResumeUpload } from "@/components/resume/resume-upload";

export const metadata: Metadata = {
  title: "Resume text extraction",
  description:
    "Upload a PDF resume and review its securely extracted plain text.",
};

export default function ResumePage() {
  return (
    <div className="onboarding-shell">
      <OnboardingHeader />
      <ResumeUpload />
    </div>
  );
}
