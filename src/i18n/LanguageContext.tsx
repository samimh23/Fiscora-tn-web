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
import { arabicAdditions, englishTranslations } from "./translations-en";

export type Language = "fr" | "ar" | "en";

// eslint-disable-next-line react-refresh/only-export-components
export const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

type LanguageContextValue = {
  language: Language;
  direction: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const STORAGE_KEY = "compta-tn-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

/** The interface is written in French; these map French to the others. */
const DICTIONARIES: Record<Exclude<Language, "fr">, Record<string, string>> = {
  ar: { ...arabicTranslations, ...arabicAdditions },
  en: englishTranslations,
};

/** Texts built from a fixed French start, e.g. "Bonjour Sami". */
const PREFIXES: Array<{ fr: string; ar: string; en: string }> = [
  { fr: "Bonjour ", ar: "مرحباً ", en: "Hello " },
  { fr: "Motif : ", ar: "السبب: ", en: "Reason: " },
  { fr: "Mois dernier : ", ar: "الشهر الماضي: ", en: "Last month: " },
  { fr: "Crédits : ", ar: "الأرصدة: ", en: "Credits: " },
  {
    fr: "Budget mensuel : ",
    ar: "الميزانية الشهرية: ",
    en: "Monthly budget: ",
  },
  { fr: "Données de ", ar: "بيانات الساعة ", en: "Data from " },
  {
    fr: "Aucun appel IA sur cette période. Suivi actif depuis le ",
    ar: "لا توجد استدعاءات في هذه الفترة. التتبع مفعّل منذ ",
    en: "No AI calls in this period. Tracking active since ",
  },
  {
    fr: "E-mail envoyé à ",
    ar: "تم إرسال البريد الإلكتروني إلى ",
    en: "Email sent to ",
  },
  { fr: "Ma journée, ", ar: "يومي، ", en: "My day, " },
  {
    fr: "Un seul écran pour savoir quoi traiter maintenant dans ",
    ar: "شاشة واحدة لمعرفة ما يجب معالجته الآن في ",
    en: "One screen to know what to handle now in ",
  },
  {
    fr: "Déclaration mensuelle — ",
    ar: "التصريح الشهري — ",
    en: "Monthly return — ",
  },
  {
    fr: "Déclaration CNSS trimestrielle — ",
    ar: "التصريح الفصلي للصندوق الوطني للضمان الاجتماعي — ",
    en: "Quarterly CNSS return — ",
  },
];

/** Texts with a number inside, e.g. "+ 6 autre(s) source(s) consultée(s)". */
const PATTERNS: Array<{
  fr: RegExp;
  ar: string;
  en: string;
}> = [
  {
    fr: /^\+ (\d+) autre\(s\) source\(s\) consultée\(s\)$/,
    ar: "+ $1 مصادر أخرى تمت مراجعتها",
    en: "+ $1 more source(s) consulted",
  },
  { fr: /^Sur (\d+) jours$/, ar: "خلال $1 يومًا", en: "Over $1 days" },
  {
    fr: /^([\d\s]+) appels concernés$/,
    ar: "$1 استدعاءات معنية",
    en: "$1 calls affected",
  },
  { fr: /^(\d+) % utiles$/, ar: "$1 % مفيدة", en: "$1 % useful" },
  { fr: /^(\d+) réponses$/, ar: "$1 إجابة", en: "$1 answers" },
  { fr: /^(\d+) utiles$/, ar: "$1 مفيدة", en: "$1 useful" },
  { fr: /^(\d+) pas utiles$/, ar: "$1 غير مفيدة", en: "$1 not useful" },
  { fr: /^(\d+) commentaires$/, ar: "$1 تعليقات", en: "$1 comments" },
  { fr: /^(\d+) sans source$/, ar: "$1 بدون مصدر", en: "$1 without a source" },
];

function preserveWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

/** Translates a French interface text; anything unknown is left as it is. */
// eslint-disable-next-line react-refresh/only-export-components
export function translateFrench(value: string, language: Language) {
  if (language === "fr") return value;
  const text = value.trim();
  if (!text) return value;
  const translated = DICTIONARIES[language][text];
  if (translated) return preserveWhitespace(value, translated);
  for (const prefix of PREFIXES) {
    if (text.startsWith(prefix.fr)) {
      return preserveWhitespace(
        value,
        `${prefix[language]}${text.slice(prefix.fr.length)}`,
      );
    }
  }
  for (const pattern of PATTERNS) {
    if (pattern.fr.test(text)) {
      return preserveWhitespace(
        value,
        text.replace(pattern.fr, pattern[language]),
      );
    }
  }
  return value;
}

/**
 * Remembers each text's French original, so switching languages (or a React
 * re-render) never translates an already translated text a second time:
 * English "Balance" (for "Solde") must not become "Trial balance".
 */
const textSources = new WeakMap<Node, { source: string; output: string }>();
const attributeSources = new WeakMap<
  Element,
  Map<string, { source: string; output: string }>
>();

function localizeText(node: Text, language: Language) {
  const known = textSources.get(node);
  const source = known && known.output === node.data ? known.source : node.data;
  const next = translateFrench(source, language);
  if (next !== node.data) node.data = next;
  textSources.set(node, { source, output: next });
}

function localizeAttribute(
  element: Element,
  attribute: string,
  language: Language,
) {
  const value = element.getAttribute(attribute);
  if (!value) return;
  let known = attributeSources.get(element);
  if (!known) {
    known = new Map();
    attributeSources.set(element, known);
  }
  const previous = known.get(attribute);
  const source =
    previous && previous.output === value ? previous.source : value;
  const next = translateFrench(source, language);
  if (next !== value) element.setAttribute(attribute, next);
  known.set(attribute, { source, output: next });
}

function localizeElement(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, [data-i18n-ignore='true']"))
      continue;
    localizeText(node, language);
  }

  const elements =
    root instanceof Element
      ? [root, ...root.querySelectorAll("*")]
      : [...root.querySelectorAll("*")];
  for (const element of elements) {
    if (element.closest("[data-i18n-ignore='true']")) continue;
    for (const attribute of ["placeholder", "title", "aria-label", "alt"]) {
      localizeAttribute(element, attribute, language);
    }
  }
}

function savedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : "fr";
  } catch {
    return "fr";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(savedLanguage);
  const applying = useRef(false);
  const direction: "ltr" | "rtl" = language === "ar" ? "rtl" : "ltr";

  const setLanguage = useCallback((next: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
    setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(() => {
    const order: Language[] = ["fr", "ar", "en"];
    setLanguage(order[(order.indexOf(language) + 1) % order.length]);
  }, [language, setLanguage]);

  const t = useCallback(
    (text: string) => translateFrench(text, language),
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
            else if (node.parentNode)
              localizeElement(node.parentNode, language);
          }
        }
        applying.current = false;
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [direction, language]);

  const value = useMemo(
    () => ({ language, direction, setLanguage, toggleLanguage, t }),
    [direction, language, setLanguage, t, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value)
    throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
