import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SchoolLogo } from "@/components/FieldworkShell";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center p-4 text-slate-950" style={{ backgroundImage: "linear-gradient(rgba(248,250,247,.34), rgba(248,250,247,.44)), url('images/zone-a-background_2.png')" }}>
      <div className="rounded-3xl border border-white/80 bg-white/90 p-8 text-center shadow-xl backdrop-blur-sm">
        {/* @section: not-found-logo-lockup */}
        <div className="mx-auto mb-5 max-w-[260px] rounded-2xl bg-white/90 p-2 shadow-sm ring-1 ring-primary/10"><SchoolLogo className="max-h-11" /></div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
