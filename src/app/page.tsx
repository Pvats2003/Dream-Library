import { redirect } from "next/navigation";
import { requireLibrary } from "@/lib/session";

export default async function Home() {
  await requireLibrary();
  redirect("/today");
}
