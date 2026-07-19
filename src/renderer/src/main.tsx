import React from "react";
import ReactDOM from "react-dom/client";
import { AppV2 } from "./AppV2";
import { CompatibilityOverlay } from "./CompatibilityOverlay";
import { CompetitiveWorkspaceOverlay } from "./CompetitiveWorkspaceOverlay";
import { ImageCacheEnhancer } from "./ImageCacheEnhancer";
import { ImportResolutionOverlay } from "./ImportResolutionOverlay";
import { OperationsOverlay } from "./OperationsOverlay";
import { PokemonManagerOverlay } from "./PokemonManagerOverlay";
import { TeamRegulationOverlay } from "./TeamRegulationOverlay";
import { TypeAnalysisOverlay } from "./TypeAnalysisOverlay";
import { VisualEnhancer } from "./VisualEnhancer";
import "./styles.css";
import "./editor.css";
import "./floating-actions.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppV2 sideActions={<>
      <TypeAnalysisOverlay />
      <TeamRegulationOverlay />
      <CompatibilityOverlay />
      <OperationsOverlay />
      <PokemonManagerOverlay />
      <CompetitiveWorkspaceOverlay />
      <ImportResolutionOverlay />
    </>} />
    <VisualEnhancer />
    <ImageCacheEnhancer />
  </React.StrictMode>,
);
