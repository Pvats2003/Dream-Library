import { Toaster } from "@/components/ui/toast";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      {children}
      <Toaster />
    </div>
  );
}
