import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { BUILD_SHA, shortSha } from "@/lib/version";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Read on the server: the shell is a client component and would otherwise
  // have no access to the image's build args.
  return (
    <AppShell
      userName={session?.user?.name}
      version={shortSha()}
      versionTitle={BUILD_SHA}
    >
      {children}
    </AppShell>
  );
}
