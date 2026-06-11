"use client";

import { Component, type ReactNode } from "react";

/**
 * Tiny error boundary for the WebGL scenes. If a canvas fails to initialize
 * (no WebGL, driver crash, etc.) the boundary swallows the error and renders
 * nothing — so the hero's text and CTAs always stay visible underneath.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("Scene failed to render:", error);
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
