import {
  redirect,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, passwordTable, userTable } from "~/db.server";
import { sessionStorage } from "~/http.server";

import { SignupForm, SignupFormError } from "./signup-form";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Signup() {
  const result = useActionData<typeof action>();

  return (
    <main>
      <SignupForm>
        {result?.error ? <SignupFormError error={result.error} /> : null}
      </SignupForm>
    </main>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const verifyPassword = formData.get("verify-password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return {
      error: "Invalid email or password 1",
    };
  }

  if (typeof verifyPassword !== "string" || password !== verifyPassword) {
    return {
      error: "Passwords do not match",
    };
  }

  const foundUsers = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email));
  const foundUser = foundUsers[0];

  if (foundUser) {
    return {
      error: "Invalid email or password 2",
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUsers = await db
    .insert(userTable)
    .values({
      email,
    })
    .returning({ id: userTable.id });
  const newUser = newUsers[0];

  if (!newUser) {
    return {
      error: "Invalid email or password 3",
    };
  }

  await db.insert(passwordTable).values({
    userId: newUser.id,
    hashedPassword,
  });

  const session = await sessionStorage.getSession();
  session.set("userId", newUser.id);

  throw redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}
