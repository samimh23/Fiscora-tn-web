import { useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { createAppTheme } from "./theme";
import { FeedbackProvider } from "./feedback/FeedbackProvider";

function LocalizedTheme({ children }: { children: ReactNode }) {
  const { direction } = useLanguage();
  const theme = useMemo(() => createAppTheme(direction), [direction]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <LocalizedTheme>
        <FeedbackProvider>{children}</FeedbackProvider>
      </LocalizedTheme>
    </LanguageProvider>
  );
}
