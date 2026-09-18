import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { getCurrentUser } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar credits={user.creditBalance} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">{children}</main>
    </div>
  );
}
