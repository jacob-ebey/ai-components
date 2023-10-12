import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { eq } from "drizzle-orm";

import { primaryButton } from "~/components/buttons";
import { Input, Label } from "~/components/form";
import { db, openAiApiKeyTable } from "~/db.server";
import { sessionStorage } from "~/http.server";

export default function Settings() {
  return (
    <main className="w-full max-w-sm mx-auto mt-6">
      <h1 className="text-2xl font-bold text-center mb-8">Settings</h1>
      <Form method="post">
        <Label htmlFor="open-api-api-key">OpenAI API Key</Label>
        <Input
          required
          id="open-api-api-key"
          name="open-api-api-key"
          type="text"
          placeholder="OpenAI API Key"
        />
        <button type="submit" className={`mt-4 ${primaryButton}`}>
          Save
        </button>
      </Form>
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

  const formData = await request.formData();
  const apiKey = formData.get("open-api-api-key");
  if (typeof apiKey !== "string" || !apiKey) {
    return {
      error: "You must provide an OpenAI API key.",
    };
  }

  await db
    .delete(openAiApiKeyTable)
    .where(eq(openAiApiKeyTable.userId, userId));
  await db.insert(openAiApiKeyTable).values({
    apiKey,
    userId,
  });

  return {};
}
