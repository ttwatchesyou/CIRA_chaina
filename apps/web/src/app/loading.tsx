export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
      <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-9 w-80 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl border bg-white" />)}
      </div>
    </main>
  );
}
