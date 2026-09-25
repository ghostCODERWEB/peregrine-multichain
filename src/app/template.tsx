/** Re-mounts on every navigation, so each page fades in on the shared motion curve. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
