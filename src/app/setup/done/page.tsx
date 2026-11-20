import { DoneStep } from "@/components/features/setup/done-step";
import { requireSetupAccess } from "@/lib/data/setup";

export default async function DonePage() {
  await requireSetupAccess();
  return <DoneStep />;
}
