import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { startAdHocWorkoutAction } from "@/app/workouts/actions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">Logged in as {session.user.email}</p>
      <form action={startAdHocWorkoutAction}>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Start ad-hoc workout
        </button>
      </form>
      <div className="flex gap-4 text-sm">
        <Link href="/history" className="underline">
          History
        </Link>
        <Link href="/exercises" className="underline">
          Exercise library
        </Link>
        <Link href="/settings" className="underline">
          Account settings
        </Link>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="border-input rounded-md border px-3 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
