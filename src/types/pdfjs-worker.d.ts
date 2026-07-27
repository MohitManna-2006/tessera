declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: {
    initializeFromPort(port: unknown): void;
    setup(handler: unknown, port: unknown): void;
  };
}
