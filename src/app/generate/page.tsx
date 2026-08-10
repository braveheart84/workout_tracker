import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GenerateForm } from "./generate-form";

export default async function GeneratePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const maxUtc = new Date(todayUtc);
  maxUtc.setUTCDate(maxUtc.getUTCDate() + 6);
  const todayIso = todayUtc.toISOString().slice(0, 10);
  const maxIso = maxUtc.toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Generate Workout
          </h1>
          <Link href="/dashboard" className="text-sm underline">
            Back to dashboard
          </Link>
        </div>
        <GenerateForm todayIso={todayIso} maxIso={maxIso} />
      </div>
    </main>
  );
}
