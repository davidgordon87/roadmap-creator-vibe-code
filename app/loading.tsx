import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex-1 flex flex-col px-6 py-6 gap-4">
      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-20 mt-1.5" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex gap-4 px-4 py-2.5 bg-muted/40 border-b border-border">
          {[260, 100, 50, 60, 80, 120, 80].map((w, i) => (
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
          >
            <div className="space-y-1.5" style={{ width: 260 }}>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-8 rounded-full" style={{ width: 50 }} />
            <Skeleton className="h-4 w-10 rounded" style={{ width: 60 }} />
            <Skeleton className="h-6 w-6 rounded-full" style={{ width: 80 }} />
            <Skeleton className="h-5 w-16 rounded" style={{ width: 120 }} />
            <Skeleton className="h-3.5 w-14 ml-auto" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
