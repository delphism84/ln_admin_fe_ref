import { AuthProvider } from '@/lib/auth';
import AdminShell from '@/components/layout/AdminShell';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
