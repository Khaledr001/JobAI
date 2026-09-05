"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, Plus } from "lucide-react";
import {
  EVIDENCE_KINDS,
  WORK_ENTRY_TYPES,
  type EvidenceKind,
  type WorkEntryType,
} from "@jobhunter/shared-types/values";
import {
  ApiError,
  createWorkEntry,
  getProjects,
  getTaxonomyNodes,
  type CreateWorkEntryInput,
} from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CharCount, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/feedback";
import {
  TechnologyPicker,
  type TechnologyTag,
} from "@/components/work/technology-picker";

// Mirrors apps/api's CreateWorkEntrySchema. Client-side validation is UX --
// the server's Zod schema is still the authority and its errors surface too.
const MAX_TITLE = 200;
const MAX_BODY = 4000;
const MAX_OUTCOME = 1000;

interface FormState {
  title: string;
  body: string;
  outcome: string;
  type: WorkEntryType | "";
  occurredOn: string;
  occurredThrough: string;
  projectId: string;
  epochId: string;
  sourceKind: EvidenceKind | "";
  sourceRef: string;
  technologies: TechnologyTag[];
}

const EMPTY: FormState = {
  title: "",
  body: "",
  outcome: "",
  type: "",
  occurredOn: "",
  occurredThrough: "",
  projectId: "",
  epochId: "",
  sourceKind: "",
  sourceRef: "",
  technologies: [],
};

function todayLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function AddWorkForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY, occurredOn: todayLocal() });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const nodesQuery = useQuery({
    queryKey: ["taxonomy-nodes"],
    queryFn: getTaxonomyNodes,
  });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: getProjects });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const { [key as string]: _removed, ...rest } = e;
      return rest;
    });
    setSaved(null);
  };

  const epochs = useMemo(
    () => projectsQuery.data?.find((p) => p.id === form.projectId)?.epochs ?? [],
    [projectsQuery.data, form.projectId],
  );

  // Verified against packages/shared-utils' own projection spec: no source
  // evidence means `attested` regardless of entry type, and a `learning`
  // entry caps at `attested` even with evidence. Only `documented` and above
  // are emittable (`v_emittable_claims`), so this is the difference between
  // an entry that can reach a resume and one that never will.
  const hasEvidence = form.sourceKind !== "" && form.sourceRef.trim() !== "";
  const ceiling: "attested" | "documented" =
    hasEvidence && form.type !== "learning" ? "documented" : "attested";

  const mutation = useMutation({
    mutationFn: createWorkEntry,
    onSuccess: async (entry) => {
      setSaved(entry.title);
      setForm({ ...EMPTY, occurredOn: todayLocal() });
      setErrors({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["work-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["technology-scores"] }),
      ]);
    },
  });

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (form.title.trim() === "") next.title = "Required.";
    else if (form.title.length > MAX_TITLE) next.title = `Over ${MAX_TITLE} characters.`;

    if (form.body.trim() === "") next.body = "Required.";
    else if (form.body.length > MAX_BODY) next.body = `Over ${MAX_BODY} characters.`;

    if (form.outcome.length > MAX_OUTCOME) {
      next.outcome = `Over ${MAX_OUTCOME} characters.`;
    }
    if (form.type === "") next.type = "Required.";
    if (form.occurredOn === "") next.occurredOn = "Required.";

    if (form.occurredThrough !== "" && form.occurredThrough < form.occurredOn) {
      next.occurredThrough = "Cannot be before the start date.";
    }

    // The pairing the DTO documents: one without the other is silently
    // useless, so refuse it here rather than storing a half-set entry.
    if (form.sourceKind !== "" && form.sourceRef.trim() === "") {
      next.sourceRef = "Required when a source kind is set.";
    }
    if (form.sourceKind === "" && form.sourceRef.trim() !== "") {
      next.sourceKind = "Required when a source reference is set.";
    }
    return next;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Conditional spreads, not `undefined` values: `exactOptionalPropertyTypes`
    // is on, and the API's Zod schema distinguishes absent from present-undefined.
    const payload: CreateWorkEntryInput = {
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type as WorkEntryType,
      occurredOn: form.occurredOn,
      technologies: form.technologies,
      ...(form.outcome.trim() !== "" ? { outcome: form.outcome.trim() } : {}),
      ...(form.occurredThrough !== "" ? { occurredThrough: form.occurredThrough } : {}),
      ...(form.projectId !== "" ? { projectId: form.projectId } : {}),
      ...(form.epochId !== "" ? { epochId: form.epochId } : {}),
      ...(form.sourceKind !== "" ? { sourceKind: form.sourceKind } : {}),
      ...(form.sourceRef.trim() !== "" ? { sourceRef: form.sourceRef.trim() } : {}),
    };
    mutation.mutate(payload);
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        {saved ? (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="size-3.5" />
            Saved “{saved}”.
          </p>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          icon={<Plus className="size-4" />}
          onClick={() => setOpen(true)}
        >
          Add work
        </Button>
      </div>
    );
  }

  const duplicateId =
    mutation.error instanceof ApiError && mutation.error.code === "CONFLICT"
      ? (mutation.error.details?.workEntryId as string | undefined)
      : undefined;

  return (
    <Card>
      <CardHeader
        title="Add work"
        description="An append-only ledger entry. Everything on this page is recomputed from these."
        action={
          <Button
            size="sm"
            onClick={() => {
              setOpen(false);
              mutation.reset();
            }}
          >
            Cancel
          </Button>
        }
      />

      <form onSubmit={onSubmit} className="space-y-5 p-5">
        <Field
          label="Title"
          htmlFor="title"
          required
          error={errors.title}
          hint={<CharCount value={form.title} max={MAX_TITLE} />}
        >
          <Input
            id="title"
            value={form.title}
            invalid={Boolean(errors.title)}
            maxLength={MAX_TITLE + 50}
            placeholder="Cut order-service p95 by eliminating N+1 on line items"
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" htmlFor="type" required error={errors.type}>
            <Select
              id="type"
              value={form.type}
              invalid={Boolean(errors.type)}
              onChange={(e) => set("type", e.target.value as WorkEntryType)}
            >
              <option value="">Select…</option>
              {WORK_ENTRY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Occurred on"
            htmlFor="occurredOn"
            required
            error={errors.occurredOn}
          >
            <Input
              id="occurredOn"
              type="date"
              value={form.occurredOn}
              invalid={Boolean(errors.occurredOn)}
              onChange={(e) => set("occurredOn", e.target.value)}
            />
          </Field>

          <Field
            label="Through"
            htmlFor="occurredThrough"
            error={errors.occurredThrough}
            hint="Ranged entries only"
          >
            <Input
              id="occurredThrough"
              type="date"
              value={form.occurredThrough}
              min={form.occurredOn || undefined}
              invalid={Boolean(errors.occurredThrough)}
              onChange={(e) => set("occurredThrough", e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="What you did"
          htmlFor="body"
          required
          error={errors.body}
          hint={<CharCount value={form.body} max={MAX_BODY} />}
        >
          <Textarea
            id="body"
            rows={5}
            value={form.body}
            invalid={Boolean(errors.body)}
            placeholder="The work itself, in enough detail that a claim could later be extracted from it."
            onChange={(e) => set("body", e.target.value)}
          />
        </Field>

        <Field
          label="Outcome"
          htmlFor="outcome"
          error={errors.outcome}
          hint={
            <span className="flex items-center justify-between gap-2">
              <span>
                A number here is only emittable if an artifact proves its magnitude.
              </span>
              <CharCount value={form.outcome} max={MAX_OUTCOME} />
            </span>
          }
        >
          <Textarea
            id="outcome"
            rows={2}
            value={form.outcome}
            invalid={Boolean(errors.outcome)}
            placeholder="p95 on /orders fell from 420ms to 260ms under the same load profile."
            onChange={(e) => set("outcome", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" htmlFor="projectId">
            <Select
              id="projectId"
              value={form.projectId}
              onChange={(e) => {
                set("projectId", e.target.value);
                set("epochId", ""); // an epoch belongs to exactly one project
              }}
            >
              <option value="">None</option>
              {projectsQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          {epochs.length > 0 && (
            <Field
              label="Epoch"
              htmlFor="epochId"
              hint="Scopes this entry to one era of the project's stack."
            >
              <Select
                id="epochId"
                value={form.epochId}
                onChange={(e) => set("epochId", e.target.value)}
              >
                <option value="">None</option>
                {epochs.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {/* Source evidence -- the field pair that decides whether anything
            tagged here can ever reach a resume. Grouped and explained
            because half-filling it fails silently at projection time. */}
        <div className="rounded-lg border border-border bg-surface-muted/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">Source evidence</h3>
            <Badge tone={ceiling === "documented" ? "success" : "warning"}>
              caps at {ceiling}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <Field label="Kind" htmlFor="sourceKind" error={errors.sourceKind}>
              <Select
                id="sourceKind"
                value={form.sourceKind}
                invalid={Boolean(errors.sourceKind)}
                onChange={(e) => set("sourceKind", e.target.value as EvidenceKind)}
              >
                <option value="">None</option>
                {EVIDENCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Reference" htmlFor="sourceRef" error={errors.sourceRef}>
              <Input
                id="sourceRef"
                value={form.sourceRef}
                invalid={Boolean(errors.sourceRef)}
                placeholder="commit sha, file path, doc section, or URL"
                onChange={(e) => set("sourceRef", e.target.value)}
              />
            </Field>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {ceiling === "documented" ? (
              <span>
                Technologies tagged below can reach <strong>documented</strong> — the
                minimum this system will emit.
              </span>
            ) : form.type === "learning" ? (
              <span>
                <strong>learning</strong> entries cap at <strong>attested</strong> even
                with evidence, and attested is never emitted. Deliberate: a tutorial must
                not promote a technology to a resume claim.
              </span>
            ) : (
              <span>
                Without both fields, technologies tagged below stay{" "}
                <strong>attested</strong> and can never be emitted. Set them together, or
                leave both empty knowingly.
              </span>
            )}
          </p>
        </div>

        <Field
          label="Technologies"
          htmlFor="technologies"
          hint="Search by canonical name or alias. Roles weight the projection."
        >
          {nodesQuery.error ? (
            <ErrorState error={nodesQuery.error} />
          ) : (
            <TechnologyPicker
              nodes={nodesQuery.data ?? []}
              value={form.technologies}
              disabled={nodesQuery.isLoading}
              onChange={(next) => set("technologies", next)}
            />
          )}
        </Field>

        {mutation.error && (
          <div className="space-y-2">
            <ErrorState error={mutation.error} />
            {duplicateId && (
              <p className="text-xs text-muted-foreground">
                An entry with identical body text already exists (
                <code className="font-mono">{duplicateId.slice(0, 8)}</code>). The ledger
                dedupes on a whitespace-insensitive hash of the body.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY, occurredOn: todayLocal() });
              setErrors({});
              mutation.reset();
            }}
          >
            Reset
          </Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            Save entry
          </Button>
        </div>
      </form>
    </Card>
  );
}
