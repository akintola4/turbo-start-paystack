import type { Metadata } from "next";
import { connection } from "next/server";

import { NotFoundPage } from "@/components/not-found/not-found-page";

export const metadata: Metadata = {
  title: "Page not found",
  description: "There is no page at this address.",
  robots: { index: false },
};

/**
 * Every unknown URL, and every `notFound()` outside an organization's pages,
 * lands here with a 404. Rendered per request, so the server HTML already
 * has the requested path and the puzzle's path-seeded shuffle.
 */
export default async function NotFound() {
  await connection();
  return <NotFoundPage />;
}
