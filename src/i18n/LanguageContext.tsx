import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { arabicTranslations } from "./translations";

export type Language = "fr" | "ar";

type LanguageContextValue = {
  language: Language;
  direction: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const STORAGE_KEY = "compta-tn-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);
const frenchTranslations = Object.fromEntries(
  Object.entries(arabicTranslations).map(([fr, ar]) => [ar, fr]),
);

function preserveWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function translateValue(value: string, language: Language) {
  const text = value.trim();
  if (!text) return value;
  const dictionary = language === "ar" ? arabicTranslations : frenchTranslations;
  const translated = dictionary[text];
  if (translated) return preserveWhitespace(value, translated);

  if (language === "ar") {
    if (text.startsWith("Bonjour ")) {
      return preserveWhitespace(value, `مرحباً ${text.slice("Bonjour ".length)}`);
    }
    if (text.startsWith("E-mail envoyé à ")) {
      return preserveWhitespace(value, `تم إرسال البريد الإلكتروني إلى ${text.slice("E-mail envoyé à ".length)}`);
    }
  }
  return value;
}

function localizeElement(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, [data-i18n-ignore='true']")) continue;
    const next = translateValue(node.data, language);
    if (next !== node.data) node.data = next;
  }

  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    for (const attribute of ["placeholder", "title", "aria-label", "alt"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateValue(value, language);
      if (next !== value) element.setAttribute(attribute, next);
    }
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" ? "ar" : "fr";
  });
  const applying = useRef(false);
  const direction: "ltr" | "rtl" = language === "ar" ? "rtl" : "ltr";

  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(
    () => setLanguage(language === "fr" ? "ar" : "fr"),
    [language, setLanguage],
  );

  const t = useCallback(
    (text: string) => (language === "ar" ? arabicTranslations[text] ?? text : text),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
    localizeElement(document.body, language);

    const observer = new MutationObserver((mutations) => {
      if (applying.current) return;
      applying.current = true;
      queueMicrotask(() => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData" && mutation.target.parentNode) {
            localizeElement(mutation.target.parentNode, language);
          }
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) localizeElement(node, language);
            else if (node.parentNode) localizeElement(node.parentNode, language);
          }
        }
        applying.current = false;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [direction, language]);

  const value = useMemo(
    () => ({ language, direction, setLanguage, toggleLanguage, t }),
    [direction, language, setLanguage, t, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
