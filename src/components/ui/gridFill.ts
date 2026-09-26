// Classes that stretch the last cell of a grid so no row ends in a gap, for
// grids with 2 columns from sm, 3 from xl and 4 from 3xl.
const SPAN: Record<string, Record<number, string>> = {
  sm: { 1: 'sm:col-span-1', 2: 'sm:col-span-2' },
  xl: { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3' },
  '3xl': { 1: '3xl:col-span-1', 2: '3xl:col-span-2', 3: '3xl:col-span-3', 4: '3xl:col-span-4' },
};

export function lastFill(i: number, n: number, cols: Array<[keyof typeof SPAN, number]> = [['sm', 2], ['xl', 3], ['3xl', 4]]): string {
  if (i !== n - 1) return '';
  return cols.map(([bp, c]) => SPAN[bp][c - ((n - 1) % c)]).join(' ');
}
