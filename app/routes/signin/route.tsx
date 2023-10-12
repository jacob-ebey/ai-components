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

import { LoginForm, LoginFormError } from "./login-form";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  const result = useActionData<typeof action>();

  return (
    <main>
      <LoginForm>
        {result?.error ? <LoginFormError error={result.error} /> : null}
      </LoginForm>
    </main>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return {
      error: "Invalid email or password",
    };
  }

  const foundUsers = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email));
  const foundUser = foundUsers[0];

  if (!foundUser || foundUsers.length > 1) {
    return {
      error: "Invalid email or password",
    };
  }

  const foundPasswords = await db
    .select({
      hashedPassword: passwordTable.hashedPassword,
    })
    .from(passwordTable)
    .where(eq(passwordTable.userId, foundUser.id));
  const foundPassword = foundPasswords[0];

  if (
    !foundPassword ||
    !(await bcrypt.compare(password, foundPassword.hashedPassword))
  ) {
    return {
      error: "Invalid email or password",
    };
  }

  const session = await sessionStorage.getSession();
  session.set("userId", foundUser.id);

  throw redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}
