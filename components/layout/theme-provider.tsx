"use client";

import {useState} from "react";
import {ThemeProvider as NextThemesProvider} from "next-themes";

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [isQr] = useState(() =>
    typeof document !== "undefined" && document.cookie.indexOf("qr_ref=1") !== -1,
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={isQr ? "light" : "system"}
      enableSystem={!isQr}
    >
      {children}
    </NextThemesProvider>
  );
}
