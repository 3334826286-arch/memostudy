import { Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { LanguageProvider } from "@/components/language-provider";

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-display"
});

export const metadata = {
  title: "MemoStudy | AI Memory Learning Platform",
  description:
    "MemoStudy helps learners turn notes, textbooks, speeches, and vocabulary into structured study projects with memory optimization, active recall, and review tracking.",
  applicationName: "MemoStudy"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${notoSansSc.variable} ${spaceGrotesk.variable}`}>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
