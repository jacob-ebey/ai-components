import { Form, Link, useNavigation } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export const LoginForm: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const navigation = useNavigation();
  const isLoading = navigation.state == "submitting";

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-white">
            Or{" "}
            <Link
              to="/signup"
              className="font-medium text-blue-500 underline-offset-4 hover:underline"
            >
              head over to sign up
            </Link>
          </p>
        </div>
        <Form className="mt-8 space-y-6" method="POST">
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label className="sr-only" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                placeholder="name@example.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-1">
              <Label className="sr-only" htmlFor="password">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                placeholder="Password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>
            {children}
            <Button type="submit" disabled={isLoading}>
              Sign In with Email
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export const LoginFormError: React.FC<{ error: string }> = ({ error }) => {
  return (
    <p className="text-red-500 text-sm">
      <strong>{error}</strong>
    </p>
  );
};
