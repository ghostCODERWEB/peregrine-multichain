// Recomputes every stored CPI snapshot from its stored raw inputs with the
// current model. Zero Nansen calls. Run after changing anything in
// src/lib/models/cpi.ts.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { rescoreAll } from '../src/server/weather/scanner';

const { snapshots, blended } = rescoreAll();
console.log(`Rescored ${snapshots} window snapshots and rebuilt ${blended} blended CPI rows.`);
