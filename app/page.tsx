import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl font-semibold">Milestone 1 complete ✅</h2>
      <p className="text-muted-foreground max-w-md">
        You are signed in (user ID:{" "}
        <code className="font-mono text-sm bg-muted px-1 rounded">
          {userId}
        </code>
        ). The roadmap table will appear here in Milestone 4.
      </p>
    </main>
  );
}
