import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { and, asc, eq } from "drizzle-orm";

import { Button } from "~/components/ui/button";
import { db, componentRevisionTable, componentTable } from "~/db.server";
import { sessionStorage } from "~/http.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const componentId = Number.parseInt(params.componentId || "", 10);
  if (!Number.isSafeInteger(componentId)) {
    throw redirect("/dashboard");
  }

  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/signin");
  }

  const components = await db
    .select()
    .from(componentTable)
    .where(
      and(eq(componentTable.id, componentId), eq(componentTable.userId, userId))
    );
  const component = components[0];
  if (!component) {
    throw redirect("/dashboard");
  }

  const revisions = await db
    .select()
    .from(componentRevisionTable)
    .where(eq(componentRevisionTable.componentId, componentId))
    .orderBy(asc(componentRevisionTable.id));

  return {
    component,
    revisions,
  };
}

export default function ComponentDashboard() {
  const { component, revisions } = useLoaderData<typeof loader>();

  const revision = revisions[revisions.length - 1];

  return (
    <main className="p-4">
      <nav className="mb-4">
        <Button asChild variant="link">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </nav>
      <div className="flex flex-col-reverse lg:flex-row gap-4">
        <section className="flex flex-1 overflow-x-auto">
          <pre className="overflow-x-auto p-4 border flex-1">
            <code className="text-sm font-mono">{revision.code}</code>
          </pre>
        </section>
        <section className="lg:max-w-xs">
          <h1 className="text-2xl font-bold mb-4">{component.name}</h1>
          <p className="mb-8">{component.description}</p>

          <h2 className="text-xl font-bold mb-4">Revisions</h2>
          <ul>
            {revisions.map((revision, index) => (
              <li key={revision.id}>
                <Link
                  to={`/dashboard/${component.id}?v=${revision.id}`}
                  className="border p-4 block"
                >
                  <p>
                    <strong>v{index + 1}</strong>
                  </p>
                  <p>{revision.prompt}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
