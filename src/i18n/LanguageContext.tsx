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
  { fr: /^Modifier ([A-Z0-9][\w\-/]*)$/, ar: "Modifier $1", en: "Edit $1" },
  {
    fr: /^Aperçu PDF de (.+?)$/,
    ar: "Aperçu PDF de $1",
    en: "PDF preview of $1",
  },
  { fr: /^(.+?) pièce\(s\)$/, ar: "$1 pièce(s)", en: "$1 document(s)" },
  { fr: /^Débit (.+?)$/, ar: "Débit $1", en: "Debit $1" },
  { fr: /^Crédit (.+?)$/, ar: "Crédit $1", en: "Credit $1" },
  { fr: /^(.+?)–(.+?) sur (.+?)$/, ar: "$1–$2 sur $3", en: "$1–$2 of $3" },
  {
    fr: /^(.+?) contrôle\(s\) restant\(s\)$/,
    ar: "$1 contrôle(s) restant(s)",
    en: "$1 check(s) remaining",
  },
  {
    fr: /^Clôturé · résultat (.+?)$/,
    ar: "Clôturé · résultat $1",
    en: "Closed · result $1",
  },
  {
    fr: /^Page localisée : (.+?)$/,
    ar: "Page localisée : $1",
    en: "Located page: $1",
  },
  {
    fr: /^L’extrait couvre les pages (.+?)\.$/,
    ar: "L’extrait couvre les pages $1.",
    en: "The excerpt covers pages $1.",
  },
  { fr: /^Clients \((.+?)\)$/, ar: "Clients ($1)", en: "Customers ($1)" },
  {
    fr: /^La somme des lignes HT \((.+?)\) diffère du total HT imprimé \((.+?)\)\. Les prix ont été conservés : vérifiez l’écart, sans modifier automatiquement les lignes\.$/,
    ar: "La somme des lignes HT ($1) diffère du total HT imprimé ($2). Les prix ont été conservés : vérifiez l’écart, sans modifier automatiquement les lignes.",
    en: "The sum of the net line amounts ($1) differs from the printed net total ($2). The prices were kept: check the difference; the lines are not changed automatically.",
  },
  {
    fr: /^Le taux de TVA absent de (.+?) a été déduit du montant total de TVA \((.+?) %\)\. Vérifiez ce taux avant d’enregistrer\.$/,
    ar: "Le taux de TVA absent de $1 a été déduit du montant total de TVA ($2 %). Vérifiez ce taux avant d’enregistrer.",
    en: "The VAT rate missing from $1 was derived from the total VAT amount ($2 %). Check this rate before saving.",
  },
  {
    fr: /^(.+?) — (.+?) — montant créditable (.+?)$/,
    ar: "$1 — $2 — montant créditable $3",
    en: "$1 — $2 — creditable amount $3",
  },
  {
    fr: /^La facture (.+?) est déjà liée à ce document\.$/,
    ar: "La facture $1 est déjà liée à ce document.",
    en: "Invoice $1 is already linked to this document.",
  },
  { fr: /^Numéro (.+?)$/, ar: "Numéro $1", en: "Number $1" },
  {
    fr: /^Le règlement original de (.+?) restera visible\. Ses affectations seront retirées des factures et son écriture sera extournée\. Tout rapprochement bancaire associé sera rouvert\.$/,
    ar: "Le règlement original de $1 restera visible. Ses affectations seront retirées des factures et son écriture sera extournée. Tout rapprochement bancaire associé sera rouvert.",
    en: "The original settlement of $1 will stay visible. Its allocations will be removed from the invoices and its entry will be reversed. Any linked bank reconciliation will be reopened.",
  },
  { fr: /^(.+?)\/(.+?) terminé$/, ar: "$1/$2 terminé", en: "$1/$2 completed" },
  {
    fr: /^Statut : (.+?)\. Les valeurs affichées sont les résultats sauvegardés après les éventuelles corrections\.$/,
    ar: "Statut : $1. Les valeurs affichées sont les résultats sauvegardés après les éventuelles corrections.",
    en: "Status: $1. The values shown are the results saved after any corrections.",
  },
  {
    fr: /^(.+?) reçu\(s\) du client$/,
    ar: "$1 reçu(s) du client",
    en: "$1 received from the client",
  },
  { fr: /^(.+?) à vérifier$/, ar: "$1 à vérifier", en: "$1 to review" },
  { fr: /^(.+?) à contrôler$/, ar: "$1 à contrôler", en: "$1 to check" },
  {
    fr: /^(.+?) point\(s\) à examiner$/,
    ar: "$1 point(s) à examiner",
    en: "$1 point(s) to examine",
  },
  {
    fr: /^Menace détectée : (.+?)$/,
    ar: "Menace détectée : $1",
    en: "Threat detected: $1",
  },
  { fr: /^· Échéance (.+?)$/, ar: "· Échéance $1", en: "· Due $1" },
  { fr: /^· expire le (.+?)$/, ar: "· expire le $1", en: "· expires on $1" },
  {
    fr: /^(.+?) fichier\(s\) sélectionné\(s\)$/,
    ar: "$1 fichier(s) sélectionné(s)",
    en: "$1 file(s) selected",
  },
  {
    fr: /^E-mail de test envoyé à (.+?)\.$/,
    ar: "E-mail de test envoyé à $1.",
    en: "Test email sent to $1.",
  },
  {
    fr: /^(.+?) réponse\(s\) 5xx$/,
    ar: "$1 réponse(s) 5xx",
    en: "$1 5xx response(s)",
  },
  { fr: /^sur (.+?)$/, ar: "sur $1", en: "of $1" },
  { fr: /^Actions pour (.+?)$/, ar: "Actions pour $1", en: "Actions for $1" },
  { fr: /^Échéance (.+?)$/, ar: "Échéance $1", en: "Due $1" },
  {
    fr: /^(.+?) action\(s\) à traiter dans cette file\.$/,
    ar: "$1 action(s) à traiter dans cette file.",
    en: "$1 action(s) to handle in this queue.",
  },
  {
    fr: /^Quel est le résumé financier pour (.+?) \?$/,
    ar: "Quel est le résumé financier pour $1 ?",
    en: "What is the financial summary for $1?",
  },
  {
    fr: /^(.+?) document\(s\) validé\(s\), (.+?) source\(s\) prête\(s\)\.$/,
    ar: "$1 document(s) validé(s), $2 source(s) prête(s).",
    en: "$1 validated document(s), $2 source(s) ready.",
  },
  {
    fr: /^Pièce demandée pour (.+?)\/(.+?)$/,
    ar: "Pièce demandée pour $1/$2",
    en: "Document requested for $1/$2",
  },
  { fr: /^(.+?) à régler$/, ar: "$1 à régler", en: "$1 to pay" },
  {
    fr: /^Déclaration (.+?)\/(.+?)$/,
    ar: "Déclaration $1/$2",
    en: "Declaration $1/$2",
  },
  {
    fr: /^Disponible pour votre prise de connaissance · Total (.+?)$/,
    ar: "Disponible pour votre prise de connaissance · Total $1",
    en: "Available for your acknowledgement · Total $1",
  },
  {
    fr: /^(.+?) fichier(.+?) sélectionné(.+?)$/,
    ar: "$1 fichier$2 sélectionné$3",
    en: "$1 file(s) selected",
  },
  { fr: /^· avant le (.+?)$/, ar: "· avant le $1", en: "· before $1" },
  {
    fr: /^États financiers (.+?)$/,
    ar: "États financiers $1",
    en: "Financial statements $1",
  },
  { fr: /^Équipe \((.+?)\)$/, ar: "Équipe ($1)", en: "Team ($1)" },
  { fr: /^Supprimer (.+?)$/, ar: "Supprimer $1", en: "Delete $1" },
  {
    fr: /^· (.+?) compte\(s\) à classer\.$/,
    ar: "· $1 compte(s) à classer.",
    en: "· $1 account(s) to classify.",
  },
  { fr: /^jusqu’au (.+?)$/, ar: "jusqu’au $1", en: "until $1" },
  {
    fr: /^Opérations \((.+?)\)$/,
    ar: "Opérations ($1)",
    en: "Operations ($1)",
  },
  {
    fr: /^(.+?) expire dans (.+?) jour\(s\)$/,
    ar: "$1 expire dans $2 jour(s)",
    en: "$1 expires in $2 day(s)",
  },
  {
    fr: /^Aide estimée : (.+?) TND$/,
    ar: "Aide estimée : $1 TND",
    en: "Estimated aid: $1 TND",
  },
  {
    fr: /^(.+?) devra se reconnecter sur tous ses appareils\. La session d’accès actuelle expirera normalement, mais aucun jeton ne pourra être renouvelé\.$/,
    ar: "$1 devra se reconnecter sur tous ses appareils. La session d’accès actuelle expirera normalement, mais aucun jeton ne pourra être renouvelé.",
    en: "$1 will have to sign in again on every device. The current access session will expire normally, but no token can be renewed.",
  },
  {
    fr: /^Les connexions de (.+?) ont été révoquées\.$/,
    ar: "Les connexions de $1 ont été révoquées.",
    en: "The sessions of $1 were revoked.",
  },
  {
    fr: /^(.+?) ne pourra plus accéder à ses dossiers\. Les données restent conservées\.$/,
    ar: "$1 ne pourra plus accéder à ses dossiers. Les données restent conservées.",
    en: "$1 will no longer be able to access its client files. The data is kept.",
  },
  {
    fr: /^(.+?) ne pourra plus se connecter et ses sessions seront révoquées\.$/,
    ar: "$1 ne pourra plus se connecter et ses sessions seront révoquées.",
    en: "$1 will no longer be able to sign in and their sessions will be revoked.",
  },
  {
    fr: /^(.+?) a été suspendu\.$/,
    ar: "$1 a été suspendu.",
    en: "$1 was suspended.",
  },
  {
    fr: /^(.+?) retrouvera son accès\. La raison de cette décision sera conservée dans le journal d’audit\.$/,
    ar: "$1 retrouvera son accès. La raison de cette décision sera conservée dans le journal d’audit.",
    en: "$1 will regain access. The reason for this decision will be kept in the audit log.",
  },
  {
    fr: /^(.+?) a été réactivé\.$/,
    ar: "$1 a été réactivé.",
    en: "$1 was re-enabled.",
  },
  {
    fr: /^(.+?) service\(s\) à vérifier$/,
    ar: "$1 service(s) à vérifier",
    en: "$1 service(s) to check",
  },
  { fr: /^Mis à jour (.+?)$/, ar: "Mis à jour $1", en: "Updated $1" },
  {
    fr: /^Lien valable jusqu’au (.+?)$/,
    ar: "Lien valable jusqu’au $1",
    en: "Link valid until $1",
  },
  {
    fr: /^Demandé avant le (.+?)$/,
    ar: "Demandé avant le $1",
    en: "Requested before $1",
  },
  {
    fr: /^(.+?) dossier\(s\) contrôlé\(s\)$/,
    ar: "$1 dossier(s) contrôlé(s)",
    en: "$1 client file(s) checked",
  },
  { fr: /^(.+?) \/ mois$/, ar: "$1 / mois", en: "$1 / month" },
  {
    fr: /^Invitation créée, mais l’e-mail n’a pas été envoyé : (.+?)$/,
    ar: "Invitation créée, mais l’e-mail n’a pas été envoyé : $1",
    en: "Invitation created, but the email was not sent: $1",
  },
  {
    fr: /^Saisie & validation \((\d+)\)$/,
    ar: "الإدخال والمصادقة ($1)",
    en: "Entry & validation ($1)",
  },
  { fr: /^Paramétrage \((\d+)\)$/, ar: "الإعدادات ($1)", en: "Settings ($1)" },
  { fr: /^Écart (.+)$/, ar: "فارق $1", en: "Difference $1" },
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
  // Document extraction review
  {
    fr: /^Cliquez dans un champ ou une ligne pour afficher sa source OCR confirmée \((\d+) zone\(s\) détectée\(s\)\)\.$/,
    ar: "انقر على حقل أو سطر لعرض مصدره المؤكَّد بالتعرّف الضوئي ($1 منطقة مكتشفة).",
    en: "Click a field or a line to show its confirmed OCR source ($1 zone(s) found).",
  },
  {
    fr: /^Lignes détectées \((\d+)\)$/,
    ar: "الأسطر المكتشفة ($1)",
    en: "Detected lines ($1)",
  },
  {
    fr: /^Opérations détectées \((\d+)\)$/,
    ar: "العمليات المكتشفة ($1)",
    en: "Detected transactions ($1)",
  },
  { fr: /^Ligne (\d+)$/, ar: "السطر $1", en: "Line $1" },
  { fr: /^Opération (\d+)$/, ar: "العملية $1", en: "Transaction $1" },
  { fr: /^Taxe (\d+)$/, ar: "الضريبة $1", en: "Tax $1" },
  {
    fr: /^La ligne (\d+) ne correspond pas à quantité × prix unitaire\.$/,
    ar: "السطر $1 لا يطابق الكمية × سعر الوحدة.",
    en: "Line $1 does not match quantity × unit price.",
  },
  {
    fr: /^La taxe complémentaire (\d+) ne peut pas être négative\.$/,
    ar: "الضريبة الإضافية $1 لا يمكن أن تكون سالبة.",
    en: "Additional tax $1 cannot be negative.",
  },
  {
    fr: /^Le montant de l’opération (\d+) est absent ou nul\.$/,
    ar: "مبلغ العملية $1 غائب أو منعدم.",
    en: "The amount of transaction $1 is missing or zero.",
  },
  {
    fr: /^La date de l’opération (\d+) est absente ou invalide\.$/,
    ar: "تاريخ العملية $1 غائب أو غير صالح.",
    en: "The date of transaction $1 is missing or invalid.",
  },
  {
    fr: /^Le libellé de l’opération (\d+) est absent\.$/,
    ar: "بيان العملية $1 غائب.",
    en: "The description of transaction $1 is missing.",
  },
  {
    fr: /^L’opération (\d+) contient simultanément un débit et un crédit\.$/,
    ar: "العملية $1 تحتوي على مدين ودائن في آن واحد.",
    en: "Transaction $1 has both a debit and a credit.",
  },
  {
    fr: /^L’opération (\d+) est hors de la période du relevé\.$/,
    ar: "العملية $1 خارج فترة الكشف.",
    en: "Transaction $1 is outside the statement period.",
  },
  {
    fr: /^Le solde final diffère du solde initial augmenté des opérations de (-?[\d.]+) TND\.$/,
    ar: "يختلف الرصيد النهائي عن الرصيد الافتتاحي مضافًا إليه العمليات بمقدار $1 دينار.",
    en: "The closing balance differs from the opening balance plus the transactions by $1 TND.",
  },
  {
    fr: /^La remise globale ne correspond pas à HT brut - base HT de (-?[\d.]+)\.$/,
    ar: "لا يطابق التخفيض الإجمالي الفرق بين المبلغ الخام والقاعدة دون اعتبار الأداءات بمقدار $1.",
    en: "The overall discount differs from gross excl. tax minus net excl. tax by $1.",
  },
  {
    fr: /^Le net à payer diffère du TTC après timbre de (-?[\d.]+)\.$/,
    ar: "يختلف الصافي للدفع عن المبلغ باعتبار الأداءات بعد الطابع بمقدار $1.",
    en: "The net payable differs from the total incl. tax after stamp duty by $1.",
  },
  {
    fr: /^Le total TTC ne correspond ni à la base HT \+ TVA \+ FODEC \+ autres taxes, ni à ce total avec timbre\. Écart minimal : (-?[\d.]+)\.$/,
    ar: "لا يطابق المجموع باعتبار الأداءات القاعدة + الأداء على القيمة المضافة + FODEC + الضرائب الأخرى، ولا هذا المجموع مع الطابع. أدنى فرق: $1.",
    en: "The total incl. tax matches neither net excl. tax + VAT + FODEC + other taxes, nor that total with stamp duty. Smallest gap: $1.",
  },
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
