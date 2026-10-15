export default function AdminLoading() {
  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-muted" />
          <div className="h-4 w-64 rounded-md bg-muted" />
        </div>
        <div className="h-10 w-28 rounded-md bg-muted" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="h-10 w-52 rounded-md bg-muted" />
        <div className="h-10 w-36 rounded-md bg-muted" />
        <div className="h-10 w-24 rounded-md bg-muted" />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-4 py-3 flex gap-4">
          {[140, 100, 80, 80, 100].map((w, i) => (
            <div key={i} className="h-4 rounded bg-muted" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b last:border-0 px-4 py-3 flex gap-4 items-center">
            {[140, 100, 80, 80, 100].map((w, j) => (
              <div key={j} className="h-4 rounded bg-muted" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
