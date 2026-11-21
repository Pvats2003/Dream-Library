import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { JoinForm } from "@/components/features/join/join-form";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/dates";

export const metadata: Metadata = { title: "Join", robots: { index: false, follow: false } };

type Form = {
  library_name: string;
  city: string | null;
  shifts: { id: string; name: string; start_min: number; end_min: number; is_full_day: boolean }[];
};

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_join_form", { code });
  const form = data as Form | null;
  if (!form) {
    const t = await getTranslations("join");
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 grid size-14 place-items-center rounded-full bg-surface-2 text-text-3">
          <Link2Off className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">{t("badLinkTitle")}</h1>
        <p className="mt-2 text-base text-text-2">{t("badLinkBody")}</p>
      </main>
    );
  }
  return (
    <JoinForm
      code={code}
      libraryName={form.library_name}
      city={form.city}
      shifts={form.shifts.map((s) => ({ id: s.id, name: s.name, startMin: s.start_min, endMin: s.end_min }))}
      today={todayInTz()}
    />
  );
}
