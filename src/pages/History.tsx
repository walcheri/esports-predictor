import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function History() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to profile history tab
    navigate("/profile?tab=history", { replace: true });
  }, [navigate]);

  return null;
}
