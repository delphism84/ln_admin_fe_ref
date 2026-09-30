import type { Metadata } from 'next';
import './globals.css';
import DialogHost from '@/components/ui/DialogHost';

export const metadata: Metadata = {
  title: 'EMPECS CGMS 관리자',
  description: 'EMPECS CGMS 관리자 콘솔',
  robots: { index: false, follow: false },
};

// 첫 화면이 그려지기 전에 테마를 적용해 깜빡임을 막는다.
const themeScript = `(function(){try{var t=localStorage.getItem('empecs_admin_theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
