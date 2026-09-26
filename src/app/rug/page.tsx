import { redirect } from 'next/navigation';

/** The checker moved to /token (Token Checker). */
export default function RugPage() {
  redirect('/token');
}
