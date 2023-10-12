import { Form, Link } from "@remix-run/react";

import { primaryButton } from "~/components/buttons";
import { link } from "~/components/defaults";
import { Input, Label } from "~/components/form";

export const LoginForm: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className="w-full max-w-sm mx-auto mt-6">
      <div className="bg-white dark:bg-black p-6 rounded shadow">
        <h1 className="text-2xl font-bold text-center mb-8">
          Sign In to Your Account
        </h1>

        <Form method="post">
          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              type="email"
              name="email"
              id="email"
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="mb-4">
            <Label htmlFor="password">Password</Label>
            <Input
              type="password"
              name="password"
              id="password"
              placeholder="Enter your password"
              required
            />
          </div>

          {children}

          <button type="submit" className={`w-full mt-6 ${primaryButton}`}>
            Sign In
          </button>
        </Form>

        <p className="mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className={link}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export const LoginFormError: React.FC<{ error: string }> = ({ error }) => {
  return (
    <p className="text-red-500 text-sm mt-2">
      <strong>{error}</strong>
    </p>
  );
};
