export type ExtractionMappingKind = "invoice" | "bank_statement";

export type ExtractionMappingTarget = {
  path: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

export type ExtractionCollectionMapping = {
  targetPath: "line_items" | "bank_statement.transactions";
  sourcePath: string;
  fields: Record<string, string>;
};

export type ExtractionMapping = {
  kind: ExtractionMappingKind;
  fields: Record<string, string>;
  collection: ExtractionCollectionMapping;
};

const mappingTemplateKey = (
  organizationId: string,
  kind: ExtractionMappingKind,
) => `fiscora:extraction-mapping:${organizationId}:${kind}`;

export const readExtractionMappingTemplate = (
  organizationId: string,
  kind: ExtractionMappingKind,
): ExtractionMapping | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(
      mappingTemplateKey(organizationId, kind),
    );
    if (!saved) return null;
    const parsed = JSON.parse(saved) as ExtractionMapping;
    return parsed?.kind === kind ? parsed : null;
  } catch {
    return null;
  }
};

export const saveExtractionMappingTemplate = (
  organizationId: string,
  mapping: ExtractionMapping,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    mappingTemplateKey(organizationId, mapping.kind),
    JSON.stringify(mapping),
  );
};

const invoiceTargets: ExtractionMappingTarget[] = [
  {
    path: "supplier.name",
    label: "Nom du fournisseur",
    required: true,
    aliases: ["supplier.name", "supplier_name", "vendor.name", "fournisseur.nom", "nom_fournisseur"],
  },
  {
    path: "supplier.tax_id",
    label: "Matricule fiscal fournisseur",
    aliases: ["supplier.tax_id", "supplier_tax_id", "vendor.tax_id", "fournisseur.matricule_fiscal", "mf_fournisseur"],
  },
  {
    path: "supplier.address",
    label: "Adresse du fournisseur",
    aliases: ["supplier.address", "supplier_address", "vendor.address", "fournisseur.adresse"],
  },
  {
    path: "customer.name",
    label: "Nom du client",
    aliases: ["customer.name", "customer_name", "client.nom", "nom_client"],
  },
  {
    path: "customer.tax_id",
    label: "Matricule fiscal client",
    aliases: ["customer.tax_id", "customer_tax_id", "client.matricule_fiscal", "mf_client"],
  },
  {
    path: "document_number",
    label: "Numéro du document",
    aliases: ["document_number", "invoice_number", "number", "numero", "numero_facture", "n_facture"],
  },
  {
    path: "issue_date",
    label: "Date d’émission",
    aliases: ["issue_date", "invoice_date", "date", "date_emission", "date_facture"],
  },
  {
    path: "currency",
    label: "Devise",
    aliases: ["currency", "currency_code", "devise", "monnaie"],
  },
  {
    path: "subtotal_excl_tax",
    label: "Montant HT",
    aliases: ["subtotal_excl_tax", "subtotal", "total_ht", "montant_ht", "base_tva"],
  },
  {
    path: "tax_amount",
    label: "Montant TVA",
    aliases: ["tax_amount", "vat_amount", "total_tva", "montant_tva", "tva"],
  },
  {
    path: "fodec_amount",
    label: "FODEC",
    aliases: ["fodec_amount", "fodec", "montant_fodec"],
  },
  {
    path: "stamp_tax",
    label: "Timbre fiscal",
    aliases: ["stamp_tax", "stamp_duty", "timbre", "timbre_fiscal"],
  },
  {
    path: "total_incl_tax",
    label: "Total TTC",
    aliases: ["total_incl_tax", "grand_total", "total_ttc", "montant_ttc", "total"],
  },
  {
    path: "amount_due",
    label: "Montant dû",
    aliases: ["amount_due", "net_payable", "net_a_payer", "montant_du", "reste_a_payer"],
  },
];

const bankTargets: ExtractionMappingTarget[] = [
  {
    path: "bank_statement.bank_name",
    label: "Banque",
    aliases: ["bank_statement.bank_name", "bank_name", "bank", "banque", "nom_banque"],
  },
  {
    path: "bank_statement.iban",
    label: "IBAN / RIB",
    aliases: ["bank_statement.iban", "iban", "rib", "bank_account.iban"],
  },
  {
    path: "bank_statement.account_number",
    label: "Numéro de compte",
    aliases: ["bank_statement.account_number", "account_number", "numero_compte", "n_compte"],
  },
  {
    path: "currency",
    label: "Devise",
    aliases: ["currency", "currency_code", "devise", "monnaie"],
  },
  {
    path: "bank_statement.period_start",
    label: "Début de période",
    required: true,
    aliases: ["bank_statement.period_start", "period_start", "start_date", "date_debut", "du"],
  },
  {
    path: "bank_statement.period_end",
    label: "Fin de période",
    required: true,
    aliases: ["bank_statement.period_end", "period_end", "end_date", "date_fin", "au"],
  },
  {
    path: "bank_statement.opening_balance",
    label: "Solde initial",
    required: true,
    aliases: ["bank_statement.opening_balance", "opening_balance", "initial_balance", "solde_initial", "solde_debut"],
  },
  {
    path: "bank_statement.closing_balance",
    label: "Solde final",
    required: true,
    aliases: ["bank_statement.closing_balance", "closing_balance", "final_balance", "solde_final", "nouveau_solde"],
  },
];

const invoiceRowTargets: ExtractionMappingTarget[] = [
  { path: "description", label: "Description", required: true, aliases: ["description", "designation", "libelle", "item", "article"] },
  { path: "quantity", label: "Quantité", aliases: ["quantity", "qty", "qte", "quantite"] },
  { path: "unit_price", label: "Prix unitaire", aliases: ["unit_price", "price", "prix_unitaire", "pu", "pu_ht", "pu_ttc"] },
  { path: "tax_rate", label: "Taux TVA", aliases: ["tax_rate", "vat_rate", "tva", "taux_tva"] },
  { path: "line_total", label: "Total ligne", aliases: ["line_total", "total", "amount", "montant", "total_ligne"] },
];

const bankRowTargets: ExtractionMappingTarget[] = [
  { path: "transaction_date", label: "Date", required: true, aliases: ["transaction_date", "date", "operation_date", "date_operation"] },
  { path: "value_date", label: "Date de valeur", aliases: ["value_date", "date_valeur", "valeur"] },
  { path: "description", label: "Libellé", required: true, aliases: ["description", "label", "libelle", "operation", "details"] },
  { path: "reference", label: "Référence", aliases: ["reference", "ref", "numero_piece"] },
  { path: "debit", label: "Débit", aliases: ["debit", "debit_amount", "montant_debit"] },
  { path: "credit", label: "Crédit", aliases: ["credit", "credit_amount", "montant_credit"] },
  { path: "amount", label: "Montant signé", aliases: ["amount", "montant", "net_amount"] },
  { path: "balance", label: "Solde", aliases: ["balance", "solde", "running_balance"] },
];

export const extractionMappingTargets = (kind: ExtractionMappingKind) =>
  kind === "bank_statement" ? bankTargets : invoiceTargets;

export const extractionRowTargets = (kind: ExtractionMappingKind) =>
  kind === "bank_statement" ? bankRowTargets : invoiceRowTargets;

export const readExtractionPath = (
  record: Record<string, unknown>,
  path: string,
): unknown =>
  path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current))
      return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);

const writeExtractionPath = (
  record: Record<string, unknown>,
  path: string,
  value: unknown,
) => {
  const keys = path.split(".");
  let cursor = record;
  keys.slice(0, -1).forEach((key) => {
    const child = cursor[key];
    if (!child || typeof child !== "object" || Array.isArray(child))
      cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  });
  cursor[keys[keys.length - 1]] = value;
};

const normalizedKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const scalarPathsFrom = (
  value: unknown,
  prefix: string,
  result: string[],
  depth: number,
) => {
  if (depth > 6 || Array.isArray(value)) return;
  if (!value || typeof value !== "object") {
    if (prefix) result.push(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>))
    scalarPathsFrom(child, prefix ? `${prefix}.${key}` : key, result, depth + 1);
};

export const extractionScalarPaths = (record: Record<string, unknown>) => {
  const result: string[] = [];
  scalarPathsFrom(record, "", result, 0);
  return [...new Set(result)].sort();
};

const collectionPathsFrom = (
  value: unknown,
  prefix: string,
  result: string[],
  depth: number,
) => {
  if (depth > 6) return;
  if (Array.isArray(value)) {
    if (
      prefix &&
      value.some(
        (item) => Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    )
      result.push(prefix);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>))
    collectionPathsFrom(
      child,
      prefix ? `${prefix}.${key}` : key,
      result,
      depth + 1,
    );
};

export const extractionCollectionPaths = (record: Record<string, unknown>) => {
  const result: string[] = [];
  collectionPathsFrom(record, "", result, 0);
  return [...new Set(result)].sort();
};

export const extractionCollectionFieldPaths = (
  record: Record<string, unknown>,
  collectionPath: string,
) => {
  const collection = readExtractionPath(record, collectionPath);
  if (!Array.isArray(collection)) return [];
  const fields = new Set<string>();
  collection.slice(0, 20).forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    extractionScalarPaths(row as Record<string, unknown>).forEach((path) =>
      fields.add(path),
    );
  });
  return [...fields].sort();
};

const suggestedPath = (
  paths: string[],
  target: ExtractionMappingTarget,
) => {
  const aliases = [target.path, ...target.aliases].map(normalizedKey);
  return (
    paths.find((path) => path === target.path) ??
    paths.find((path) => aliases.includes(normalizedKey(path))) ??
    paths.find((path) => {
      const segments = path.split(".");
      return aliases.includes(
        normalizedKey(segments[segments.length - 1] ?? path),
      );
    }) ??
    ""
  );
};

const suggestedCollection = (paths: string[], kind: ExtractionMappingKind) => {
  const aliases =
    kind === "bank_statement"
      ? ["bank_statement.transactions", "transactions", "operations", "mouvements"]
      : ["line_items", "items", "lines", "lignes", "articles", "details"];
  const normalizedAliases = aliases.map(normalizedKey);
  return (
    paths.find((path) => path === aliases[0]) ??
    paths.find((path) => normalizedAliases.includes(normalizedKey(path))) ??
    paths.find((path) => {
      const segments = path.split(".");
      return normalizedAliases.includes(
        normalizedKey(segments[segments.length - 1] ?? path),
      );
    }) ??
    ""
  );
};

export const buildExtractionMapping = (
  source: Record<string, unknown>,
  kind: ExtractionMappingKind,
  preferred?: ExtractionMapping | null,
): ExtractionMapping => {
  const scalarPaths = extractionScalarPaths(source);
  const fields = Object.fromEntries(
    extractionMappingTargets(kind).map((target) => {
      const saved = preferred?.fields[target.path];
      return [
        target.path,
        saved && scalarPaths.includes(saved)
          ? saved
          : suggestedPath(scalarPaths, target),
      ];
    }),
  );
  const collectionPaths = extractionCollectionPaths(source);
  const savedCollection = preferred?.collection.sourcePath;
  const sourcePath =
    savedCollection && collectionPaths.includes(savedCollection)
      ? savedCollection
      : suggestedCollection(collectionPaths, kind);
  const rowPaths = sourcePath
    ? extractionCollectionFieldPaths(source, sourcePath)
    : [];
  const rowFields = Object.fromEntries(
    extractionRowTargets(kind).map((target) => {
      const saved = preferred?.collection.fields[target.path];
      return [
        target.path,
        saved && rowPaths.includes(saved)
          ? saved
          : suggestedPath(rowPaths, target),
      ];
    }),
  );
  return {
    kind,
    fields,
    collection: {
      targetPath:
        kind === "bank_statement"
          ? "bank_statement.transactions"
          : "line_items",
      sourcePath,
      fields: rowFields,
    },
  };
};

export const applyExtractionMapping = (
  source: Record<string, unknown>,
  mapping: ExtractionMapping,
) => {
  const result = structuredClone(source);
  const originalType = readExtractionPath(source, "document_type");
  const documentType =
    mapping.kind === "bank_statement"
      ? "bank_statement"
      : ["invoice", "credit_note", "receipt"].includes(String(originalType))
        ? String(originalType)
        : "invoice";
  writeExtractionPath(result, "document_type", documentType);
  for (const [target, sourcePath] of Object.entries(mapping.fields)) {
    if (!sourcePath) continue;
    const value = readExtractionPath(source, sourcePath);
    if (value !== undefined) writeExtractionPath(result, target, value);
  }
  const rows = readExtractionPath(source, mapping.collection.sourcePath);
  if (Array.isArray(rows)) {
    const mappedRows = rows
      .filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row),
      )
      .map((row) => {
        const mapped: Record<string, unknown> = {};
        for (const [target, sourcePath] of Object.entries(
          mapping.collection.fields,
        ))
          mapped[target] = sourcePath
            ? (readExtractionPath(row, sourcePath) ?? null)
            : null;
        return mapped;
      });
    writeExtractionPath(result, mapping.collection.targetPath, mappedRows);
  }
  return result;
};
