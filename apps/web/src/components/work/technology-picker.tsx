"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { TECH_TAG_ROLES, type TechTagRole } from "@jobhunter/shared-types/values";
import type { TaxonomyNode } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export interface TechnologyTag {
  technologyId: string;
  role: TechTagRole;
}

/** The DTO caps the array at 24 (`work/dto.ts`); stop the user at the same number. */
const MAX_TAGS = 24;

export function TechnologyPicker({
  nodes,
  value,
  onChange,
  disabled,
}: {
  nodes: TaxonomyNode[];
  value: TechnologyTag[];
  onChange: (next: TechnologyTag[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selectedIds = useMemo(() => new Set(value.map((t) => t.technologyId)), [value]);

  // Aliases are searchable too: the seed records "Postgres" and "psql" against
  // the PostgreSQL node, and typing what you actually call it should find it.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = nodes.filter((n) => !selectedIds.has(n.id));
    if (!q) return pool.slice(0, 8);
    return pool
      .filter(
        (n) =>
          n.canonicalName.toLowerCase().includes(q) ||
          n.aliases.some((a) => a.alias.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [nodes, query, selectedIds]);

  const full = value.length >= MAX_TAGS;

  function add(node: TaxonomyNode) {
    if (full || selectedIds.has(node.id)) return;
    onChange([...value, { technologyId: node.id, role: "primary" }]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(value.filter((t) => t.technologyId !== id));
  }

  function setRole(id: string, role: TechTagRole) {
    onChange(value.map((t) => (t.technologyId === id ? { ...t, role } : t)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Never let this submit the surrounding form -- Enter here means
      // "add the highlighted technology", which is almost always what a
      // half-typed query in this box is for.
      e.preventDefault();
      const node = matches[highlight];
      if (node) add(node);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1]!.technologyId);
    }
  }

  return (
    <div>
      <div className="relative">
        <Input
          ref={inputRef}
          id="technologies"
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="technology-options"
          placeholder={full ? `Maximum ${MAX_TAGS} technologies` : "Search technologies…"}
          disabled={disabled ?? full}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Blur closes on a delay so a click on an option still lands.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />

        {open && matches.length > 0 && (
          <ul
            id="technology-options"
            role="listbox"
            className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
          >
            {matches.map((node, i) => (
              <li key={node.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => add(node)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                    i === highlight
                      ? "bg-surface-muted text-foreground"
                      : "text-foreground",
                  )}
                >
                  <span className="truncate">{node.canonicalName}</span>
                  {node.reviewStatus === "proposed" && (
                    <Badge tone="warning">proposed</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {open && query.trim() !== "" && matches.length === 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground shadow-lg">
            No technology matches “{query.trim()}”. New taxonomy nodes come from the
            ingest tool, not this form.
          </div>
        )}
      </div>

      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => {
            const node = byId.get(tag.technologyId);
            return (
              <li
                key={tag.technologyId}
                className="flex items-center gap-1 rounded-md border border-border bg-surface-muted py-0.5 pr-0.5 pl-2 text-xs"
              >
                <span className="font-medium">
                  {node?.canonicalName ?? tag.technologyId}
                </span>
                <select
                  aria-label={`Role for ${node?.canonicalName ?? "technology"}`}
                  value={tag.role}
                  disabled={disabled}
                  onChange={(e) =>
                    setRole(tag.technologyId, e.target.value as TechTagRole)
                  }
                  className="rounded bg-transparent py-0.5 text-xs text-muted-foreground focus:outline-none"
                >
                  {TECH_TAG_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove ${node?.canonicalName ?? "technology"}`}
                  disabled={disabled}
                  onClick={() => remove(tag.technologyId)}
                  className="rounded p-1 text-subtle-foreground hover:bg-surface hover:text-danger"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {value.length === 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-subtle-foreground">
          <Plus className="size-3" />
          Untagged entries still count as work, but contribute to no technology score.
        </p>
      )}
    </div>
  );
}
