import { getAllInitiatives } from "@/lib/db/initiatives";
import { RoadmapTable } from "@/components/roadmap-table";

export default async function HomePage() {
  const initiatives = await getAllInitiatives();

  return (
    <main className="flex-1 flex flex-col px-6 py-6 gap-4">
      {/* Page header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {initiatives.length} initiative{initiatives.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Table */}
      <RoadmapTable initiatives={initiatives} />
    </main>
  );
}
