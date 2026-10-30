"use client";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

/** "Type the name to confirm": the button stays off until it matches. */
export function TypeToConfirm({
  expected,
  value,
  onChange,
  id,
}: {
  expected: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="block font-normal" htmlFor={id}>
        Type <span className="font-semibold">{expected}</span> to confirm
      </Label>
      <Input
        autoCapitalize="none"
        autoComplete="off"
        data-1p-ignore
        id={id}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}
