"use client";

import { cn } from "@workspace/tailwind-config/utils";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@workspace/ui/components/command";
import {
  Building2Icon,
  ClockIcon,
  CornerDownLeftIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  Loader2Icon,
  LogOutIcon,
  type LucideIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  SunMoonIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { useSignOut } from "@/components/app-shell/user-menu";
import {
  allowedFor,
  highlightParts,
  type PaletteGroup,
  type PaletteItem,
  type PaletteResult,
  type Range,
  searchItems,
  staticItems,
} from "@/lib/command-search";

const DEBOUNCE_MS = 180;
const RECENT_MAX = 5;
const GROUP_ORDER: (PaletteGroup | "Recent")[] = [
  "Recent",
  "Invoices",
  "Members",
  "Pages",
  "Organizations",
  "Actions",
];

const ICON: Record<string, LucideIcon> = {
  "page:overview": HouseIcon,
  "page:members": UsersIcon,
  "page:billing": CreditCardIcon,
  "page:invoices": FileTextIcon,
  "page:billing-details": SettingsIcon,
  "action:invite": UserPlusIcon,
  "action:update-card": CreditCardIcon,
  "action:change-plan": RepeatIcon,
  "action:toggle-theme": SunMoonIcon,
  "action:sign-out": LogOutIcon,
};
const GROUP_ICON: Record<PaletteGroup, LucideIcon> = {
  Pages: FileTextIcon,
  Actions: CornerDownLeftIcon,
  Organizations: Building2Icon,
  Members: UserIcon,
  Invoices: FileTextIcon,
};

type Group = { value: string; items: PaletteResult[] };

/* -------------------------------------------------------------- recents */

const recentKey = (orgId: string) => `tsp-palette-recent:${orgId}`;

function readRecent(orgId: string): PaletteItem[] {
  try {
    const raw = localStorage.getItem(recentKey(orgId));
    return raw ? (JSON.parse(raw) as PaletteItem[]) : [];
  } catch {
    return [];
  }
}

function remember(orgId: string, item: PaletteItem) {
  // Actions that change state (sign out, theme) aren't destinations.
  if (!item.href || item.action === "sign-out") {
    return;
  }
  const next = [item, ...readRecent(orgId).filter((r) => r.id !== item.id)];
  try {
    localStorage.setItem(
      recentKey(orgId),
      JSON.stringify(next.slice(0, RECENT_MAX))
    );
  } catch {
    // Private mode or full storage: recents are a convenience.
  }
}

/* --------------------------------------------------------------- search */

/** Server results for a query, debounced, with the latest request winning. */
function useRemoteResults(orgId: string, query: string, open: boolean) {
  const [state, setState] = useState<{
    query: string;
    results: PaletteResult[];
  }>({ query: "", results: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!(open && q)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        const body = res.ok
          ? ((await res.json()) as { results: PaletteResult[] })
          : { results: [] };
        setState({ query: q, results: body.results });
        setLoading(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setState({ query: q, results: [] });
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [orgId, query, open]);

  // Results for an older query are dropped, never shown under a new one.
  const fresh = state.query === query.trim() ? state.results : [];
  return { results: fresh, loading };
}

function grouped(results: PaletteResult[], recent: PaletteResult[]): Group[] {
  const by = new Map<string, PaletteResult[]>();
  if (recent.length) {
    by.set("Recent", recent);
  }
  for (const r of results) {
    by.set(r.item.group, [...(by.get(r.item.group) ?? []), r]);
  }
  return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({
    value: g,
    items: by.get(g) ?? [],
  }));
}

/* ---------------------------------------------------------------- parts */

function Highlight({ text, ranges }: { text: string; ranges: Range[] }) {
  return (
    <>
      {highlightParts(text, ranges).map((part, i) =>
        part.match ? (
          <mark
            className="bg-transparent font-semibold text-foreground"
            key={i}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

function useModKey() {
  const [mod, setMod] = useState<string | null>(null);
  useEffect(() => {
    setMod(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ");
  }, []);
  return mod;
}

/* -------------------------------------------------------------- palette */

/**
 * ⌘K / Ctrl+K search for the org in the URL: pages, organizations,
 * members, invoices and actions, limited to what the member's role can do.
 * Pages and actions are filtered here; people and invoices come from
 * /api/orgs/:orgId/search, which checks the role again on the server.
 * Enter opens the highlighted result; ⌘/Ctrl+Enter opens its alternate
 * (an invoice's PDF). Focus goes back to the trigger on close.
 */
export function CommandPalette({
  org,
  role,
}: {
  org: { id: string; slug: string };
  role: string;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const signOut = useSignOut();
  const mod = useModKey();
  const trigger = useRef<HTMLButtonElement>(null);
  const highlighted = useRef<PaletteResult | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<PaletteItem[]>([]);
  const remote = useRemoteResults(org.id, query, open);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey
      ) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(readRecent(org.id));
    } else {
      setQuery("");
    }
  }, [open, org.id]);

  const local = useMemo(
    () => allowedFor(staticItems(org.slug), role),
    [org.slug, role]
  );
  const groups = useMemo(() => {
    const q = query.trim();
    const allowedIds = new Set(local.map((i) => i.id));
    const recents = q
      ? []
      : recent
          // A recent page the role can no longer open is dropped.
          .filter((r) => !r.id.startsWith("page:") || allowedIds.has(r.id))
          .map((item) => ({
            item: { ...item, id: `recent:${item.id}` },
            score: 0,
            ranges: [],
          }));
    return grouped([...searchItems(local, q), ...remote.results], recents);
  }, [local, recent, query, remote.results]);
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  function run(result: PaletteResult, alternate = false) {
    const { item } = result;
    setOpen(false);
    remember(org.id, { ...item, id: item.id.replace(/^recent:/, "") });
    if (item.action === "toggle-theme") {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
      return;
    }
    if (item.action === "sign-out") {
      signOut();
      return;
    }
    const href = alternate && item.altHref ? item.altHref : item.href;
    if (!href) {
      return;
    }
    if (alternate && item.altHref) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className="pressable flex h-10 items-center gap-2 rounded-control border border-border bg-surface-1 px-3 text-muted-foreground text-sm transition-colors duration-(--dur-fast) hover:bg-surface-2 hover:text-foreground max-sm:size-11 max-sm:justify-center max-sm:px-0 sm:w-60"
        data-command-trigger
        onClick={() => setOpen(true)}
        ref={trigger}
        type="button"
      >
        <SearchIcon aria-hidden className="size-4 shrink-0" />
        <span className="max-sm:sr-only">Search…</span>
        <kbd
          aria-hidden
          className={cn(
            "ml-auto hidden h-5 min-w-9 items-center justify-center rounded-[5px] border border-border bg-background px-1.5 font-medium font-sans text-[11px] text-muted-foreground tabular-nums sm:inline-flex",
            mod ? "" : "invisible"
          )}
        >
          {mod ?? "⌘"}K
        </kbd>
      </button>
      <CommandDialog
        className="sm:top-[18vh] sm:max-w-xl max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:rounded-b-none! max-sm:pb-[env(safe-area-inset-bottom)] duration-(--dur-fast) data-ending-style:duration-[120ms] max-sm:transition-[opacity,translate] max-sm:duration-(--dur-sheet) max-sm:ease-drawer max-sm:data-ending-style:duration-(--dur-sheet-exit) max-sm:data-starting-style:translate-y-full max-sm:data-ending-style:translate-y-full max-sm:data-starting-style:opacity-100 max-sm:data-ending-style:opacity-100"
        description="Search pages, people, invoices and actions in this organization."
        finalFocus={trigger}
        onOpenChange={setOpen}
        open={open}
        title="Search"
      >
        <Command
          filter={null}
          items={groups}
          itemToStringValue={(r) => (r as PaletteResult).item.title}
          onItemHighlighted={(r) => {
            highlighted.current = (r as PaletteResult | undefined) ?? null;
          }}
          onValueChange={setQuery}
          value={query}
        >
          <div className="relative">
            <CommandInput
              aria-describedby="palette-keys"
              className="text-base sm:text-sm"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  highlighted.current
                ) {
                  event.preventDefault();
                  event.preventBaseUIHandler();
                  run(highlighted.current, true);
                }
              }}
              placeholder="Search pages, people, invoices…"
            />
            {remote.loading ? (
              <Loader2Icon
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-[calc(50%-2px)] animate-spin text-muted-foreground motion-reduce:animate-none"
              />
            ) : null}
          </div>
          <p className="sr-only" id="palette-keys">
            Arrow keys to move, Enter to open, Command or Control plus Enter to
            open an invoice's PDF, Escape to close.
          </p>
          <div
            aria-live="polite"
            className="sr-only"
            data-palette-count
            role="status"
          >
            {remote.loading
              ? "Searching…"
              : `${count} ${count === 1 ? "result" : "results"}`}
          </div>
          <CommandEmpty>
            {remote.loading
              ? "Searching…"
              : `Nothing matches “${query.trim()}”.`}
          </CommandEmpty>
          <CommandList className="max-h-[min(26rem,55dvh)]">
            {(group: Group) => (
              <CommandGroup
                heading={group.value}
                items={group.items}
                key={group.value}
              >
                {group.items.map((result) => (
                  <PaletteRow
                    key={result.item.id}
                    onSelect={() => run(result)}
                    recent={group.value === "Recent"}
                    result={result}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center justify-between gap-3 border-border border-t px-3 py-2 text-muted-foreground text-xs max-sm:hidden">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move <Kbd>↵</Kbd> to open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>{mod ?? "⌘"}↵</Kbd> PDF <Kbd>esc</Kbd> to close
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-background px-1 font-sans text-[11px]">
      {children}
    </kbd>
  );
}

function PaletteRow({
  result,
  recent,
  onSelect,
}: {
  result: PaletteResult;
  recent: boolean;
  onSelect: () => void;
}) {
  const { item, ranges } = result;
  const baseId = item.id.replace(/^recent:/, "");
  const Icon = recent
    ? ClockIcon
    : (ICON[baseId] ?? GROUP_ICON[item.group] ?? FileTextIcon);
  return (
    <CommandItem
      className="pressable-lg min-h-11 gap-3 px-2.5 py-2"
      onSelect={onSelect}
      value={result}
    >
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <span className="grid min-w-0 flex-1">
        <span className="truncate">
          <Highlight ranges={ranges} text={item.title} />
        </span>
        {item.subtitle ? (
          <span className="truncate text-muted-foreground text-xs tabular-nums">
            {item.subtitle}
          </span>
        ) : null}
      </span>
      {item.altHref ? <CommandShortcut>PDF</CommandShortcut> : null}
    </CommandItem>
  );
}
