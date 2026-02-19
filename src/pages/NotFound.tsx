import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { NotFoundContent } from "@/components/errors/not-found-content";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <NotFoundContent />
    </div>
  );
};

export default NotFound;
