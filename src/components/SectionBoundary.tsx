'use client';
import { Component, type ReactNode } from 'react';

/**
 * One section failing never takes the page with it: the rest of the page stays, and this section shows a short
 * note in its place. It tries again by itself once (most failures are a render racing a navigation or a refresh)
 * and offers a button after that.
 */
export class SectionBoundary extends Component<{ children: ReactNode; what?: string; minHeight?: number }, { failed: boolean; tries: number }> {
  state = { failed: false, tries: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`Section${this.props.what ? ` "${this.props.what}"` : ''} failed to render`, error);
    if (this.state.tries === 0) this.timer = setTimeout(() => this.retry(), 1500);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  retry = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setState((s) => ({ failed: false, tries: s.tries + 1 }));
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="status" className="inset-well flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-3 text-[13px] text-ink-2" style={{ minHeight: this.props.minHeight }}>
        <span>{this.state.tries === 0 ? 'Reloading this section…' : `${this.props.what ?? 'This section'} could not be shown just now.`}</span>
        {this.state.tries > 0 && (
          <button type="button" onClick={this.retry} className="inline-flex h-8 items-center rounded-full border border-[var(--hair)] px-4 text-[12.5px] font-semibold text-ink hover:border-[var(--mint)]">
            Try again
          </button>
        )}
      </div>
    );
  }
}
