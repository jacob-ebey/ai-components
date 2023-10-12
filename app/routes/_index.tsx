import { type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { primaryButton, secondaryButton } from "~/components/buttons";

import { sessionStorage } from "~/http.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");

  return {
    loggedIn: !!userId,
  };
}

export default function Index() {
  const { loggedIn } = useLoaderData<typeof loader>();

  return (
    <main>
      <section className="px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold">
            Go quickly from idea to prototype.
          </h1>
          <p className="mt-4 text-lg">
            Generate new, or iterate on existing React components.
          </p>
          {loggedIn ? (
            <p className="mt-8">
              <a href="/dashboard" className={`inline-block ${primaryButton}`}>
                Dashboard
              </a>{" "}
              <button
                form="logout-form"
                type="submit"
                className={secondaryButton}
              >
                Logout
              </button>
            </p>
          ) : (
            <p className="mt-8">
              <a href="/signin" className={`inline-block ${primaryButton}`}>
                Sign In
              </a>{" "}
              <a href="/signup" className={`inline-block ${secondaryButton}`}>
                Sign Up
              </a>
            </p>
          )}
        </div>
      </section>
      <form hidden method="post" action="/logout" id="logout-form" />
    </main>
  );
}
