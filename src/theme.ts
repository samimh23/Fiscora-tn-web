import { createTheme, type Direction } from "@mui/material/styles";

// Design tokens. Everything visual should come from here rather than being
// hardcoded per page, so density and hierarchy stay consistent across modules.
const ink = {
  900: "#16211d",
  700: "#3d4a45",
  500: "#5f6d67",
  400: "#7c8a84",
};
const line = "#e4e9e6";
const surfaceMuted = "#f7f9f8";

// Only four weights are allowed. The previous theme mixed 650/720/740/750/760/
// 800/850, which made every element compete for attention.
const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const;

export const createAppTheme = (direction: Direction) => {
  const rtl = direction === "rtl";
  const tracking = (value: string) => (rtl ? 0 : value);

  return createTheme({
    direction,
    palette: {
      mode: "light",
      primary: { main: "#17624c", dark: "#0f4436", light: "#e6f1ed" },
      secondary: { main: "#d97745" },
      background: { default: "#f6f7f5", paper: "#ffffff" },
      text: { primary: ink[900], secondary: ink[500], disabled: ink[400] },
      divider: line,
      success: { main: "#2f7d5d", light: "#eaf4ef" },
      warning: { main: "#c47a24", light: "#fbf2e4" },
      error: { main: "#bd4f4f", light: "#fbeded" },
      info: { main: "#2f6597", light: "#eaf1f8" },
      grey: { 50: surfaceMuted, 100: "#eef2f0", 200: line },
    },
    shape: { borderRadius: 12 },
    spacing: 8,
    typography: {
      fontFamily: rtl
        ? "Tahoma, Arial, sans-serif"
        : 'Inter, "Segoe UI", sans-serif',
      // Explicit scale so pages stop inventing their own font sizes.
      h1: {
        fontSize: 32,
        fontWeight: weight.bold,
        lineHeight: 1.2,
        letterSpacing: tracking("-0.022em"),
      },
      h2: {
        fontSize: 26,
        fontWeight: weight.bold,
        lineHeight: 1.25,
        letterSpacing: tracking("-0.018em"),
      },
      h3: {
        fontSize: 18,
        fontWeight: weight.semibold,
        lineHeight: 1.35,
        letterSpacing: tracking("-0.008em"),
      },
      h4: { fontSize: 16, fontWeight: weight.semibold, lineHeight: 1.4 },
      h5: { fontSize: 15, fontWeight: weight.semibold, lineHeight: 1.4 },
      h6: { fontSize: 14, fontWeight: weight.semibold, lineHeight: 1.4 },
      subtitle1: { fontSize: 15, fontWeight: weight.semibold },
      subtitle2: { fontSize: 13, fontWeight: weight.semibold },
      body1: { fontSize: 14.5, lineHeight: 1.55 },
      body2: { fontSize: 13.5, lineHeight: 1.5 },
      caption: { fontSize: 12.25, lineHeight: 1.45 },
      overline: {
        fontSize: 11,
        fontWeight: weight.semibold,
        letterSpacing: rtl ? 0 : "0.08em",
        lineHeight: 1.4,
      },
      button: {
        fontSize: 14,
        textTransform: "none",
        fontWeight: weight.semibold,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: "antialiased" },
          // Tables and wide content should scroll inside their own container
          // instead of pushing the page sideways.
          "::-webkit-scrollbar": { width: 10, height: 10 },
          "::-webkit-scrollbar-thumb": {
            background: "#d3dbd7",
            borderRadius: 8,
            border: "3px solid transparent",
            backgroundClip: "content-box",
          },
          "::-webkit-scrollbar-thumb:hover": { background: "#bcc7c2" },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            // Border only. Border + shadow together read as heavy and boxy.
            border: `1px solid ${line}`,
            boxShadow: "none",
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 20, "&:last-child": { paddingBottom: 20 } },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { boxShadow: "none", borderRadius: 9, minHeight: 38 },
          contained: { "&:hover": { boxShadow: "none" } },
          sizeSmall: { minHeight: 32, fontSize: 13 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: weight.semibold, borderRadius: 7 },
          sizeSmall: { height: 22, fontSize: 12 },
          outlined: { borderColor: line },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44 },
          indicator: { height: 2.5, borderRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            fontWeight: weight.semibold,
            fontSize: 14,
            textTransform: "none",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: line, fontSize: 13.5, paddingBlock: 11 },
          head: {
            fontSize: 12,
            fontWeight: weight.semibold,
            color: ink[500],
            backgroundColor: surfaceMuted,
            letterSpacing: rtl ? 0 : "0.02em",
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontSize: 13.5, alignItems: "center" },
        },
      },
      MuiSkeleton: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 9 },
          notchedOutline: { borderColor: line },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 9 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${line}`,
            boxShadow: "0 10px 32px rgba(18, 43, 34, 0.10)",
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: ink[900],
            fontSize: 12,
            fontWeight: weight.medium,
            borderRadius: 7,
            paddingBlock: 6,
          },
        },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: line } } },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 6, backgroundColor: "#e9eeeb" },
          bar: { borderRadius: 6 },
        },
      },
    },
  });
};
