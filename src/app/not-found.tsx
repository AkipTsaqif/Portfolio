import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell not-found">
      <p className="eyebrow">404 / Wrong turn</p>
      <h1>This path doesn&apos;t lead anywhere—yet.</h1>
      <p>The page may have moved, or perhaps it was never on the map.</p>
      <Link className="button-link" href="/">
        Return home <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
