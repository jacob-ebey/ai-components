import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { and, asc, eq } from "drizzle-orm";
import { OpenAI } from "openai";
import { useMemo } from "react";

import * as ai from "~/ai.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  db,
  componentRevisionTable,
  componentTable,
  openAiApiKeyTable,
} from "~/db.server";
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
  const modifyComponent = useFetcher<typeof action>();
  const [searchParams] = useSearchParams();

  const v = searchParams.get("v");

  const revision = useMemo(() => {
    const id = Number.parseInt(v || "", 10);

    const found =
      Number.isSafeInteger(id) && revisions.find((r) => r.id === id);

    if (!found) {
      return revisions[revisions.length - 1];
    }

    return found;
  }, [revisions, v]);

  return (
    <main className="p-4">
      <nav className="mb-4">
        <Button asChild variant="link">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </nav>
      <div className="flex flex-col-reverse lg:flex-row gap-4">
        <section className="flex flex-col flex-1 overflow-x-auto">
          <modifyComponent.Form method="post" className="mb-4">
            <Label htmlFor="prompt">Modify Component</Label>
            <Input
              type="text"
              name="prompt"
              id="prompt"
              placeholder="Prompt"
              disabled={modifyComponent.state !== "idle"}
            />
            {modifyComponent.data?.error && (
              <p className="text-red-500 text-sm mt-2">
                <strong>{modifyComponent.data.error}</strong>
              </p>
            )}
          </modifyComponent.Form>

          <pre className="overflow-x-auto p-4 border flex-1">
            <code className="text-sm font-mono">{revision.code}</code>
          </pre>
        </section>
        <section className="lg:max-w-xs mb-8">
          <h1 className="text-2xl font-bold mb-4">{component.name}</h1>
          <p className="mb-8">{component.description}</p>

          <h2 className="text-xl font-bold mb-4">Revisions</h2>
          <ul className="flex flex-col gap-4">
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

export async function action({ params, request }: ActionFunctionArgs) {
  try {
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
        and(
          eq(componentTable.id, componentId),
          eq(componentTable.userId, userId)
        )
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

    const revisionToEdit = revisions[revisions.length - 1];

    const apiKeys = await db
      .select({
        apiKey: openAiApiKeyTable.apiKey,
      })
      .from(openAiApiKeyTable)
      .where(eq(openAiApiKeyTable.userId, userId));
    const apiKey = apiKeys[0]?.apiKey;

    if (!apiKey) {
      return {
        error: "You must provide an OpenAI API key.",
      };
    }

    const formData = await request.formData();
    const prompt = formData.get("prompt");

    if (typeof prompt !== "string" || !prompt) {
      return {
        error: "Invalid prompt",
      };
    }

    const openai = new OpenAI({ apiKey });
    const generated = await ai.iterateComponentFactory.build(openai)({
      input: {
        prompt,
        name: component.name,
        description: component.description,
        code: revisionToEdit.code,
      },
    });

    const newComponents = await db
      .update(componentTable)
      .set({
        name: generated.name,
        description: generated.description,
      })
      .where(
        and(
          eq(componentTable.id, componentId),
          eq(componentTable.userId, userId)
        )
      )
      .returning({ id: componentTable.id });
    const newComponent = newComponents[0];
    if (!newComponent) {
      return {
        error: "Failed to modify component",
      };
    }

    const newRevisions = await db
      .insert(componentRevisionTable)
      .values({
        code: generated.code,
        prompt: generated.prompt,
        componentId: newComponent.id,
      })
      .returning({ id: componentRevisionTable.id });
    const newRevision = newRevisions[0];
    if (!newRevision) {
      return {
        error: "Failed to modify component",
      };
    }

    throw redirect(`/dashboard/${newComponent.id}?v=${newRevision.id}`);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return {
      error: "Failed to modify component",
    };
  }
}
