import {
  AdmitButton,
  AdmitProvider,
} from "@/components/features/admit/admit-provider";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { Toaster } from "@/components/ui/toast";
import { Sidebar } from "@/components/shell/sidebar";
import { TabBar } from "@/components/shell/tab-bar";
import { requireLibrary } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await requireLibrary();

  return (
    <AdmitProvider>
      <div className="flex min-h-dvh bg-bg">
        <Sidebar
          libraryName={membership.libraryName}
          city={membership.city}
          action={<AdmitButton variant="sidebar" />}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <OfflineBanner />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-safe pb-28 sm:px-6 lg:px-10 lg:pb-12">
            {children}
          </main>
        </div>
        <AdmitButton variant="fab" />
        <TabBar />
        <Toaster />
      </div>
    </AdmitProvider>
  );
}
