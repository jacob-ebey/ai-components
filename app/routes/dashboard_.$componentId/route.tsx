import { useEffect, useMemo, useState } from "react";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  LinksFunction,
} from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { and, asc, eq } from "drizzle-orm";
import { OpenAI } from "openai";
import CodeEditor from "@uiw/react-textarea-code-editor";
import codeEditorStylesHref from "@uiw/react-textarea-code-editor/dist.css";

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

export const links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: codeEditorStylesHref,
  },
];

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

  const loading =
    modifyComponent.state !== "idle" || commitComponent.state !== "idle";

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

  const [code, setCode] = useState(revision.code);

  useEffect(() => {
    setCode(revision.code);
  }, [revision]);

  return (
    <main className="px-4 pb-4">
      <nav className="dark:bg-black bg-white rounded shadow flex space-x-2 text-sm">
        <div className="text-blue-500 dark:text-blue-300">
          <Link
            to="/dashboard"
            className="dark:hover:text-blue-200 hover:text-blue-700"
          >
            Dashboard
          </Link>
        </div>
        <div>
          <span className="text-gray-400 mx-1">/</span>
        </div>
        <div className="text-blue-500 dark:text-blue-300">
          <span className="text-gray-400">{component.name}</span>
        </div>
      </nav>
      <div className="relative flex flex-col-reverse lg:flex-row gap-4">
        <section className="flex-1 relative">
          <div className="pt-4 sticky top-0">
            <ComponentPreview code={code} />
          </div>
          {/* <pre className="overflow-x-auto p-4 border flex-1">
            <code className="text-sm font-mono">{revision.code}</code>
          </pre> */}
        </section>
        <section className="lg:max-w-md pt-4">
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
              disabled={loading}
            />
            {modifyComponent.data?.error && (
              <p className="text-red-500 text-sm mt-2">
                <strong>{modifyComponent.data.error}</strong>
              </p>
            )}
            <div className={cn("w-full mt-1", loading ? "" : "invisible")}>
              <div className="h-1 w-full bg-pink-100 overflow-hidden rounded-sm">
                <div className="animate-progress w-full h-full bg-pink-500 origin-left-right"></div>
              </div>
            </div>
          </modifyComponent.Form>

          <commitComponent.Form
            method="post"
            className="flex-1 flex flex-col"
            onReset={() => {
              setCode(revision.code);
            }}
          >
            <input type="hidden" name="intent" value="commit-component" />
            <CodeEditor
              name="code"
              aria-label="Code"
              className="border flex-1 font-mono whitespace-pre overflow-x-auto"
              key={revision.id}
              disabled={loading}
              rows={20}
              language="jsx"
              required
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
            />

            <div className="mt-4">
              <Label htmlFor="commit-message">Commit Message</Label>
              <Input
                type="text"
                name="commit-message"
                id="commit-message"
                placeholder="Commit message"
                disabled={loading}
                autoComplete="off"
                required
              />
              {commitComponent.data?.error && (
                <p className="text-red-500 text-sm mt-2">
                  <strong>{commitComponent.data.error}</strong>
                </p>
              )}
              <p className="mt-4">
                <Button disabled={loading} type="submit">
                  Commit manual edit
                </Button>
                <Button disabled={loading} type="reset" variant="secondary">
                  Reset
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
        const code = formData.get("code");
        const commitMessage = formData.get("commit-message");

        if (
          typeof code !== "string" ||
          !code ||
          typeof commitMessage !== "string" ||
          !commitMessage
        ) {
          return {
            error: "Invalid request",
          };
        }

        const openai = new OpenAI({ apiKey });
        const generated = await ai.generateEditFactory.build(openai)({
          input: {
            code,
            commitMessage,
            previousDescription: component.description,
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
            error: "Failed to commit component",
          };
        }

        const newRevisions = await db
          .insert(componentRevisionTable)
          .values({
            code,
            prompt: commitMessage,
            componentId: newComponent.id,
          })
          .returning({ id: componentRevisionTable.id });
        const newRevision = newRevisions[0];
        if (!newRevision) {
          return {
            error: "Failed to commit component",
          };
        }

        throw redirect(`/dashboard/${newComponent.id}?v=${newRevision.id}`);
      }
      default:
        throw new Error("Invalid intent");
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(error);
    return {
      error: `Failed to update component`,
    };
  }
}
