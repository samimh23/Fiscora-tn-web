import { useState } from "react";
import { Button, Menu, MenuItem, Tooltip } from "@mui/material";
import { CheckOutlined, LanguageOutlined } from "@mui/icons-material";
import { LANGUAGES, useLanguage } from "../i18n/LanguageContext";

export function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = LANGUAGES.find((item) => item.code === language);
  return (
    <>
      <Tooltip title={t("Changer la langue")}>
        <Button
          onClick={(event) => setAnchor(event.currentTarget)}
          startIcon={<LanguageOutlined />}
          aria-label={t("Changer la langue")}
          aria-haspopup="menu"
          aria-expanded={anchor ? "true" : undefined}
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
          <span data-i18n-ignore="true">{current?.label}</span>
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {LANGUAGES.map((item) => (
          <MenuItem
            key={item.code}
            selected={item.code === language}
            onClick={() => {
              setLanguage(item.code);
              setAnchor(null);
            }}
            data-i18n-ignore="true"
            lang={item.code}
            dir={item.code === "ar" ? "rtl" : "ltr"}
          >
            {item.label}
            {item.code === language && (
              <CheckOutlined fontSize="small" sx={{ ml: 1 }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
