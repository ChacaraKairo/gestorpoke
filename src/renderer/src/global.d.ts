import type { AppApi } from "../../shared/contracts";

declare global {
  interface Window {
    gestorPoke: AppApi;
  }
}

export {};
