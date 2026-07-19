import React from "react";
import ReactDOM from "react-dom/client";
import { AppV2 } from "./AppV2";
import { BuildFormCompatibility } from "./BuildFormCompatibility";
import { CompatibilityOverlay } from "./CompatibilityOverlay";
import { CompetitiveWorkspaceOverlay } from "./CompetitiveWorkspaceOverlay";
import { ImageCacheEnhancer } from "./ImageCacheEnhancer";
import { OperationsOverlay } from "./OperationsOverlay";
import { PokemonManagerOverlay } from "./PokemonManagerOverlay";
import { TeamRegulationOverlay } from "./TeamRegulationOverlay";
import { TypeAnalysisOverlay } from "./TypeAnalysisOverlay";
import { VisualEnhancer } from "./VisualEnhancer";
import "./styles.css";
import "./editor.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppV2 />
    <VisualEnhancer />
    <ImageCacheEnhancer />
    <BuildFormCompatibility />
    <TypeAnalysisOverlay />
    <TeamRegulationOverlay />
    <CompatibilityOverlay />
    <OperationsOverlay />
    <PokemonManagerOverlay />
    <CompetitiveWorkspaceOverlay />
  </React.StrictMode>,
);
