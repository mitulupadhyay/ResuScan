import { useMutation } from "@tanstack/react-query";
import { pdf } from "@react-pdf/renderer";
import { Loader2, ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { resumesApi } from "@/api/resumes";
import { ResumeDocument } from "./ResumeDocument";

const ICON = {
  pass: <CheckCircle2 size={15} className="text-[var(--success)] shrink-0 mt-0.5" />,
  warn: <AlertTriangle size={15} className="text-[var(--warning)] shrink-0 mt-0.5" />,
  fail: <XCircle size={15} className="text-[var(--danger)] shrink-0 mt-0.5" />,
};

/** Builds the real PDF, re-extracts its text on the server and compares it with the saved content. */
export function ExportCheck({ resumeId, versionId, docProps }) {
  const check = useMutation({
    mutationFn: async () => {
      const blob = await pdf(<ResumeDocument {...docProps} />).toBlob();
      return resumesApi.validateExport(resumeId, versionId, blob);
    },
  });
  const report = check.data?.report;

  return (
    <Card>
      <CardHeader className="flex-wrap !mb-2">
        <div className="max-w-2xl">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={15} /> Verify the PDF</CardTitle>
          <CardDescription className="mt-1">
            Re-reads the text of the PDF we generate and checks it against your saved resume. This checks that the file is readable and complete, not that any specific ATS will accept it.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
          {check.isPending ? <><Loader2 size={14} className="animate-spin" /> Checking…</> : "Run check"}
        </Button>
      </CardHeader>

      {check.error && <div className="text-xs text-[var(--danger)] bg-[#F8E3E0] rounded-xl px-3 py-2">{check.error.message}</div>}

      {report && (
        <div className="space-y-3">
          {report.differsMaterially && (
            <div className="text-xs rounded-xl bg-[#FBF1E2] text-[var(--warning)] px-3 py-2">
              The exported PDF differs from your saved content ({report.fidelity}% of items found). Review the details below before sending it.
            </div>
          )}
          {!report.differsMaterially && (
            <div className="text-xs rounded-xl bg-[var(--surface-2)] px-3 py-2">PDF text matches your saved content ({report.fidelity}% of items found).</div>
          )}
          <ul className="space-y-2">
            {report.checks.map((c) => (
              <li key={c.label} className="flex gap-2 text-sm">
                {ICON[c.status]}
                <div><span className="font-medium">{c.label}</span><div className="text-xs text-[var(--ink-muted)]">{c.detail}</div></div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
