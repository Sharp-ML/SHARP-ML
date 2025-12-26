import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Image to 3D — Transform Photos to 3D",
  description:
    "Convert any image into an interactive 3D scene using Apple's ml-sharp technology. Upload, transform, and explore in seconds.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/favicon-57x57.png", sizes: "57x57" },
      { url: "/favicon-60x60.png", sizes: "60x60" },
      { url: "/favicon-72x72.png", sizes: "72x72" },
      { url: "/favicon-76x76.png", sizes: "76x76" },
      { url: "/favicon-114x114.png", sizes: "114x114" },
      { url: "/favicon-120x120.png", sizes: "120x120" },
      { url: "/favicon-144x144.png", sizes: "144x144" },
      { url: "/favicon-152x152.png", sizes: "152x152" },
      { url: "/favicon-180x180.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    title: "Image to 3D — Transform Photos to 3D",
    description:
      "Convert any image into an interactive 3D scene using Apple's ml-sharp technology. Upload, transform, and explore in seconds.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Image to 3D - Transform any photo into an interactive 3D scene",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Image to 3D — Transform Photos to 3D",
    description:
      "Convert any image into an interactive 3D scene using Apple's ml-sharp technology. Upload, transform, and explore in seconds.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'system';
                  var isDark = theme === 'dark' || 
                    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="gradient-bg" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
