import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function hasAuthParams(search: string, hash: string) {
  const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (qs.get("code")) return true;
  if (qs.get("token_hash") && qs.get("type")) return true;
  if (qs.get("error") || qs.get("error_description")) return true;
  const hs = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  if (hs.get("access_token") && hs.get("refresh_token")) return true;
  if (hs.get("error") || hs.get("error_description")) return true;
  return false;
}

export default function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (location.pathname === "/auth/callback") return;
    if (!hasAuthParams(location.search, location.hash)) return;
    navigate(`/auth/callback${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

