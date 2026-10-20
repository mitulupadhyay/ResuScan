import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/UIContext";
import { useResumesList } from "@/hooks/useResumes";
import { resumesApi } from "@/api/resumes";

const ROLES = ["SDE Intern", "Frontend Developer", "Backend Developer", "Full-Stack Developer", "Data Analyst"];
const LEVELS = [
  ["beginner", "Beginner", "Just starting out"],
  ["academic_projects", "Student with projects", "Academic or personal projects"],
  ["internships", "Have internships", "Some real work experience"],
  ["other", "Other", "Something else"],
];
const GOALS = [
  ["analyze", "Analyze my resume", "Upload it and see what's strong and weak"],
  ["tailor", "Tailor it to a job", "Match my resume against a job description"],
  ["improve_projects", "Improve my projects", "Describe my real work more effectively"],
  ["from_scratch", "Build from scratch", "No resume yet - start with an empty one"],
];

function Choice({ active, title, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border px-4 py-3 transition ${active ? "border-[var(--accent)] bg-[var(--surface-2)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}
    >
      <div className="text-sm font-medium text-[var(--ink)]">{title}</div>
      {hint && <div className="text-xs text-[var(--ink-muted)] mt-0.5">{hint}</div>}
    </button>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, saveOnboarding } = useAuth();
  const resumes = useResumesList();
  const o = user?.onboarding || {};

  const startsCustom = !!o.targetRole && !ROLES.includes(o.targetRole);
  const [role, setRole] = useState(startsCustom ? "custom" : o.targetRole || "");
  const [custom, setCustom] = useState(startsCustom ? o.targetRole : "");
  const [level, setLevel] = useState(o.experienceLevel || "");
  const [goal, setGoal] = useState(o.goal || "");
  const [jd, setJd] = useState(o.jobDescription || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const targetRole = (role === "custom" ? custom : role).trim();

  async function submit() {
    if (targetRole.length < 2) return setError("Choose or type a target role.");
    if (!level) return setError("Choose your experience level.");
    if (!goal) return setError("Choose what you want to do first.");
    setError("");
    setBusy(true);
    try {
      await saveOnboarding({ targetRole, experienceLevel: level, goal, jobDescription: jd.trim() });
      const latest = resumes.data?.[0]?._id;
      if (goal === "from_scratch") {
        const { resume } = await resumesApi.createBlank(`${targetRole} Resume`);
        nav(`/resumes/${resume._id}/edit`);
      } else if (goal === "tailor" && latest) nav(`/resumes/${latest}/match`);
      else if (goal === "improve_projects" && latest) nav(`/resumes/${latest}/improve`);
      else nav("/resumes");
      toast.success("Preferences saved", "You can change them any time from the dashboard.");
    } catch (e) {
      setError(e?.message || "Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader title="Let's set you up" description="Three quick choices so we focus on the right role. You can change these later." />

      <Card>
        <CardHeader className="!mb-2"><CardTitle className="text-base">1. Target role</CardTitle></CardHeader>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => <Button key={r} size="sm" variant={role === r ? "accent" : "outline"} onClick={() => setRole(r)}>{r}</Button>)}
          <Button size="sm" variant={role === "custom" ? "accent" : "outline"} onClick={() => setRole("custom")}>Other…</Button>
        </div>
        {role === "custom" && <Input className="mt-3" placeholder="e.g. DevOps Intern" maxLength={80} value={custom} onChange={(e) => setCustom(e.target.value)} />}
      </Card>

      <Card>
        <CardHeader className="!mb-2"><CardTitle className="text-base">2. Experience level</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LEVELS.map(([v, t, h]) => <Choice key={v} active={level === v} title={t} hint={h} onClick={() => setLevel(v)} />)}
        </div>
      </Card>

      <Card>
        <CardHeader className="!mb-2"><CardTitle className="text-base">3. What do you want to do first?</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GOALS.map(([v, t, h]) => <Choice key={v} active={goal === v} title={t} hint={h} onClick={() => setGoal(v)} />)}
        </div>
      </Card>

      <Card>
        <CardHeader className="!mb-2">
          <CardTitle className="text-base">Target job description <span className="text-xs font-normal text-[var(--ink-muted)]">(optional)</span></CardTitle>
          <CardDescription>Saved to your profile and pre-filled when you match a resume to a job.</CardDescription>
        </CardHeader>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={5}
          maxLength={15000}
          placeholder="Paste a job description…"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      </Card>

      {error && <div className="text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">{error}</div>}
      <div className="flex items-center gap-3">
        <Button variant="accent" size="lg" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Save and continue
        </Button>
        <Button variant="ghost" onClick={() => nav("/dashboard")}>Skip for now</Button>
      </div>
    </div>
  );
}
