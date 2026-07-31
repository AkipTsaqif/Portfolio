import { parseBody } from "next-sanity/webhook";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { locales } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret)
    return Response.json(
      { message: "Webhook secret is not configured." },
      { status: 500 },
    );

  const { isValidSignature, body } = await parseBody<{
    _type?: string;
    slug?: { current?: string };
  }>(request, secret);
  if (!isValidSignature)
    return Response.json({ message: "Invalid signature." }, { status: 401 });

  // Bust the shared "posts" tag (listings + per-locale slug queries).
  revalidateTag("posts", "max");

  if (body?._type === "post" && body.slug?.current) {
    // Tag is keyed on slug; one language's publish busts both locales' cached
    // fetch for that slug (the other locale's query won't match this slug, but
    // the tag is shared so it's a cheap over-bust).
    revalidateTag(`post:${body.slug.current}`, "max");
    // Revalidate the published slug under every locale prefix (the doc exists
    // in exactly one locale, but we don't know which from the webhook body).
    for (const locale of locales) {
      revalidatePath(`/${locale}/blog/${body.slug.current}`);
    }
  }

  // Revalidate listings + home for every locale (latest posts appear on home).
  for (const locale of locales) {
    revalidatePath(`/${locale}/blog`);
    revalidatePath(`/${locale}`);
  }

  return Response.json({ revalidated: true, now: Date.now() });
}
