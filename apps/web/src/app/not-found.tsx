import { getDirection } from "@/directions/registry";

export default async function NotFound() {
  const D = await getDirection();
  return <D.NotFound />;
}
