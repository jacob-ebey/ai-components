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
import { ComponentPreview } from "~/components/component-preview";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  db,
  componentRevisionTable,
  componentTable,
  openAiApiKeyTable,
} from "~/db.server";
import { sessionStorage } from "~/http.server";
import { cn } from "~/lib/utils";

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
  const commitComponent = useFetcher<typeof action>();
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
        <section className="flex-1 relative">
          <div className="pt-4 sticky top-0">
            <ComponentPreview code={revision.code} />
          </div>
          {/* <pre className="overflow-x-auto p-4 border flex-1">
            <code className="text-sm font-mono">{revision.code}</code>
          </pre> */}
        </section>
        <section className="lg:max-w-s">
          <h1 className="text-2xl font-bold mb-4 break-words">
            {component.name}
          </h1>
          <p className="mb-8">{component.description}</p>

          <h2 className="text-xl font-bold mb-4">Revisions</h2>
          <ul className="flex flex-col gap-4">
            {revisions.map((revision, index) => (
              <li key={revision.id}>
                <Link
                  to={`/dashboard/${component.id}?v=${revision.id}`}
                  className="border p-4 block"
                  preventScrollReset
                >
                  <p>
                    <strong>v{index + 1}</strong>
                  </p>
                  <p>{revision.prompt}</p>
                </Link>
              </li>
            ))}
          </ul>

          <modifyComponent.Form method="post" className="my-4">
            <input type="hidden" name="intent" value="modify-component" />
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
            <div
              className={cn(
                "w-full mt-1",
                modifyComponent.state !== "idle" ? "" : "invisible"
              )}
            >
              <div className="h-1 w-full bg-pink-100 overflow-hidden rounded-sm">
                <div className="animate-progress w-full h-full bg-pink-500 origin-left-right"></div>
              </div>
            </div>
          </modifyComponent.Form>

          <commitComponent.Form method="post" className="flex-1 flex flex-col">
            <input type="hidden" name="intent" value="commit-component" />
            <Textarea
              className="border flex-1 font-mono"
              key={revision.id}
              defaultValue={revision.code}
              disabled={modifyComponent.state !== "idle"}
              rows={20}
              required
            />

            <div className="mt-4">
              <Label htmlFor="update-message">Commit Message</Label>
              <Input
                type="text"
                name="update-message"
                id="update-message"
                placeholder="Commit message"
                disabled={modifyComponent.state !== "idle"}
                required
              />
              <p className="mt-4">
                <Button
                  disabled={modifyComponent.state !== "idle"}
                  type="submit"
                >
                  Commit manual edit
                </Button>
              </p>
            </div>
          </commitComponent.Form>
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
    const intent = formData.get("intent");
    switch (intent) {
      case "modify-component": {
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
      }
      case "commit-component": {
        throw new Error("Not implemented");
        break;
      }
      default:
        throw new Error("Invalid intent");
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return {
      error: `Failed to update component`,
    };
  }
}
