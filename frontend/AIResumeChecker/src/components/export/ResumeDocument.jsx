import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Never split words with hyphens - ATS would read "Imple-mented" as two tokens.
Font.registerHyphenationCallback((word) => [word]);

/**
 * ATS-friendly resume template.
 *
 * Rules this template follows on purpose:
 *  - single column, no tables, no icons, no images, no text boxes
 *  - built-in Helvetica (always embedded as real, selectable text)
 *  - standard section names (Summary, Skills, Experience, Projects, Education ...)
 *  - real "•" bullet characters instead of drawn shapes
 *  - visible URLs (and clickable), plain black text, no footer/page chrome
 *  - dates on the right of each entry in a consistent format
 */

const INK = "#111111";
const MUTED = "#444444";
const RULE = "#777777";

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 38,
    paddingHorizontal: 44,
    fontSize: 10,
    lineHeight: 1.35,
    color: INK,
    fontFamily: "Helvetica",
  },

  name: {
    fontSize: 22,
    lineHeight: 1.15,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 11,
    lineHeight: 1.2,
    textAlign: "center",
    color: MUTED,
    marginTop: 5,
  },
  contact: {
    textAlign: "center",
    marginTop: 5,
    fontSize: 9.5,
    color: MUTED,
  },
  contactLink: { color: MUTED, textDecoration: "none" },
  sep: { marginHorizontal: 6, color: MUTED },

  section: { marginTop: 11 },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingBottom: 2,
    marginBottom: 5,
    borderBottomWidth: 0.8,
    borderBottomColor: RULE,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rowLeft: { flex: 1, paddingRight: 10 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique", color: MUTED },
  date: { fontSize: 9.5, color: MUTED, textAlign: "right" },

  item: { marginBottom: 7 },
  bulletRow: { flexDirection: "row", marginTop: 1.5, paddingLeft: 6 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },

  skillLine: { marginBottom: 2 },
  link: { color: INK, textDecoration: "none" },
  linkLine: { marginTop: 2, paddingLeft: 16, fontSize: 9.5, color: MUTED },
});

// Helvetica (WinAnsi) can't draw every Unicode character; swap/strip the risky ones
// so nothing renders as garbage and ATS gets clean text.
const clean = (s) =>
  String(s ?? "")
    .replace(/[\u2192\u21D2\u279C]/g, "->")
    .replace(/[\u00A0\u202F\u2009\u200A]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .replace(
      /[^\x20-\x7E\u00A1-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g,
      ""
    )
    .trim();

const shortUrl = (url) =>
  clean(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

const hasText = (v) => clean(v).length > 0;

const SEP = "  \u00B7  ";
function joinNodes(nodes) {
  return nodes
    .filter(Boolean)
    .flatMap((node, i) => (i === 0 ? [node] : [<Text key={`s${i}`}>{SEP}</Text>, node]));
}

function Section({ title, children, gap }) {
  return (
    <View style={[styles.section, gap]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children }) {
  return (
    <View style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{clean(children)}</Text>
    </View>
  );
}

function LinkText({ link, style }) {
  const label = clean(link?.label);
  const url = clean(link?.url);
  if (!url) return label ? <Text style={style}>{label}</Text> : null;
  return (
    <Link src={url} style={[styles.link, style]}>
      {label ? `${label}: ${shortUrl(url)}` : shortUrl(url)}
    </Link>
  );
}

function Skills({ p }) {
  const groups = (p.skillGroups || []).filter((g) => g?.items?.length);
  if (groups.length) {
    return (
      <>
        {groups.map((g, i) => (
          <Text key={i} style={styles.skillLine}>
            <Text style={styles.bold}>{clean(g.category)}: </Text>
            {g.items.map(clean).filter(Boolean).join(", ")}
          </Text>
        ))}
      </>
    );
  }
  return (
    <Text style={styles.skillLine}>
      <Text style={styles.bold}>Technical Skills: </Text>
      {(p.skills || []).map(clean).filter(Boolean).join(", ")}
    </Text>
  );
}

function Experience({ items }) {
  return items.map((e, i) => (
    <View key={i} style={styles.item}>
      <View wrap={false}>
        <View style={styles.row}>
          <Text style={[styles.rowLeft, styles.bold]}>
            {clean(e.role) || "Role"}
            {hasText(e.company) ? `, ${clean(e.company)}` : ""}
          </Text>
          {hasText(e.period) ? <Text style={styles.date}>{clean(e.period)}</Text> : null}
        </View>
        {hasText(e.location) ? <Text style={styles.italic}>{clean(e.location)}</Text> : null}
        {(e.bullets || []).filter(hasText).slice(0, 1).map((b, j) => (
          <Bullet key={j}>{b}</Bullet>
        ))}
      </View>
      {(e.bullets || []).filter(hasText).slice(1).map((b, j) => (
        <Bullet key={j}>{b}</Bullet>
      ))}
    </View>
  ));
}

function Projects({ items }) {
  return items.map((pr, i) => {
    const bullets = (pr.bullets?.length ? pr.bullets : pr.description ? [pr.description] : []).filter(hasText);
    const tech = (pr.tech || []).map(clean).filter(Boolean).join(", ");
    const links = (pr.links || []).filter((l) => hasText(l.url) || hasText(l.label));
    return (
      <View key={i} style={styles.item}>
        <View wrap={false}>
          <Text>
            <Text style={styles.bold}>{clean(pr.name)}</Text>
            {tech ? <Text style={styles.italic}>{`  |  ${tech}`}</Text> : null}
          </Text>
          {bullets.slice(0, 1).map((b, j) => (
            <Bullet key={j}>{b}</Bullet>
          ))}
        </View>
        {bullets.slice(1).map((b, j) => (
          <Bullet key={j}>{b}</Bullet>
        ))}
        {links.length ? (
          <Text style={styles.linkLine} wrap={false}>
            {joinNodes(links.map((l, j) => <LinkText key={j} link={l} />))}
          </Text>
        ) : null}
      </View>
    );
  });
}

function Education({ items }) {
  return items.map((e, i) => (
    <View key={i} style={styles.item} wrap={false}>
      <View style={styles.row}>
        <Text style={[styles.rowLeft, styles.bold]}>{clean(e.school)}</Text>
        {hasText(e.period) ? <Text style={styles.date}>{clean(e.period)}</Text> : null}
      </View>
      <Text>
        {clean(e.degree)}
        {hasText(e.location) ? <Text style={styles.italic}>{`  |  ${clean(e.location)}`}</Text> : null}
      </Text>
      {hasText(e.details) ? <Text style={{ color: MUTED }}>{clean(e.details)}</Text> : null}
    </View>
  ));
}

function Certifications({ items }) {
  return items.map((c, i) => (
    <View key={i} style={styles.row} wrap={false}>
      <Text style={styles.rowLeft}>
        <Text style={styles.bold}>{clean(c.name)}</Text>
        {hasText(c.issuer) ? `  -  ${clean(c.issuer)}` : ""}
      </Text>
      {hasText(c.year) ? <Text style={styles.date}>{clean(c.year)}</Text> : null}
    </View>
  ));
}

import { resolveOrder } from "@/lib/sectionOrder";

export function ResumeDocument({ user, version }) {
  const p = version?.parsedSections || {};
  const basics = p.basics || {};

  const name = clean(basics.name) || clean(user?.name) || "Your Name";
  const email = clean(basics.email) || clean(user?.email);
  const links = (basics.links || []).filter((l) => hasText(l.url) || hasText(l.label));

  const hasExperience = (p.experience || []).length > 0;
  const hasSkills = (p.skillGroups || []).length > 0 || (p.skills || []).length > 0;
  const hasEducation = (p.education || []).length > 0;
  const hasProjects = (p.projects || []).length > 0;
  const certs = (p.certifications || []).filter((c) => hasText(c.name));
  const languages = (p.languages || []).map(clean).filter(Boolean);
  const interests = (p.interests || []).map(clean).filter(Boolean);

  const size =
    (p.experience || []).reduce((n, e) => n + 1 + (e.bullets?.length || 0), 0) +
    (p.projects || []).reduce((n, x) => n + 2 + (x.bullets?.length || 1), 0) +
    (p.skillGroups?.length || 1) +
    (p.education || []).length * 2;
  const roomy = size < 24;
  const pageStyle = roomy
    ? [styles.page, { fontSize: 10.75, paddingTop: 48, paddingHorizontal: 52 }]
    : styles.page;
  const gap = roomy ? { marginTop: 16 } : null;

  const blocks = {
    summary: hasText(p.summary) && (
      <Section key="summary" title="Professional Summary" gap={gap}>
        <Text>{clean(p.summary)}</Text>
      </Section>
    ),
    skills: hasSkills && (
      <Section key="skills" title="Technical Skills" gap={gap}>
        <Skills p={p} />
      </Section>
    ),
    experience: hasExperience && (
      <Section key="experience" title="Experience" gap={gap}>
        <Experience items={p.experience} />
      </Section>
    ),
    projects: hasProjects && (
      <Section key="projects" title="Projects" gap={gap}>
        <Projects items={p.projects} />
      </Section>
    ),
    education: hasEducation && (
      <Section key="education" title="Education" gap={gap}>
        <Education items={p.education} />
      </Section>
    ),
    certifications: certs.length > 0 && (
      <Section key="certifications" title="Certifications" gap={gap}>
        <Certifications items={certs} />
      </Section>
    ),
    additional: (languages.length > 0 || interests.length > 0) && (
      <Section key="additional" title="Additional Information" gap={gap}>
        {languages.length > 0 && (
          <Text>
            <Text style={styles.bold}>Languages: </Text>
            {languages.join(", ")}
          </Text>
        )}
        {interests.length > 0 && (
          <Text>
            <Text style={styles.bold}>Interests: </Text>
            {interests.join(", ")}
          </Text>
        )}
      </Section>
    ),
  };

  // A saved sectionOrder wins; otherwise experienced candidates lead with experience and students with education.
  const order = resolveOrder(p);

  return (
    <Document
      title={`${name} - Resume`}
      author={name}
      subject={clean(basics.title) || "Resume"}
      creator="ResuScan"
      producer="ResuScan"
    >
      <Page size="A4" style={pageStyle}>
        <Text style={styles.name}>{name}</Text>
        {hasText(basics.title) ? <Text style={styles.headline}>{clean(basics.title)}</Text> : null}

        {/* Line 1: how to reach you. Line 2: profile links. Two fixed lines never wrap awkwardly. */}
        <Text style={styles.contact}>
          {joinNodes([
            hasText(basics.location) && <Text key="loc">{clean(basics.location)}</Text>,
            email && (
              <Link key="mail" src={`mailto:${email}`} style={styles.contactLink}>
                {email}
              </Link>
            ),
            hasText(basics.phone) && <Text key="tel">{clean(basics.phone)}</Text>,
          ])}
        </Text>
        {links.length > 0 && (
          <Text style={[styles.contact, { marginTop: 2 }]}>
            {joinNodes(links.map((l, i) => <LinkText key={`l${i}`} link={l} style={styles.contactLink} />))}
          </Text>
        )}

        {order.map((k) => blocks[k]).filter(Boolean)}
      </Page>
    </Document>
  );
}
