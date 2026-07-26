export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-background px-6 py-16 text-foreground sm:px-10">
      <section className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Early development
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
          Tessera
        </h1>
        <p className="mt-5 text-xl font-medium text-slate-800">
          AI-Powered Developer Portfolio Platform
        </p>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
          Tessera will turn verified developer evidence from resumes and
          selected public GitHub projects into editable portfolio data, render
          it through curated templates, and export an independently deployable
          portfolio codebase.
        </p>
      </section>
    </main>
  );
}
