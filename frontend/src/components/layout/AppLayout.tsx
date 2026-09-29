import type { ReactNode } from "react";
import { TopNav } from "./TopNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full overflow-x-hidden">
      <TopNav />
      {/* Translucent page-background art, sitting behind the form/content — not inside it. */}
      <img
        src="/genai-section-image.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-1/2 z-0 hidden w-[380px] -translate-x-1/2 -translate-y-[38%] opacity-15 select-none lg:block xl:w-[460px]"
      />
      <main className="animate-page-in relative z-10 mx-auto max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
