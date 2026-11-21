import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DesignLab } from "@/components/dev/design-lab";
import { requireViewer } from "@/lib/session";
import { THEME_COOKIE, isThemePref } from "@/lib/theme";

export const metadata: Metadata = { title: "Design Lab", robots: { index: false, follow: false } };

export default async function DesignLabPage() {
  await requireViewer();
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return <DesignLab theme={isThemePref(theme) ? theme : "system"} />;
}
