import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles, Check, X, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useResume, useFullVersion } from "@/hooks/useResumes";
import { useToast } from "@/context/UIContext";
import { improveApi } from "@/api/improve";

const area =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]";

const FIELDS = [
  ["contribution", "What did YOU personally do or build?", "e.g. I implemented the clash-checking logic and the REST endpoints myself"],
  ["technologies", "Technologies you actually used", "e.g. Node.js, Express.js, MySQL"],
  ["details", "How does it work technically?", "e.g. Each timetable is a chromosome; fitness penalises room and faculty clashes"],
  ["problem", "Problem it solves (optional)", "e.g. Manual timetable creation for my department took days"],
  ["challenges", "Challenges or decisions (optional)", "e.g. Chose a genetic algorithm because constraints conflicted"],
  ["results", "Verifiable results (optional — leave empty if none)", "Only things you can actually back up. We never invent these."],
];
const LABEL = { problem: "problem", contribution: "your contribution", technologies: "technologies", details: "technical details", challenges: "challenges", results: "results", original: "existing resume text" };

export default function ImproveBullets() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useResume(id);
  const resume = data?.resume;
  const versionId = resume?.currentVersionId;
  const fullVersion = useFullVersion(id, versionId);
  const parsed = fullVersion.data?.parsedSections;

  const [sel, setSel] = useState(null); // { type, index }
  const [facts, setFacts] = useState(null);
  const [assess, setAssess] = useState(null);
  const [sugg, setSugg] = useState(null); // { bullets:[{text,supportedBy,use}], clarifications, questions }
  const [mode, setMode] = useState("replace");

  const base = { resumeId: id, versionId, itemType: sel?.type, itemIndex: sel?.index };
  const assessM = useMutation({
    mutationFn: (body) => improveApi.assess(body),
    onSuccess: (d, vars) => {
      setAssess(d);
      if (!vars.facts) setFacts(d.facts); // first load prefills; later checks keep what the user typed
    },
    onError: (e) => toast.error("Couldn't check details", e?.message),
  });
  const genM = useMutation({
    mutationFn: (body) => improveApi.generate(body),
    onSuccess: (d) => setSugg({ ...d, bullets: d.bullets.map((b) => ({ ...b, use: true })) }),
  });
  const applyM = useMutation({
    mutationFn: (body) => improveApi.apply(body),
    onSuccess: async (d) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["resumes"] }),
      ]);
      toast.success("Saved as a new version", `${d.version.label} created. Your previous version is unchanged.`);
      nav(`/resumes/${id}`);
    },
  });

  function pick(type, index) {
    setSel({ type, index });
    setAssess(null);
    setSugg(null);
    setFacts(null);
    assessM.mutate({ resumeId: id, versionId, itemType: type, itemIndex: index });
  }

  const chosen = sugg?.bullets.filter((b) => b.use) || [];
  const items = [
    ...(parsed?.projects || []).map((p, i) => ({ type: "project", index: i, name: p.name || `Project ${i + 1}` })),
    ...(parsed?.experience || []).map((e, i) => ({ type: "experience", index: i, name: [e.role, e.company].filter(Boolean).join(", ") || `Experience ${i + 1}` })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Improve your bullets — ${resume?.title || "Resume"}`}
        description="Tell us what you really did. We'll ask for details when needed and only write what your facts support."
        actions={<Button variant="ghost" onClick={() => nav(`/resumes/${id}`)}><ArrowLeft size={14} /> Back to resume</Button>}
      />

      <Card>
        <CardHeader className="!mb-2"><CardTitle className="text-base">1. Pick a project or experience</CardTitle></CardHeader>
        {fullVersion.isLoading && <Skeleton className="h-10 rounded-xl" />}
        {!fullVersion.isLoading && items.length === 0 && (
          <div className="text-sm text-[var(--ink-muted)]">No projects or experience found in this version. Add some with “Edit sections” first.</div>
        )}
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <Button key={`${it.type}${it.index}`} size="sm" variant={sel?.type === it.type && sel?.index === it.index ? "accent" : "outline"} onClick={() => pick(it.type, it.index)}>
              {it.name}
            </Button>
          ))}
        </div>
      </Card>

      {sel && assessM.isPending && !facts && <Skeleton className="h-40 rounded-3xl" />}

      {facts && assess && (
        <Card>
          <CardHeader className="!mb-2">
            <CardTitle className="text-base">2. Your facts for “{assess.item.name}”</CardTitle>
            <CardDescription>
              Current bullets: {assess.item.bullets.length ? assess.item.bullets.join(" · ") : "none"}
            </CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {FIELDS.map(([k, label, ph]) => (
              <label key={k} className="block">
                <span className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">{label}</span>
                <textarea className={`${area} mt-1`} rows={k === "technologies" ? 1 : 2} placeholder={ph} value={facts[k]} maxLength={1500}
                  onChange={(e) => { setFacts({ ...facts, [k]: e.target.value }); setSugg(null); }} />
              </label>
            ))}
          </div>

          {assess.questions.length > 0 && (
            <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3 space-y-1.5">
              {assess.questions.map((q) => (
                <div key={q.key} className="text-xs flex gap-2">
                  <HelpCircle size={13} className="mt-0.5 shrink-0" />
                  <span><b>{q.blocking ? "Needed: " : "Optional: "}</b>{q.question}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={assessM.isPending} onClick={() => assessM.mutate({ ...base, facts })}>
              {assessM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Check my answers
            </Button>
            <Button variant="accent" disabled={!assess.ready || genM.isPending} onClick={() => genM.mutate({ ...base, facts })}>
              {genM.isPending ? <><Loader2 size={14} className="animate-spin" /> Writing…</> : <><Sparkles size={14} /> Suggest bullets</>}
            </Button>
            {!assess.ready && <span className="text-xs text-[var(--ink-muted)]">Answer the “Needed” questions, then click Check my answers.</span>}
          </div>
          {genM.error && <div className="mt-3 text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">{genM.error.message}</div>}
        </Card>
      )}

      {sugg && (
        <Card>
          <CardHeader className="!mb-2">
            <CardTitle className="text-base">3. Review suggestions</CardTitle>
            <CardDescription>Edit freely, keep what's true, reject the rest. Nothing changes until you apply.</CardDescription>
          </CardHeader>

          {sugg.bullets.length === 0 && <div className="text-sm text-[var(--ink-muted)]">No suggestion passed the fact check. See the notes below, add the missing facts, and try again.</div>}
          <div className="space-y-3">
            {sugg.bullets.map((b, i) => (
              <div key={i} className={`rounded-2xl border p-3 space-y-2 ${b.use ? "border-[var(--accent)]" : "border-[var(--border)] opacity-60"}`}>
                <textarea className={area} rows={2} value={b.text} maxLength={320}
                  onChange={(e) => setSugg({ ...sugg, bullets: sugg.bullets.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[var(--ink-muted)]">Based on:</span>
                  {b.supportedBy.map((k) => <Badge key={k} tone="neutral">{LABEL[k] || k}</Badge>)}
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant={b.use ? "accent" : "outline"} onClick={() => setSugg({ ...sugg, bullets: sugg.bullets.map((x, j) => (j === i ? { ...x, use: !x.use } : x)) })}>
                      <Check size={12} /> {b.use ? "Selected" : "Select"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSugg({ ...sugg, bullets: sugg.bullets.filter((_, j) => j !== i) })}><X size={12} /> Reject</Button>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {(sugg.clarifications.length > 0 || sugg.questions.length > 0) && (
            <ul className="mt-3 text-xs text-[var(--ink-muted)] list-disc pl-5 space-y-1">
              {sugg.clarifications.map((c, i) => <li key={`c${i}`}>{c}</li>)}
              {sugg.questions.map((c, i) => <li key={`q${i}`}><b>Question:</b> {c}</li>)}
            </ul>
          )}

          {sugg.bullets.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select className={`${area} !w-auto`} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="replace">Replace current bullets</option>
                <option value="append">Add to current bullets</option>
              </select>
              <Button variant="accent" size="lg" disabled={!chosen.length || applyM.isPending}
                onClick={() => applyM.mutate({ ...base, facts, mode, bullets: chosen.map((b) => b.text) })}>
                {applyM.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply {chosen.length} bullet{chosen.length === 1 ? "" : "s"} as a new version
              </Button>
            </div>
          )}
          {applyM.error && <div className="mt-3 text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">{applyM.error.message}</div>}
        </Card>
      )}
    </div>
  );
}
