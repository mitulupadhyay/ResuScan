import { Wand2, Loader2, Download, CheckCircle2, ListChecks, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function OptimizeCard({ analysis, targetRole, isPending, error, onOptimize, onExport }) {
  const issueCount = analysis?.issues?.length || 0;
  const role = targetRole?.trim() || analysis?.targetRole || "";

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="max-w-2xl">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 size={15} /> Build my ATS-optimized resume
          </CardTitle>
          <CardDescription className="mt-1">
            Creates a new version that fixes {issueCount ? `all ${issueCount} issues` : "the issues"} found above
            {role ? (
              <>
                {" "}and is tailored to <span className="text-[var(--ink)] font-medium">{role}</span>
              </>
            ) : (
              " — add a target role above for role-specific wording"
            )}
            : stronger summary, grouped skills, action-verb bullets, clean one-column layout.
            It never invents experience, skills or numbers.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="accent" size="lg" onClick={onOptimize} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Optimizing…
              </>
            ) : (
              <>
                <Wand2 size={14} /> Generate optimized version
              </>
            )}
          </Button>
          <Button variant="outline" size="lg" onClick={onExport}>
            <Download size={14} /> Preview &amp; export PDF
          </Button>
        </div>
      </CardHeader>
      {error && (
        <div className="text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">{error}</div>
      )}
    </Card>
  );
}

/** "What changed" + "things only you can add" for an AI-optimized version. */
export function VersionNotes({ notes, className = "" }) {
  if (!notes?.changes?.length && !notes?.todos?.length) return null;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {notes.changes?.length > 0 && (
        <Card>
          <CardHeader className="!mb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 size={15} /> What was improved
            </CardTitle>
          </CardHeader>
          <ul className="space-y-1.5 text-sm text-[var(--ink)] list-disc pl-5">
            {notes.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Card>
      )}
      {notes.todos?.length > 0 && (
        <Card>
          <CardHeader className="!mb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks size={15} /> Add these yourself <Badge tone="accent">only you can</Badge>
            </CardTitle>
          </CardHeader>
          <ul className="space-y-1.5 text-sm text-[var(--ink)] list-disc pl-5">
            {notes.todos.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function ThinParseNotice({ onReparse, isPending }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 max-w-2xl">
          <AlertTriangle size={18} className="mt-0.5 text-[var(--danger)] shrink-0" />
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">This version looks empty</div>
            <div className="text-xs text-[var(--ink-muted)] mt-1">
              The sections weren't extracted when this resume was uploaded (usually because the AI was unavailable).
              Re-read it to fill them in.
            </div>
          </div>
        </div>
        <Button variant="accent" onClick={onReparse} disabled={isPending}>
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-read resume
        </Button>
      </div>
    </Card>
  );
}
