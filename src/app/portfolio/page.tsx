import type { Metadata } from 'next';
import { PortfolioView } from '@/components/portfolio/PortfolioView';
export const metadata: Metadata = { title: 'Portfolio observatory — Peregrine' };
export const dynamic = 'force-dynamic';
export default function PortfolioPage() { return <PortfolioView demo={process.env.DEMO_MODE === '1'} />; }
