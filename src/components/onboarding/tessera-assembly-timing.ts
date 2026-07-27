export const ASSEMBLY_TIMING = {
  entering: 2260,
  assembled: 4200,
  resetting: 680,
  preparing: 240,
} as const;

export type AssemblyPhase = keyof typeof ASSEMBLY_TIMING;
