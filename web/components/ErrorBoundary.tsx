"use client";

import { Component, type ReactNode } from "react";
import { Alert, Button } from "@mantine/core";

type Props = { children: ReactNode };
type State = { message: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(err: Error): State {
    return { message: err.message || String(err) };
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <Alert color="red" title="Something broke in the page" m="md">
        {this.state.message}
        <Button size="xs" mt="sm" onClick={() => this.setState({ message: null })}>
          Try again
        </Button>
      </Alert>
    );
  }
}
