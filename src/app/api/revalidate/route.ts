import { parseBody } from "next-sanity/webhook";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { locales } from "@/i18n/config";
import { sanityWebhookClient } from "@/lib/sanity/client";

interface WebhookDoc {
  _type?: string;
  _id?: string;
  slug?: { current?: string };
}

/** GROQ query: find the translation.metadata doc linking this post to its
 *  siblings, then dereference each sibling's slug keyed by language id.
 *  Returns null when no metadata exists (post predates the i18n plugin).
 *  Uses the non-CDN client to avoid propagation delay after a publish. */
const siblingSlugsQuery =
  `*[_type == "translation.metadata" && references($docId)][0]{
    "translations": translations[]{
      "locale": language,
      "slug": value->slug.current
    }
  }`;

interface TranslationEntry {
  locale: string;
  slug: string | null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret)
    return Response.json(
      { message: "Webhook secret is not configured." },
      { status: 500 },
    );

  const { isValidSignature, body } = await parseBody<WebhookDoc>(
    request,
    secret,
  );
  if (!isValidSignature)
    return Response.json({ message: "Invalid signature." }, { status: 401 });

  // ── shared tags + listings ──────────────────────────────────────────
  revalidateTag("posts", "max");

  if (body?._type === "post" && body.slug?.current) {
    const publishedSlug = body.slug.current;
    revalidateTag(`post:${publishedSlug}`, "max");

    // Revalidate the published slug under every locale prefix.
    for (const locale of locales) {
      revalidatePath(`/${locale}/blog/${publishedSlug}`);
    }

    // ── sibling-slug lookup ──────────────────────────────────────────
    // Document-level i18n means the ID sibling has a different slug than
    // the EN original.  We query translation.metadata to find every
    // sibling and revalidate its locale-specific path.
    if (body._id && sanityWebhookClient) {
      try {
        const metadata = await sanityWebhookClient.fetch<{
          translations: TranslationEntry[] | null;
        } | null>(siblingSlugsQuery, { docId: body._id });

        if (metadata?.translations) {
          for (const t of metadata.translations) {
            // Skip entries where the sibling is still a draft (slug is
            // null under perspective: "published") or it's the doc that
            // just published (already revalidated above).
            if (t.slug && t.slug !== publishedSlug) {
              revalidatePath(`/${t.locale}/blog/${t.slug}`);
            }
          }
        }
      } catch {
        // Sibling lookup is best-effort — a failed query shouldn't block
        // the rest of the revalidation chain.
      }
    }
  }

  // Revalidate listings + home for every locale.
  for (const locale of locales) {
    revalidatePath(`/${locale}/blog`);
    revalidatePath(`/${locale}`);
  }

  return Response.json({ revalidated: true, now: Date.now() });
}
