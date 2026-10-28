import { getDirection } from "@/directions/registry";

export default async function HomePage() {
  const D = await getDirection();
  return <D.Landing />;
}
