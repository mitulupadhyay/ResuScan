import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Target, Trash2, X, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useResume } from "@/hooks/useResumes";
import {
  useJobMatches,
  useJobMatch,
  useCreateJobMatch,
  usePatchRequirement,
  useDeleteJobMatch,
} from "@/hooks/useJobMatch";
import { relativeTime } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const STATUS = {
  matched: { label: "Matched", tone: "success" },
  partial: { label: "Partially demonstrated", tone: "warning" },
  needs_review: { label: "Needs review", tone: "neutral" },
  not_evidenced: { label: "Not evidenced", tone: "danger" },
};
const GAP = {
  missing_evidence: "Missing evidence — you may have it, but the resume doesn't show it",
  confirmed_gap: "Confirmed skill gap — you told us you haven't used this yet",
  unknown: "Unknown — we can't tell from the resume alone",
};
const GROUPS = [
  ["required", "Required"],
  ["preferred", "Preferred"],
  ["responsibility", "Responsibilities"],
];

function Dimension({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">{label}</div>
      <div className="font-display text-3xl font-semibold tabular-nums mt-1">{value ?? "—"}<span className="text-sm text-[var(--ink-muted)]">/100</span></div>
      <div className="text-xs text-[var(--ink-muted)] mt-1">{hint}</div>
    </div>
  );
}

function RequirementRow({ req, result, onPatch, busy }) {
  const st = STATUS[result.status];
  const canClarify = result.status !== "matched";
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-[var(--ink)]">{req.text}</div>
          {req.sourceSentence && req.sourceSentence !== req.text && (
            <div className="text-xs text-[var(--ink-muted)] mt-0.5">From the posting: “{req.sourceSentence}”</div>
          )}
          {req.needsReview && (
            <div className="text-xs text-[var(--warning)] mt-0.5">Extraction uncertain — please check this requirement.</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={st.tone}>{st.label}</Badge>
          <button
            title="Remove wrongly extracted requirement"
            className="text-[var(--ink-muted)] hover:text-[var(--danger)]"
            onClick={() => onPatch({ reqId: req.id, remove: true })}
            disabled={busy}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {result.evidence.length > 0 ? (
        <div className="space-y-1.5">
          {result.evidence.map((e, i) => (
            <div key={i} className="text-[13px] rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <span className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)] mr-2">{e.section}</span>
              {e.text}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--ink-muted)]">No supporting text found on your resume.</div>
      )}

      <div className="text-xs text-[var(--ink-muted)]">{result.reason}</div>
      {result.gapType && (
        <div className="text-xs text-[var(--ink)]"><span className="font-semibold">{GAP[result.gapType]}</span></div>
      )}
      <div className="text-xs text-[var(--ink)]">→ {result.nextAction}</div>

      {canClarify && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-[var(--ink-muted)]">Do you have this skill/experience?</span>
          {[["have_skill", "Yes, I've used it"], ["dont_have", "No, not yet"], ["unsure", "Not sure"]].map(([v, l]) => (
            <Button
              key={v}
              size="sm"
              variant={req.clarification === v ? "accent" : "outline"}
              disabled={busy}
              onClick={() => onPatch({ reqId: req.id, clarification: req.clarification === v ? null : v })}
            >
              {l}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Report({ match, resumeId }) {
  const patch = usePatchRequirement(match._id, resumeId);
  const s = match.score || {};
  const resById = Object.fromEntries(match.results.map((r) => [r.requirementId, r]));
  const [showFormula, setShowFormula] = useState(false);

  return (
    <div className="space-y-5">
      {match.warning && (
        <div className="text-xs text-[var(--warning)] bg-[#FBF1E2] rounded-xl px-3 py-2">{match.warning}</div>
      )}

      <Card>
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle className="text-base">{match.jobTitle || "Job match"} — readiness estimate</CardTitle>
            <CardDescription className="mt-1">
              A ResuScan estimate from your resume text and this posting. It is <b>not</b> an employer ATS score.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="font-display text-5xl font-semibold tabular-nums leading-none">{s.overall ?? "—"}</div>
            <div className="text-[11px] text-[var(--ink-muted)] mt-1">overall · scoring v{s.version}</div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Dimension label="Requirement coverage" value={s.requirementCoverage} hint="Weighted share of requirements your resume shows. Required counts 3×." />
          <Dimension label="Evidence strength" value={s.evidenceStrength} hint="Matches shown in a project or job, not just listed." />
          <Dimension label="Document quality" value={s.documentQuality} hint="Contact info, sections and bullets we could read." />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(STATUS).map(([k, v]) => (
            <Badge key={k} tone={v.tone}>{v.label}: {s.counts?.[k] ?? 0}</Badge>
          ))}
        </div>

        <button className="mt-4 text-xs text-[var(--accent-strong)] flex items-center gap-1" onClick={() => setShowFormula((v) => !v)}>
          <Info size={12} /> {showFormula ? "Hide" : "How is this calculated?"}
        </button>
        {showFormula && (
          <div className="mt-3 text-xs text-[var(--ink-muted)] space-y-2">
            <p>
              Overall = 60% requirement coverage + 25% evidence strength + 15% document quality. Coverage credit:
              matched 1, partial 0.5, needs review 0.25, not evidenced 0. Weights: required 3, preferred 1, responsibility 1.
              The same resume and requirements always give the same score.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {(s.limitations || []).map((l, i) => <li key={i}>{l}</li>)}
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {(s.qualityChecks || []).map((c) => (
                <div key={c.label}>{c.pass ? "✓" : "✗"} {c.label}</div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {s.priorities?.length > 0 && (
        <Card>
          <CardHeader className="!mb-2">
            <CardTitle className="text-base">Fix these first</CardTitle>
            <CardDescription>Highest-value gaps, required items first.</CardDescription>
          </CardHeader>
          <ol className="space-y-2 text-sm list-decimal pl-5">
            {s.priorities.map((p) => (
              <li key={p.requirementId}>
                <span className="font-medium">{p.text}</span> <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                <div className="text-xs text-[var(--ink-muted)]">{p.action}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {GROUPS.map(([type, title]) => {
        const reqs = match.requirements.filter((r) => r.type === type);
        if (!reqs.length) return null;
        return (
          <div key={type} className="space-y-3">
            <h3 className="font-display text-base font-semibold">{title} ({reqs.length})</h3>
            {reqs.map((r) => (
              <RequirementRow key={r.id} req={r} result={resById[r.id]} onPatch={patch.mutate} busy={patch.isPending} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function JobMatch() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data } = useResume(id);
  const resume = data?.resume;

  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState(user?.onboarding?.jobDescription || "");
  const [activeId, setActiveId] = useState(null);

  const history = useJobMatches(id);
  const create = useCreateJobMatch(id);
  const del = useDeleteJobMatch(id);
  const active = useJobMatch(activeId);

  async function run() {
    try {
      const res = await create.mutateAsync({ jobTitle: title.trim() || undefined, jobDescription: jd.trim() });
      setActiveId(res.match._id);
    } catch {
      /* shown below */
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Match to a job — ${resume?.title || "Resume"}`}
        description="Paste a job description. We extract the requirements and show exactly which ones your resume demonstrates."
        actions={<Button variant="ghost" onClick={() => nav(`/resumes/${id}`)}><ArrowLeft size={14} /> Back to resume</Button>}
      />

      <Card>
        <div className="space-y-3">
          <Input placeholder="Job title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={10}
            maxLength={15000}
            placeholder="Paste the full job description, including the requirements / qualifications section…"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--ink-muted)]">{jd.length.toLocaleString()} / 15,000 · uses your current resume version</span>
            <Button variant="accent" size="lg" onClick={run} disabled={create.isPending || jd.trim().length < 80}>
              {create.isPending ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><Target size={14} /> Analyze match</>}
            </Button>
          </div>
          {create.error && (
            <div className="text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">{create.error.message}</div>
          )}
        </div>
      </Card>

      {history.data?.length > 0 && (
        <Card>
          <CardHeader className="!mb-2"><CardTitle className="text-base">Previous matches</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-2">
            {history.data.map((m) => (
              <div key={m._id} className="flex items-center gap-1">
                <Button size="sm" variant={activeId === m._id ? "accent" : "outline"} onClick={() => setActiveId(m._id)}>
                  {m.jobTitle || "Untitled"} · {m.score?.overall ?? "—"} · {relativeTime(m.createdAt)}
                </Button>
                <button
                  title="Delete"
                  className="text-[var(--ink-muted)] hover:text-[var(--danger)]"
                  onClick={() => { del.mutate(m._id); if (activeId === m._id) setActiveId(null); }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {active.isLoading && <Skeleton className="h-[300px] rounded-3xl" />}
      {active.error && <div className="text-sm text-[var(--danger)]">{active.error.message}</div>}
      {active.data && <Report match={active.data} resumeId={id} />}
    </div>
  );
}
