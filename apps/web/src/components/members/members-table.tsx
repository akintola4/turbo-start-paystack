"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@workspace/tailwind-config/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { MarkAvatar } from "@/components/mark-avatar";
import { MemberRowMenu, RoleSelect } from "@/components/members/member-actions";
import { PresenceTableRow } from "@/components/motion";
import { formatDate, roleLabel } from "@/lib/format";
import type { MemberRow, Role } from "@/lib/view-models";

export type MembersTableProps = {
  organizationId: string;
  orgName: string;
  members: MemberRow[];
  roles: Role[];
};

/** Search and the role filter earn their place past this many people. */
const TOOLBAR_FROM = 8;

function SortHeader({
  label,
  dir,
  onClick,
}: {
  label: string;
  dir: false | "asc" | "desc";
  onClick: () => void;
}) {
  const Icon =
    dir === "asc"
      ? ArrowUpIcon
      : dir === "desc"
        ? ArrowDownIcon
        : ArrowUpDownIcon;
  return (
    <Button
      className="-ml-2 h-7 gap-1 px-2 font-medium text-inherit text-xs before:-inset-y-2 hover:text-foreground"
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      {label}
      <Icon aria-hidden className={cn("size-3.5", !dir && "opacity-40")} />
    </Button>
  );
}

export function MembersTable({
  organizationId,
  orgName,
  members,
  roles,
}: MembersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const data = useMemo(
    () =>
      roleFilter === "all"
        ? members
        : members.filter((m) => m.role === roleFilter),
    [members, roleFilter]
  );

  const columns = useMemo<ColumnDef<MemberRow>[]>(
    () => [
      {
        id: "member",
        accessorFn: (m) => `${m.name} ${m.email}`,
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        header: ({ column }) => (
          <SortHeader
            dir={column.getIsSorted()}
            label="Member"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <MarkAvatar seed={m.email} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  <span className="truncate">{m.name}</span>
                  {m.isMe ? (
                    <Badge
                      className="px-1.5 py-0 font-normal text-[11px]"
                      variant="outline"
                    >
                      You
                    </Badge>
                  ) : null}
                </div>
                <div className="truncate text-muted-foreground text-xs">
                  {m.email}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: () => <span>Role</span>,
        cell: ({ row }) => {
          const m = row.original;
          if (m.canUpdate) {
            return (
              <RoleSelect
                className="w-28 sm:w-32"
                member={m}
                organizationId={organizationId}
                roles={roles}
              />
            );
          }
          return <span className="text-sm">{roleLabel(m.role)}</span>;
        },
      },
      {
        id: "joined",
        accessorKey: "joinedAt",
        header: ({ column }) => (
          <SortHeader
            dir={column.getIsSorted()}
            label="Joined"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDate(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <MemberRowMenu
              member={row.original}
              organizationId={organizationId}
              orgName={orgName}
            />
          </div>
        ),
      },
    ],
    [organizationId, orgName, roles]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const presentRoles = [...new Set(members.map((m) => m.role))];

  return (
    <div className="grid gap-3">
      {members.length < TOOLBAR_FROM ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <SearchIcon
              aria-hidden
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Search members"
              className="pl-8"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              type="search"
              value={query}
            />
          </div>
          <Select
            items={[
              { value: "all", label: "All roles" },
              ...presentRoles.map((r) => ({ value: r, label: roleLabel(r) })),
            ]}
            onValueChange={(v) => setRoleFilter(v ?? "all")}
            value={roleFilter}
          >
            <SelectTrigger aria-label="Filter by role" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {presentRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow className="hover:bg-transparent" key={group.id}>
                {group.headers.map((header) => (
                  <TableHead
                    className={cn(
                      "h-9 text-muted-foreground text-xs",
                      header.column.id === "actions" && "w-12",
                      header.column.id === "role" && "w-32 sm:w-40",
                      header.column.id === "joined" &&
                        "hidden w-36 lg:table-cell"
                    )}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <PresenceTableRow
                  anchor={`member-${row.original.id}`}
                  className="scroll-mt-24 target:bg-surface-2"
                  id={row.original.id}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={cn(
                        "h-14 py-2.5",
                        cell.column.id === "member" && "max-w-0 w-full",
                        cell.column.id === "joined" && "hidden lg:table-cell"
                      )}
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </PresenceTableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-28 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {query
                    ? `No members match “${query}”.`
                    : `No one has the ${roleLabel(roleFilter)} role.`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
