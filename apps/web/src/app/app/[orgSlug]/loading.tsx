import { getDirection } from "@/directions/registry";

export default async function Loading() {
  const D = await getDirection();
  return <D.PageLoading />;
}
