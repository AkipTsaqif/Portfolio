import { parseBody } from "next-sanity/webhook";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

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

  revalidateTag("posts", "max");
  if (body?._type === "post" && body.slug?.current) {
    revalidateTag(`post:${body.slug.current}`, "max");
    revalidatePath(`/blog/${body.slug.current}`);
  }
  revalidatePath("/blog");
  revalidatePath("/");

  return Response.json({ revalidated: true, now: Date.now() });
}
