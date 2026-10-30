import { type Database, schema } from "@workspace/db";
import { and, count, eq, gt } from "drizzle-orm";

import { type SeatUsage, seatUsage } from "@/lib/seats";

/**
 * Seats in use for an organization: members plus unexpired pending
 * invitations, since an invitation holds its seat. Overview, Billing and
 * Members all count this way, so they show the same number.
 */
export async function orgSeats(
  db: Database,
  organizationId: string,
  max: number,
  now = new Date()
): Promise<SeatUsage & { pending: number }> {
  const [[members], [pending]] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.member)
      .where(eq(schema.member.organizationId, organizationId)),
    db
      .select({ n: count() })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.organizationId, organizationId),
          eq(schema.invitation.status, "pending"),
          gt(schema.invitation.expiresAt, now)
        )
      ),
  ]);
  const p = pending?.n ?? 0;
  return { ...seatUsage(members?.n ?? 0, p, max), pending: p };
}
