import { Button, Tooltip } from "@mui/material";
import { LanguageOutlined } from "@mui/icons-material";
import { useLanguage } from "../i18n/LanguageContext";

export function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const { language, toggleLanguage, t } = useLanguage();
  const label = language === "fr" ? "العربية" : "Français";
  return (
    <Tooltip title={t("Changer la langue")}>
      <Button
        onClick={toggleLanguage}
        startIcon={<LanguageOutlined />}
        aria-label={t("Changer la langue")}
        sx={{
          minWidth: 0,
          color: light ? "#fff" : "primary.main",
          borderColor: light ? "rgba(255,255,255,.32)" : "divider",
          bgcolor: light ? "rgba(255,255,255,.08)" : "transparent",
          whiteSpace: "nowrap",
        }}
        variant="outlined"
        size="small"
      >
        {label}
      </Button>
    </Tooltip>
  );
}
