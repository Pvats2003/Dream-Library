export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-bg">
      <main className="pt-safe flex min-h-dvh w-full max-w-md flex-col px-6">{children}</main>
    </div>
  );
}
