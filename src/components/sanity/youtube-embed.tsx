"use client";

import { useState } from "react";

type YouTubeEmbedProps = { url: string; title: string; caption?: string };

function getVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    return parsed.searchParams.get("v") ?? parsed.pathname.split("/").pop();
  } catch {
    return null;
  }
}

export function YouTubeEmbed({ url, title, caption }: YouTubeEmbedProps) {
  const [active, setActive] = useState(false);
  const id = getVideoId(url);
  if (!id) return null;

  return (
    <figure className="youtube-embed">
      {active ? (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title}
        />
      ) : (
        <button
          className="youtube-poster"
          onClick={() => setActive(true)}
          type="button"
        >
          <span className="youtube-play" aria-hidden="true">
            ▶
          </span>
          <span>Play video</span>
        </button>
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
