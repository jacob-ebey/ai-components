import { Link } from "@remix-run/react";

import { link } from "./defaults";

const Header = () => {
  return (
    <header className="flex justify-between items-center p-4 bg-white dark:bg-black">
      <p className="text-3xl font-bold text-gray-800 dark:text-white">RC</p>
      <Link to="/" className={`text-lg ${link}`}>
        Home
      </Link>
    </header>
  );
};

export default Header;
