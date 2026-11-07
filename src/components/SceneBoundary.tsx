/**
 * Failure handling — master prompt, FAILURE HANDLING.
 *
 * If WebGL is unavailable or the 3D scene throws, the captain still gets a
 * usable navigation readout instead of a blank screen. This is what lets the
 * 3D work be attempted aggressively without risking the whole interface.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode | ((retry: () => void) => ReactNode);
}

interface State {
  failed: boolean;
}

export class SceneBoundary extends Component<Props, State> {
  state: State = { failed: false };

  retry = () => this.setState({ failed: false });

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3D scene failed, showing fallback:", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return typeof this.props.fallback === "function"
      ? this.props.fallback(this.retry)
      : this.props.fallback;
  }
}
