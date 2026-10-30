/*
 * SplineBoundary — a minimal React error boundary for a lazy/WebGL Spline mount.
 *
 * `@splinetool/react-spline` THROWS (via a rejected Suspense promise) when a scene
 * fails to load — a blocked/slow CDN, an aborted fetch, or WebGL being unavailable.
 * Without a boundary, that throw propagates to the React root and unmounts the whole
 * app (white screen), taking the poster/hero/demo down with it. This catches it and
 * renders `fallback` (default: nothing) so everything around the Spline survives —
 * the static poster stays, the page and the interactive demo keep working.
 *
 * Place it OUTSIDE the <Suspense> so it also catches a failed lazy runtime import.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered in place of the children after a caught error. Defaults to null. */
  fallback?: ReactNode;
  /** Optional hook (e.g. to flip local state) when an error is caught. */
  onError?: () => void;
}

interface State {
  failed: boolean;
}

export default class SplineBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
