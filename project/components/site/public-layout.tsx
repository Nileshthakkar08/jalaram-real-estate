import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { FloatingActions } from '@/components/site/floating-actions';
import { PushPrompt } from '@/components/site/push-prompt';
import { SettingsProvider } from '@/lib/settings-context';
import { serverApi } from '@/lib/server-api';

export async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await serverApi.settings();

  return (
    <SettingsProvider value={settings}>
      <Navbar />
      <main id="main" className="min-h-screen">{children}</main>
      <Footer settings={settings} />
      <FloatingActions />
      <PushPrompt />
    </SettingsProvider>
  );
}
