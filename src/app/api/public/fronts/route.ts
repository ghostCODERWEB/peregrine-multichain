// GET /api/public/fronts — withheld. Rotation fronts are built from
// smart-money DEX trades, which Nansen's redistribution rules prohibit in
// any public surface or API. They stay in TIDE's private (key-owner) view.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { error: 'Rotation fronts are derived from Nansen smart-money DEX trades, which may not be redistributed publicly. They are available in a private Peregrine instance run with your own Nansen key.' },
    { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
