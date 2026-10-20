import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useResume, useFullVersion, useSaveSections } from "@/hooks/useResumes";
import { toForm, toPayload, validateForm } from "@/lib/sectionsForm";
import { resolveOrder, SECTION_TITLES } from "@/lib/sectionOrder";

const area =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]";

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Section({ title, description, onAdd, addLabel, children }) {
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus size={13} /> {addLabel}
          </Button>
        )}
      </CardHeader>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Entry({ onRemove, children }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3 relative">
      <button
        title="Remove"
        onClick={onRemove}
        className="absolute top-3 right-3 text-[var(--ink-muted)] hover:text-[var(--danger)]"
      >
        <Trash2 size={14} />
      </button>
      {children}
    </div>
  );
}

function LinkRows({ links, onChange }) {
  const set = (i, k, v) => onChange(links.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Input placeholder="Label (GitHub)" value={l.label} onChange={(e) => set(i, "label", e.target.value)} className="max-w-[10rem]" />
          <Input placeholder="https://…" value={l.url} onChange={(e) => set(i, "url", e.target.value)} />
          <button className="text-[var(--ink-muted)] hover:text-[var(--danger)]" onClick={() => onChange(links.filter((_, j) => j !== i))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...links, { label: "", url: "" }])}>
        <Plus size={12} /> Add link
      </Button>
    </div>
  );
}

export default function EditResume() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { data } = useResume(id);
  const resume = data?.resume;
  const versionId = params.get("v") || resume?.currentVersionId;
  const fullVersion = useFullVersion(id, versionId);
  const save = useSaveSections(id);

  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const base = fullVersion.data ? toForm(fullVersion.data.parsedSections) : null;
  const form = draft ?? base;
  const update = (fn) => setDraft((d) => fn(structuredClone(d ?? base)));
  const setRow = (path, i, key, v) => update((f) => { f[path][i][key] = v; return f; });
  const addRow = (path, row) => update((f) => { f[path].push(row); return f; });
  const delRow = (path, i) => update((f) => { f[path].splice(i, 1); return f; });

  async function onSave() {
    const msg = validateForm(form);
    setError(msg);
    if (msg) return;
    try {
      await save.mutateAsync({ versionId, sections: toPayload(form) });
      nav(`/resumes/${id}`);
    } catch {
      /* toast shown by hook; server message below */
    }
  }

  if (!form) return <Skeleton className="h-[400px] rounded-3xl" />;
  const b = form.basics;
  const order = resolveOrder(toPayload(form));
  const custom = form.sectionOrder.length > 0;
  const move = (i, d) => update((f) => {
    const list = [...order];
    const j = i + d;
    if (j < 0 || j >= list.length) return f;
    [list[i], list[j]] = [list[j], list[i]];
    f.sectionOrder = list;
    return f;
  });

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title={`Review & edit — ${resume?.title || "Resume"}`}
        description={`Fix anything the parser got wrong. Saving creates a new version; ${fullVersion.data?.label || "your original"} stays untouched.`}
        actions={<Button variant="ghost" onClick={() => nav(`/resumes/${id}`)}><ArrowLeft size={14} /> Back to resume</Button>}
      />

      <Section
        title="Section order"
        description={custom ? "Using your custom order." : "Automatic: students lead with Education, people with experience lead with Experience."}
        onAdd={custom ? () => update((f) => { f.sectionOrder = []; return f; }) : undefined}
        addLabel="Reset to automatic"
      >
        <ol className="space-y-1.5">
          {order.map((k, i) => (
            <li key={k} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm">
              <span>{i + 1}. {SECTION_TITLES[k]}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${SECTION_TITLES[k]} up`}><ArrowUp size={13} /></Button>
                <Button size="sm" variant="ghost" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${SECTION_TITLES[k]} down`}><ArrowDown size={13} /></Button>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-[var(--ink-muted)]">Contact details always stay at the top. Empty sections are skipped.</p>
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Full name *"><Input value={b.name} onChange={(e) => update((f) => { f.basics.name = e.target.value; return f; })} /></Field>
          <Field label="Headline / target role"><Input value={b.title} onChange={(e) => update((f) => { f.basics.title = e.target.value; return f; })} /></Field>
          <Field label="Email"><Input value={b.email} onChange={(e) => update((f) => { f.basics.email = e.target.value; return f; })} /></Field>
          <Field label="Phone"><Input value={b.phone} onChange={(e) => update((f) => { f.basics.phone = e.target.value; return f; })} /></Field>
          <Field label="Location"><Input value={b.location} onChange={(e) => update((f) => { f.basics.location = e.target.value; return f; })} /></Field>
        </div>
        <Field label="Profile links">
          <LinkRows links={b.links} onChange={(v) => update((f) => { f.basics.links = v; return f; })} />
        </Field>
      </Section>

      <Section title="Summary">
        <textarea className={area} rows={3} maxLength={1200} value={form.summary} onChange={(e) => update((f) => { f.summary = e.target.value; return f; })} />
      </Section>

      <Section title="Skills" description="One group per line of your resume, items separated by commas." onAdd={() => addRow("skillGroups", { category: "", items: "" })} addLabel="Add group">
        {form.skillGroups.map((g, i) => (
          <Entry key={i} onRemove={() => delRow("skillGroups", i)}>
            <Field label="Category"><Input value={g.category} onChange={(e) => setRow("skillGroups", i, "category", e.target.value)} /></Field>
            <Field label="Skills (comma-separated)"><Input value={g.items} onChange={(e) => setRow("skillGroups", i, "items", e.target.value)} /></Field>
          </Entry>
        ))}
      </Section>

      <Section title="Experience & internships" onAdd={() => addRow("experience", { company: "", role: "", location: "", period: "", bullets: "" })} addLabel="Add experience">
        {form.experience.map((e, i) => (
          <Entry key={i} onRemove={() => delRow("experience", i)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
              <Field label="Role"><Input value={e.role} onChange={(ev) => setRow("experience", i, "role", ev.target.value)} /></Field>
              <Field label="Company"><Input value={e.company} onChange={(ev) => setRow("experience", i, "company", ev.target.value)} /></Field>
              <Field label="Dates (e.g. Jun 2025 – Aug 2025)"><Input value={e.period} onChange={(ev) => setRow("experience", i, "period", ev.target.value)} /></Field>
              <Field label="Location"><Input value={e.location} onChange={(ev) => setRow("experience", i, "location", ev.target.value)} /></Field>
            </div>
            <Field label="Bullets (one per line)"><textarea className={area} rows={4} value={e.bullets} onChange={(ev) => setRow("experience", i, "bullets", ev.target.value)} /></Field>
          </Entry>
        ))}
      </Section>

      <Section title="Projects" onAdd={() => addRow("projects", { name: "", tech: "", bullets: "", links: [] })} addLabel="Add project">
        {form.projects.map((p, i) => (
          <Entry key={i} onRemove={() => delRow("projects", i)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
              <Field label="Project name"><Input value={p.name} onChange={(ev) => setRow("projects", i, "name", ev.target.value)} /></Field>
              <Field label="Technologies (comma-separated)"><Input value={p.tech} onChange={(ev) => setRow("projects", i, "tech", ev.target.value)} /></Field>
            </div>
            <Field label="What you built (one bullet per line)"><textarea className={area} rows={3} value={p.bullets} onChange={(ev) => setRow("projects", i, "bullets", ev.target.value)} /></Field>
            <Field label="Links"><LinkRows links={p.links} onChange={(v) => setRow("projects", i, "links", v)} /></Field>
          </Entry>
        ))}
      </Section>

      <Section title="Education" onAdd={() => addRow("education", { school: "", degree: "", location: "", period: "", details: "" })} addLabel="Add education">
        {form.education.map((e, i) => (
          <Entry key={i} onRemove={() => delRow("education", i)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
              <Field label="School"><Input value={e.school} onChange={(ev) => setRow("education", i, "school", ev.target.value)} /></Field>
              <Field label="Degree"><Input value={e.degree} onChange={(ev) => setRow("education", i, "degree", ev.target.value)} /></Field>
              <Field label="Dates"><Input value={e.period} onChange={(ev) => setRow("education", i, "period", ev.target.value)} /></Field>
              <Field label="CGPA / details"><Input value={e.details} onChange={(ev) => setRow("education", i, "details", ev.target.value)} /></Field>
            </div>
          </Entry>
        ))}
      </Section>

      <Section title="Certifications & achievements" onAdd={() => addRow("certifications", { name: "", issuer: "", year: "" })} addLabel="Add item">
        {form.certifications.map((c, i) => (
          <Entry key={i} onRemove={() => delRow("certifications", i)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-6">
              <Field label="Name"><Input value={c.name} onChange={(ev) => setRow("certifications", i, "name", ev.target.value)} /></Field>
              <Field label="Issuer"><Input value={c.issuer} onChange={(ev) => setRow("certifications", i, "issuer", ev.target.value)} /></Field>
              <Field label="Year"><Input value={c.year} onChange={(ev) => setRow("certifications", i, "year", ev.target.value)} /></Field>
            </div>
          </Entry>
        ))}
      </Section>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur px-6 py-3 flex items-center justify-end gap-3">
        {(error || save.error) && <span className="text-xs text-[var(--danger)] mr-auto">{error || save.error.message}</span>}
        <Button variant="ghost" onClick={() => setDraft(null)} disabled={!draft || save.isPending}>Reset changes</Button>
        <Button variant="accent" size="lg" onClick={onSave} disabled={save.isPending || !draft}>
          {save.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save as new version</>}
        </Button>
      </div>
    </div>
  );
}
