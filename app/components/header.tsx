import React from "react";
import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";

const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center p-5 bg-white dark:bg-black">
      <div className="text-2xl font-bold text-gray-800 dark:text-white">RC</div>
      <div>
        <Button
          asChild
          variant="outline"
          className="text-gray-800 dark:text-white"
        >
          <Link to="/">Home</Link>
        </Button>
      </div>
    </header>
  );
};

export default Header;
