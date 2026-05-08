import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top nav */}
      <header className="border-b border-border bg-background px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">🗺️ Roadmap Creator</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      {/* Placeholder body */}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-2xl font-semibold">Milestone 1 complete ✅</h2>
        <p className="text-muted-foreground max-w-md">
          You are signed in (user ID: <code className="font-mono text-sm bg-muted px-1 rounded">{userId}</code>).
          The roadmap table will appear here in Milestone 4.
        </p>
      </main>
    </div>
  );
}
