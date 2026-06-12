import { createFileRoute, Outlet } from "@tanstack/react-router";

// Thin layout for /staff/jobs/$slug. The job-ad detail page lives in
// `$slug.index.tsx`; the child routes (questions, stages, add-candidate) render
// through this <Outlet/>. Without it, those children matched the URL but had no
// render slot, so the detail page stayed on screen and they appeared not to load.
//
// Intentionally loader-less: the index page and each child load their own ad and
// handle notFound, and keeping the layout free of a loader means only the index
// route enters the pending state on ad→ad navigation (one clean spinner
// boundary, no stale-title flash).
export const Route = createFileRoute("/_authenticated/staff/jobs/$slug")({
  component: () => <Outlet />,
});
