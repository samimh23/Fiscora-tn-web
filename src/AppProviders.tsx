import { useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { createAppTheme } from "./theme";

function LocalizedTheme({ children }: { children: ReactNode }) {
  const { direction } = useLanguage();
  const theme = useMemo(() => createAppTheme(direction), [direction]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <LocalizedTheme>{children}</LocalizedTheme>
    </LanguageProvider>
  );
}
