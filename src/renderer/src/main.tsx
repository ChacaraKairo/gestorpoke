import React from "react";
import ReactDOM from "react-dom/client";
import { AppV2 } from "./AppV2";
import { CompatibilityOverlay } from "./CompatibilityOverlay";
import { TeamRegulationOverlay } from "./TeamRegulationOverlay";
import { TypeAnalysisOverlay } from "./TypeAnalysisOverlay";
import { VisualEnhancer } from "./VisualEnhancer";
import "./styles.css";
import "./editor.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppV2 />
    <VisualEnhancer />
    <TypeAnalysisOverlay />
    <TeamRegulationOverlay />
    <CompatibilityOverlay />
  </React.StrictMode>,
);
