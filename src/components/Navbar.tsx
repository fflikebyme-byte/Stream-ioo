import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-border">
      <div className="container flex items-center h-14">
        <Link to="/" className="font-display font-extrabold text-lg sm:text-xl">
          Stream<span className="text-gradient">io</span>
        </Link>
      </div>
    </header>
  );
};
