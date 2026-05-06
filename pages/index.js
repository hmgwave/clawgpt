import Link from "next/link";
import { Barlow_Condensed, Fraunces } from "next/font/google";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-barlow-condensed",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "700",
  style: "italic",
  variable: "--font-fraunces",
});

export default function Home() {
  return (
    <main
      className={`${barlowCondensed.variable} ${fraunces.variable} min-h-screen bg-[#0a1628] text-[#f5f0e6]`}
    >
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-[var(--font-barlow-condensed)] text-sm uppercase tracking-[0.45em] text-[#c9922a]">
          Aisymetry
        </p>
        <h1 className="font-[var(--font-fraunces)] text-5xl italic md:text-7xl">
          Onboarding experiments
        </h1>
        <Link
          className="font-barlow rounded-full border border-[#c9922a] px-6 py-3 text-sm font-bold uppercase tracking-[0.28em] text-[#f5f0e6] transition hover:shadow-[0_0_28px_rgba(201,146,42,0.45)]"
          href="/onboarding-v2"
        >
          Open onboarding v2
        </Link>
      </div>
    </main>
  );
}
