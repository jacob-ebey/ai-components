import { type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
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
    <main className="p-4">
      <section className="text-center py-20 bg-gray-100 dark:bg-black">
        <h1 className="text-4xl mb-4 font-bold text-gray-800 dark:text-white">
          Go quickly from idea to prototype.
        </h1>
        <p className="text-xl mb-10 text-gray-500 dark:text-gray-300">
          Generate new, or iterate on existing React components.
        </p>
        <div className="flex justify-center gap-4">
          {loggedIn ? (
            <>
              <Button asChild variant="outline">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button form="logout-form" type="submit" variant="ghost">
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </section>
      <form hidden method="post" action="/logout" id="logout-form" />
    </main>
  );
}
