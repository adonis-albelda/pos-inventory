/**
 * A template, not a layout: this remounts on every navigation, which is what
 * restarts the enter animation. The sidebar stays in `layout.tsx` so it never
 * animates or loses scroll position when a page changes.
 *
 * The animation runs after the server work for the route is done, so the pending
 * state a navigation needs is carried by the nav itself, not by this.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 motion-safe:animate-page-enter">{children}</div>
  );
}
