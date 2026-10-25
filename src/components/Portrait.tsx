import Image from "next/image";
import { withBasePath } from "@/lib/basePath";

export function Portrait({
  src,
  name,
  size = 64,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  if (!src) {
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <span
        aria-hidden="true"
        className="flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600"
        style={{ width: size, height: size, fontSize: size / 3 }}
      >
        {initials}
      </span>
    );
  }
  return (
    <Image
      src={withBasePath(src)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
