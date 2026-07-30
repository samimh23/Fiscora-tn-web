import { createTheme, type Direction } from "@mui/material/styles";

export const createAppTheme = (direction: Direction) =>
  createTheme({
    direction,
    palette: {
      mode: "light",
      primary: { main: "#17624c", dark: "#0f4436", light: "#e6f1ed" },
      secondary: { main: "#d97745" },
      background: { default: "#f6f7f5", paper: "#ffffff" },
      text: { primary: "#18231f", secondary: "#66736d" },
      divider: "#e3e8e5",
      success: { main: "#2f7d5d" },
      warning: { main: "#c47a24" },
      error: { main: "#bd4f4f" },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily:
        direction === "rtl"
          ? "Tahoma, Arial, sans-serif"
          : 'Inter, "Segoe UI", sans-serif',
      h1: {
        fontWeight: 760,
        letterSpacing: direction === "rtl" ? 0 : "-0.025em",
      },
      h2: {
        fontWeight: 740,
        letterSpacing: direction === "rtl" ? 0 : "-0.02em",
      },
      h3: {
        fontWeight: 720,
        letterSpacing: direction === "rtl" ? 0 : "-0.012em",
      },
      button: { textTransform: "none", fontWeight: 700 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { boxShadow: "none", minHeight: 38, borderRadius: 9 },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: "1px solid #e3e8e5",
            boxShadow: "0 2px 10px rgba(20, 40, 32, 0.035)",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontSize: 12,
            fontWeight: 750,
            color: "#66736d",
            backgroundColor: "#f8faf8",
          },
          root: { borderColor: "#e8ece9" },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 650 } },
      },
    },
  });
