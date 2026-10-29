import { toast } from "sonner";

/** One error toast for a failed auth-client call: its message, or ours. */
export function toastFailure(
  error: { message?: string } | null | undefined,
  fallback: string
) {
  toast.error(error?.message || fallback);
}
