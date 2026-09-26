'use client';
import { useEffect } from 'react';
import { registerPageContext } from '@/components/analyze/store';

/** Hands a view's underlying data to Analyze with Nansen (the floating dock), so questions about the page use its real numbers. Renders nothing. */
export function ExplainView({ view, context }: { view: string; context: unknown; coins?: string[] }) {
  useEffect(() => registerPageContext(view, context), [view, context]);
  return null;
}
