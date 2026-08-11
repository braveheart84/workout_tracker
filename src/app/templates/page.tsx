import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { workoutSuggestionSchema } from "@/lib/workout-suggestion-schema";
import { BottomNav } from "@/components/bottom-nav";
import { TemplateRow } from "./template-row";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const templates = await prisma.workoutTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>

        <p className="text-muted-foreground text-sm">
          Save any accepted or completed workout as a template from its page,
          then start a new ad-hoc workout from one here - or pick one as a
          starting point next time you generate a single day.
        </p>

        {templates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No templates yet — open a workout and tap &quot;Save as
            Template&quot; to create one.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {templates.map((template) => {
              const parsed = workoutSuggestionSchema.safeParse(
                template.structure,
              );
              if (!parsed.success) return null;
              return (
                <TemplateRow
                  key={template.id}
                  id={template.id}
                  name={template.name}
                  structure={parsed.data}
                />
              );
            })}
          </ul>
        )}
        <div className="h-20" aria-hidden="true" />
      </div>
      <BottomNav />
    </main>
  );
}
