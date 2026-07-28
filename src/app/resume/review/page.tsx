import type { Metadata } from "next";

import { ResumeReviewPage } from "@/components/resume-review/resume-review-page";

export const metadata: Metadata = {
  title: "Review resume draft",
  description: "Review a private resume-derived portfolio draft.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReviewPage() {
  return <ResumeReviewPage />;
}
