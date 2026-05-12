import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zad Workspace",
  description: "Coworking management for Zad Workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('zad-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
