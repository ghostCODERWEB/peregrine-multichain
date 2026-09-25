// Withheld-data reasons are written for an instance with accounts ("the key
// owner or a signed-in member with their own key"). A public site has no
// sign-in, so offering one would send visitors looking for a button that
// isn't there: drop the member clause, keep the reason.
const RULES: Array<[RegExp, string]> = [
  [/ or (?:a )?(?:signed-in )?member with their own (?:Nansen )?key(?: only)?/g, ' only'],
  [/,? or by you once you sign in with your own Nansen key/g, ''],
  [/ or a member’s own Nansen key/g, ''],
  [/Labels are available only with your own Nansen key\./g, 'Labels are withheld from public views.'],
  [/\s*(?:Sign in with your own Nansen key to keep calling|Use a Peregrine instance with your own Nansen key)\./g, ''],
];

export function publicReason(text: string): string {
  return RULES.reduce((t, [re, to]) => t.replace(re, to), text);
}
