'use client';
import { Search } from 'lucide-react';

/** A full-width search field (iOS style) that opens the command palette. */
export function SearchPill({ placeholder = 'Tokens, wallets, ENS names' }: { placeholder?: string }) {
  return (
    <button type="button" className="m-search" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
      <Search size={17} aria-hidden /><span>{placeholder}</span>
    </button>
  );
}
