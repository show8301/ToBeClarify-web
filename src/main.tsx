import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LucidApp from "./lucid-app";
import "./lucid.css";
import "./admin/admin.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LucidApp />
  </StrictMode>,
);
