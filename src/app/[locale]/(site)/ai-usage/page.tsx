import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

/**
 * The disclosure page.
 *
 * The whole body lives in the dictionaries, so `/id` renders Indonesian rather than an
 * Indonesian heading over English prose. It previously kept the body as hardcoded English
 * strings in this file — which meant the one page whose entire purpose is transparency was
 * the one page that was not translated, and no check could notice, because a body that is
 * not in the dictionary is invisible to the parity gate.
 *
 * `AI-USAGE.md` at the repository root mirrors this content for people reading the repo.
 * Two copies is not ideal, but the file is the repo-facing source and the dictionary is the
 * site-facing one; the page's own "Last updated" line is what keeps them honest.
 */

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/ai-usage">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).aiUsage;
  return { title: t.metaTitle, description: t.metaDescription };
}

/**
 * `lead` — text, reproducing the original emphasis. Keeping the markup here rather than in
 * the dictionary means translators deal in prose, not in tags.
 */
function Lead({ lead, text }: { lead: string; text: string }) {
  return (
    <>
      <strong>{lead}</strong> — {text}
    </>
  );
}

/**
 * Renders `backtick` spans as `<code>`. Small, but it lets a dictionary string mention a
 * command without the JSON needing to know about HTML.
 */
function CodeText({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <code key={index}>{part}</code> : part,
      )}
    </>
  );
}

export default async function AiUsagePage({
  params,
}: PageProps<"/[locale]/ai-usage">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = (await getDictionary(locale)).aiUsage;
  const b = t.body;

  return (
    <div className="shell page-wrap">
      <header className="page-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.description}</p>
      </header>

      <div className="long-copy ai-usage-copy">
        <h2>{b.tools.heading}</h2>
        <ul className="ai-usage-list">
          <li>
            <Lead lead={b.tools.piLead} text={b.tools.piText} />
          </li>
          <li>
            <Lead lead={b.tools.openrouterLead} text={b.tools.openrouterText} />
          </li>
          <li>
            <Lead lead={b.tools.omnirouteLead} text={b.tools.omnirouteText} />
          </li>
        </ul>

        <h2>{b.did.heading}</h2>
        <ul className="ai-usage-list">
          <li>{b.did.scaffold}</li>
          <li>{b.did.sanity}</li>
          <li>{b.did.docs}</li>
          <li>{b.did.debug}</li>
        </ul>

        <h2>{b.human.heading}</h2>
        <ul className="ai-usage-list">
          <li>
            <Lead lead={b.human.designLead} text={b.human.designText} />
          </li>
          <li>
            <Lead lead={b.human.journalLead} text={b.human.journalText} />
          </li>
          <li>
            <Lead lead={b.human.reviewLead} text={b.human.reviewText} />
          </li>
        </ul>

        {/* Added because the section above used to claim that all page copy and this
            disclosure were human-written. Neither was, and a transparency page that is
            wrong about itself is worse than no transparency page. */}
        <h2>{b.drafted.heading}</h2>
        <p>{b.drafted.text}</p>

        <h2>{b.generated.heading}</h2>
        <p>
          {b.generated.intro} <strong>{b.generated.introStrong}</strong>.
        </p>
        <ul className="ai-usage-list">
          <li>{b.generated.once}</li>
          <li>{b.generated.public}</li>
          <li>{b.generated.knowledge}</li>
          <li>{b.generated.private}</li>
        </ul>

        <h2>{b.verification.heading}</h2>
        <ul className="ai-usage-list">
          <li>
            <CodeText text={b.verification.history} />
          </li>
          <li>{b.verification.notes}</li>
          <li>{b.verification.prose}</li>
        </ul>

        <p className="ai-usage-updated">{b.updated}</p>
      </div>
    </div>
  );
}
