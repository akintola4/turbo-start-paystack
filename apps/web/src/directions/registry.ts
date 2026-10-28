import "server-only";

import { cookies } from "next/headers";

import a from "./a";
import b from "./b";
import c from "./c";
import type { Direction, DirectionId } from "./types";

/** Throwaway: design exploration. Delete with the other two after the pick. */
export const DIRECTION_COOKIE = "tsp-direction";
export const DIRECTIONS: Record<DirectionId, Direction> = { a, b, c };

export const isDirectionId = (value: unknown): value is DirectionId =>
  value === "a" || value === "b" || value === "c";

export async function getDirectionId(): Promise<DirectionId> {
  const value = (await cookies()).get(DIRECTION_COOKIE)?.value;
  return isDirectionId(value) ? value : "a";
}

export async function getDirection(): Promise<Direction> {
  return DIRECTIONS[await getDirectionId()];
}
