"use client";

import { NativeSelect } from "@workspace/ui/components/native-select";
import { useRouter } from "next/navigation";

export function OrgSwitcher({
  current,
  orgs,
}: {
  current: string;
  orgs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="Switch organization"
      className="w-48"
      onChange={(event) => {
        const value = event.target.value;
        router.push(value === "__all" ? "/app" : `/app/${value}`);
      }}
      value={current}
    >
      {orgs.map((org) => (
        <option key={org.slug} value={org.slug}>
          {org.name}
        </option>
      ))}
      <option value="__all">All organizations…</option>
    </NativeSelect>
  );
}
