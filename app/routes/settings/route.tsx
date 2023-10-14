import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { db, openAiApiKeyTable } from "~/db.server";
import { sessionStorage } from "~/http.server";

export default function Settings() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isLoading = navigation.state == "submitting";

  return (
    <>
      <nav className="dark:bg-black bg-white px-4 rounded shadow flex space-x-2 text-sm">
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
          <span className="text-gray-400">Settings</span>
        </div>
      </nav>

      <main className="w-full max-w-sm mx-auto mt-6">
        <h1 className="text-2xl font-bold text-center mb-8">Settings</h1>
        <Form method="post">
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label htmlFor="open-api-api-key">OpenAI API Key</Label>
              <Input
                required
                id="open-api-api-key"
                name="open-api-api-key"
                type="text"
                placeholder="OpenAI API Key"
              />
            </div>
            {actionData?.error && (
              <p className="text-red-500 text-sm">{actionData.error}</p>
            )}
            <Button type="submit" disabled={isLoading} variant="outline">
              Save
            </Button>
          </div>
        </Form>
      </main>
    </>
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

  return { error: null };
}
