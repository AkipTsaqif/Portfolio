import Image from "next/image";
import type { SanityImage as SanityImageType } from "@/lib/sanity/types";
import { urlForImage } from "@/lib/sanity/image";

type SanityImageProps = {
  image: SanityImageType;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function SanityImage({
  image,
  className,
  priority = false,
  sizes = "100vw",
}: SanityImageProps) {
  const src = urlForImage(image)
    .width(1800)
    .fit("max")
    .auto("format")
    .quality(85)
    .url();

  return (
    <Image
      alt={image.alt ?? ""}
      className={className}
      fill
      priority={priority}
      sizes={sizes}
      src={src}
    />
  );
}
