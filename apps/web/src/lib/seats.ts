export type SeatUsage = {
  /** Members plus pending invitations: an invite holds its seat. */
  used: number;
  max: number;
  full: boolean;
  /** 0–100, for the progress bar. */
  pct: number;
};

export function seatUsage(
  members: number,
  pendingInvitations: number,
  max: number
): SeatUsage {
  const used = members + pendingInvitations;
  return {
    used,
    max,
    full: used >= max,
    pct: max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 100,
  };
}
