import Image from "next/image";
import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Guardian home">
      <span className="brand-mark" aria-hidden="true">
        <Image
          src="/brand/guardian-shield.jpg"
          alt=""
          width={48}
          height={48}
          sizes="48px"
          className="guardian-logo"
        />
      </span>
      <span>
        Guardian<span className="brand-ai"> AI</span>
        <small>DIGITAL BUSINESS GUARDIAN</small>
      </span>
    </Link>
  );
}
