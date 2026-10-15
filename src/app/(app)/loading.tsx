export default function AppLoading() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded-md bg-muted" />
      </div>

      <div className="flex gap-2">
        <div className="h-10 w-64 rounded-md bg-muted" />
        <div className="h-10 w-32 rounded-md bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-5 space-y-3"
          >
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-9 w-full rounded-md bg-muted mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
