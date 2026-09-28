// Shared test setup: every test is its own returning visitor.
//  - Returning: a first visit opens the guided tour (src/components/GuidedTour.tsx, key pg-tour-v1), whose card
//    covers the lower part of a phone screen and would sit over whatever a test taps. A test of the tour itself
//    can clear the key before loading a page.
//  - Its own: per-visitor rate limits (src/server/rate.ts) key on the client address. With no proxy in front of
//    the local server, a distinct X-Forwarded-For per test keeps one test's loads from spending another's budget.
import { test as base, expect, type Page } from '@playwright/test';

export { expect, type Page };

let visitors = 0;
const visitorAddress = () => `198.51.100.${(process.pid + ++visitors) % 250 + 1}`;

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': visitorAddress() });
    await page.addInitScript(() => {
      try { if (localStorage.getItem('pg-tour-v1') === null) localStorage.setItem('pg-tour-v1', 'done'); } catch { /* storage blocked */ }
    });
    await provide(page);
  },
});
