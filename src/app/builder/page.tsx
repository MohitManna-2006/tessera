import type { Metadata } from "next";

import { BuilderShell } from "@/components/builder/builder-shell";

export const metadata: Metadata = {
  title: "Portfolio builder",
  description: "Edit, preview, validate, and export your Tessera portfolio.",
};

export default function BuilderPage() {
  return <BuilderShell />;
}
