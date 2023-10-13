import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { desc, eq, sql } from "drizzle-orm";
import { OpenAI } from "openai";

import * as ai from "~/ai.server";
import { link } from "~/components/defaults";
import { Input, Label } from "~/components/form";
import {
  db,
  componentRevisionTable,
  componentTable,
  openAiApiKeyTable,
} from "~/db.server";
import { sessionStorage } from "~/http.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/signin");
  }

  const apiKeys = await db
    .select({
      apiKey: openAiApiKeyTable.apiKey,
    })
    .from(openAiApiKeyTable)
    .where(eq(openAiApiKeyTable.userId, userId));
  const apiKey = apiKeys[0]?.apiKey;

  const dbComponents = await db
    .select({
      id: componentTable.id,
      name: componentTable.name,
      description: componentTable.description,
    })
    .from(componentTable)
    .where(eq(componentTable.userId, userId))
    .orderBy(desc(componentTable.id));

  const components: ((typeof dbComponents)[0] & {
    versions: number;
  })[] = [];

  for (const component of dbComponents) {
    const counts = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(componentRevisionTable)
      .where(eq(componentRevisionTable.componentId, component.id));

    const count = counts[0]?.count || 0;

    components.push({ ...component, versions: count });
  }

  return {
    hasApiKey: !!apiKey,
    components,
  };
}

export default function Dashboard() {
  const { hasApiKey, components } = useLoaderData<typeof loader>();

  const newComponent = useFetcher<typeof action>();

  return (
    <main>
      {hasApiKey ? (
        <newComponent.Form method="post" className="px-4 my-4">
          <Label htmlFor="prompt">New Component</Label>
          <Input
            type="text"
            name="prompt"
            id="prompt"
            placeholder="Prompt"
            disabled={newComponent.state !== "idle"}
          />
          {newComponent.data?.error && (
            <p className="text-red-500 text-sm mt-2">
              <strong>{newComponent.data.error}</strong>
            </p>
          )}
        </newComponent.Form>
      ) : (
        <div className="px-4 my-4">
          <p>
            You need an OpenAI API key to use this app.{" "}
            <Link to="/settings" className={link}>
              Go to settings
            </Link>{" "}
            to add your API key.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 dark:bg-black px-4 my-4">
        {newComponent.state !== "idle" && (
          <div className="block border dark:border-gray-600 rounded p-4">
            <h3 className="font-bold text-lg">
              Generating{" "}
              <small className="text-gray-600 dark:text-gray-200">v0</small>
            </h3>
            <p>{String(newComponent.formData?.get("prompt"))}</p>
          </div>
        )}
        {components.map((component, index) => (
          <a
            key={index}
            href={`/dashboard/${component.id}`}
            className="block border dark:border-gray-600 rounded p-4"
          >
            <h3 className="font-bold text-lg">
              {component.name}{" "}
              <small className="text-gray-600 dark:text-gray-200">
                v{component.versions}
              </small>
            </h3>
            <p>{component.description}</p>
          </a>
        ))}
      </div>
    </main>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");
  if (!userId) {
    throw redirect("/signin");
  }

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
  const generated = await ai.designComponentFactory.build(openai)({
    input: prompt,
  });

  const newComponents = await db
    .insert(componentTable)
    .values({
      name: generated.name,
      description: generated.description,
      userId,
    })
    .returning({ id: componentTable.id });
  const newComponent = newComponents[0];
  if (!newComponent) {
    return {
      error: "Failed to create component",
    };
  }

  await db.insert(componentRevisionTable).values({
    code: generated.code,
    prompt: generated.prompt,
    componentId: newComponent.id,
  });

  throw redirect(`/dashboard/${newComponent.id}`);
}
