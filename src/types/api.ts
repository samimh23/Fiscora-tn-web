export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  permissions: string[];
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  isActive?: boolean;
  isPlatformAdmin: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  user: CurrentUser;
  organizations: OrganizationSummary[];
}

export interface PlatformOverview {
  generatedAtUtc: string;
  totals: {
    organizationsTotal: number;
    organizationsActive: number;
    usersTotal: number;
    usersActive: number;
    platformAdmins: number;
    activeSessions: number;
    dossiersActive: number;
    documentsTotal: number;
    storageBytes: number;
    extractionsFailed: number;
    invitationsFailed: number;
    ttnFailed: number;
    ttnProductionConnections: number;
    subscriptionsPastDue: number;
    subscriptionInvoicesOverdue: number;
  };
  alerts: Array<{
    code: string;
    label: string;
    count: number;
    severity: "info" | "warning" | "error";
  }>;
  services: Array<{
    code: string;
    label: string;
    status: string;
    detail: string;
  }>;
}

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  suspendedAtUtc: string | null;
  suspensionReason: string | null;
  createdAtUtc: string;
  membersCount: number;
  dossiersCount: number;
  documentsCount: number;
  storageBytes: number;
  lastActivityAtUtc: string | null;
}

export interface PlatformUser {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  disabledAtUtc: string | null;
  disabledReason: string | null;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
  membershipsCount: number;
  activeSessionsCount: number;
}

export interface PlatformJobsOverview {
  generatedAtUtc: string;
  pipelines: Array<{
    code: "DOCUMENT_EXTRACTION" | "INVITATION_EMAIL" | "TTN_TRANSMISSION";
    label: string;
    pending: number;
    processing: number;
    failed: number;
    status: "OK" | "EN_COURS" | "ERREUR";
    lastFailureAtUtc: string | null;
  }>;
}

export interface PlatformAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAtUtc: string;
  actorUserId: string | null;
  actorName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  reason: string | null;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPriceTnd: number;
  annualPriceTnd: number;
  maxCollaborators: number;
  maxActiveDossiers: number;
  maxStorageBytes: number;
  maxStorageGb: number;
  monthlyOcrDocuments: number;
  monthlyTtnSubmissions: number;
  features: Record<string, boolean>;
  isActive: boolean;
  isPublic: boolean;
}

export interface SaasUsageMetric {
  used: number;
  limit: number;
  percentage: number;
  exceeded: boolean;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  organizationName: string;
  status: "ESSAI" | "ACTIF" | "IMPAYE" | "SUSPENDU" | "ANNULE";
  billingCycle: "MENSUEL" | "ANNUEL";
  trialEndsAtUtc: string | null;
  currentPeriodStartUtc: string;
  currentPeriodEndUtc: string;
  graceEndsAtUtc: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Pick<
    SaasPlan,
    "id" | "code" | "name" | "monthlyPriceTnd" | "annualPriceTnd"
  >;
  usage: {
    collaborators: SaasUsageMetric;
    activeDossiers: SaasUsageMetric;
    storageBytes: SaasUsageMetric;
    ocrDocuments: SaasUsageMetric;
    ttnSubmissions: SaasUsageMetric;
  };
  invoices?: SaasSubscriptionInvoice[];
}

export interface SaasSubscriptionInvoice {
  id: string;
  number: string;
  organizationId: string;
  organizationName: string;
  periodStartUtc: string;
  periodEndUtc: string;
  amountTnd: number;
  dueAtUtc: string;
  status: "BROUILLON" | "A_PAYER" | "PAYEE" | "ANNULEE";
  paidAtUtc: string | null;
  paymentReference: string | null;
  createdAtUtc: string;
}

export interface SaasAnalytics {
  generatedAtUtc: string;
  subscriptions: {
    trialing: number;
    active: number;
    pastDue: number;
    suspended: number;
    cancelled: number;
  };
  mrrTnd: number;
  arrTnd: number;
  averageRevenuePerActiveCabinetTnd: number;
  trialConversionRate: number;
  churnRate: number;
  collectedThisMonthTnd: number;
  overdueInvoices: number;
  overdueAmountTnd: number;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DossierSummary {
  id: string;
  organizationId?: string;
  legalName: string;
  tradeName: string | null;
  taxIdentifier: string | null;
  rneNumber?: string | null;
  vatCode?: string | null;
  customsCode?: string | null;
  legalForm: string;
  taxRegime: string;
  status: string;
  isVatSubject: boolean;
  hasVatSuspension?: boolean;
  isTotallyExporting?: boolean;
  activitySector?: string | null;
  cnssEmployerNumber?: string | null;
  employeeCount: number | null;
  fiscalYearStartMonth?: number;
  fiscalYearStartDay?: number;
  monthlyFee: string | null;
  annualFee?: string | null;
  billingFrequency?: string;
  internalNotes?: string | null;
  tags: string[];
  archivedAtUtc?: string | null;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

export interface DossierContact {
  id: string;
  fullName: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  whatsappNumber: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  role: string;
  isActive: boolean;
}

export interface DossierAssignment {
  id: string;
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  cabinetRole: string;
  assignmentRole: "RESPONSABLE" | "SUPPORT";
  isActive: boolean;
  monthlyTimeBudgetMinutes: number | null;
}

export interface WorkTask {
  id: string;
  dossierId: string;
  dossierName: string | null;
  title: string;
  dueOn: string;
  priority: string;
  status: string;
  isOverdue: boolean;
  assigneeName: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  checklist: TaskChecklistItem[];
  description: string | null;
  obligationId: string | null;
  type: string;
  assigneeMembershipId: string | null;
  lastComment: string | null;
  completedAtUtc: string | null;
}

export interface TaskChecklistItem {
  id: string;
  label: string;
  position: number;
  isCompleted: boolean;
  completedAtUtc: string | null;
}

export interface TaskComment {
  id: string;
  body: string;
  authorUserId: string;
  authorName?: string;
  createdAtUtc: string;
  isClientVisible?: boolean;
}

export interface FiscalObligation {
  id: string;
  templateId: string;
  code: string;
  name: string;
  frequency: string;
  periodYear: number;
  periodMonth: number | null;
  periodQuarter: number | null;
  periodStartsOn: string;
  periodEndsOn: string;
  dueOn: string;
  status: string;
  isLate: boolean;
  assignedMembershipId: string | null;
  validatedAtUtc: string | null;
  filedAtUtc: string | null;
  amountDue: string | null;
  amountPaid: string | null;
  paymentReference: string | null;
  notes: string | null;
  lastComment: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
}

export interface AccountingDocument {
  id: string;
  dossierId: string;
  taskId: string | null;
  obligationId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  category: string;
  periodYear: number | null;
  periodMonth: number | null;
  processingStatus: "A_TRAITER" | "TRAITE";
  extractionStatus: string;
  extractedData: unknown;
  version: number;
  replacesDocumentId: string | null;
  createdAtUtc: string;
  isClientVisible: boolean;
  malwareScanStatus: "NON_ANALYSE" | "SAIN" | "INFECTE" | "ERREUR";
  malwareSignature: string | null;
  malwareScannedAtUtc: string | null;
}

export interface DocumentPreview {
  originalName: string;
  mimeType: string;
  kind: "pdf" | "image" | "text" | "spreadsheet" | "unsupported";
  url?: string;
  content?: string;
  truncated?: boolean;
  message?: string;
  sheets?: Array<{
    name: string;
    rows: Array<Array<string | number | boolean | null>>;
    truncated: boolean;
  }>;
}

export interface MissingDocumentExpectation {
  id: string;
  organizationId: string;
  dossierId: string;
  periodYear: number;
  periodMonth: number;
  label: string;
  category: string;
  receivedDocumentId: string | null;
}

export interface BillingSummary {
  billed: string;
  paid: string;
  outstanding: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  readAtUtc: string | null;
  createdAtUtc: string;
}

export interface ProfitabilitySummary {
  totals: {
    approvedHours: string;
    billedRevenueNet: string;
    collectedRevenueNet: string;
    allocatedEmployerCost: string;
    marginOnBilled: string;
    marginOnCollected: string;
  };
}

export interface LedgerAccount {
  id: string;
  dossierId: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  normalBalance: string;
  parentAccountId: string | null;
  allowsPosting: boolean;
  isActive: boolean;
}

export interface AccountingJournal {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface ThirdParty {
  id: string;
  type: "CLIENT" | "FOURNISSEUR" | "CLIENT_ET_FOURNISSEUR";
  name: string;
  taxIdentifier: string | null;
  rneNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  receivableAccountId: string | null;
  payableAccountId: string | null;
  receivableBalance: string;
  payableBalance: string;
  isActive: boolean;
}

export interface BusinessInvoiceLine {
  id?: string;
  accountId: string;
  account?: LedgerAccount;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  vatCode: string | null;
  vatRate: string;
  netAmount?: string;
  vatAmount?: string;
  grossAmount?: string;
}

export interface CommercialDocumentLine {
  id?: string;
  accountId: string | null;
  account?: LedgerAccount | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  vatCode: string | null;
  vatRate: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
}

export interface CommercialDocument {
  id: string;
  direction: "ACHAT" | "VENTE";
  kind: "DEVIS" | "COMMANDE" | "BON_LIVRAISON" | "BON_RECEPTION";
  status: "BROUILLON" | "CONFIRME" | "CONVERTI" | "ANNULE";
  number: string;
  issueDate: string;
  validUntil: string | null;
  thirdPartyId: string;
  thirdParty: ThirdParty;
  currencyCode: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  sourceDocumentId: string | null;
  convertedToDocumentId: string | null;
  businessInvoiceId: string | null;
  notes: string | null;
  lines: CommercialDocumentLine[];
}

export interface BusinessInvoice {
  id: string;
  type: "ACHAT" | "VENTE";
  nature: "BIENS" | "SERVICES" | "MIXTE";
  kind: "FACTURE" | "AVOIR";
  number: string;
  invoiceDate: string;
  dueDate: string | null;
  thirdPartyId: string | null;
  thirdPartyName: string;
  thirdPartyTaxIdentifier: string | null;
  originalInvoiceId: string | null;
  journalId: string;
  journal: AccountingJournal;
  thirdPartyAccountId: string;
  thirdPartyAccount: LedgerAccount;
  vatAccountId: string | null;
  stampAccountId: string | null;
  withholdingAccountId: string | null;
  netAmount: string;
  vatAmount: string;
  stampDuty: string;
  withholdingBase: string;
  withholdingRate: string | null;
  withholdingAmount: string;
  grossAmount: string;
  netPayable: string;
  paidAmount: string;
  creditedAmount: string;
  outstandingAmount: string;
  settlementStatus: "NON_REGLEE" | "PARTIELLEMENT_REGLEE" | "REGLEE";
  status: "BROUILLON" | "VALIDEE" | "COMPTABILISEE" | "ANNULEE";
  sourceDocumentId: string | null;
  sourceCommercialDocumentId: string | null;
  journalEntryId: string | null;
  notes: string | null;
  lines: BusinessInvoiceLine[];
}

export interface PaymentAllocation {
  id: string;
  invoiceId: string;
  amount: string;
  invoice: BusinessInvoice;
}

export interface ThirdPartyPayment {
  id: string;
  thirdPartyId: string;
  thirdParty: ThirdParty;
  direction: "ENCAISSEMENT" | "DECAISSEMENT";
  paymentDate: string;
  amount: string;
  method: string;
  reference: string | null;
  journalId: string;
  cashAccountId: string;
  thirdPartyAccountId: string;
  status: "BROUILLON" | "COMPTABILISE" | "ANNULE";
  allocations: PaymentAllocation[];
}

export interface FiscalVatRate {
  id: string;
  code: string;
  label: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface FiscalWithholdingRate {
  id: string;
  natureCode: string;
  label: string;
  rate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  account: LedgerAccount;
  label: string;
  debit: string;
  credit: string;
  thirdPartyName: string | null;
  reconciliationId: string | null;
  letterCode: string | null;
  reconciledAtUtc: string | null;
}

export interface JournalEntry {
  id: string;
  journalId: string;
  journal: AccountingJournal;
  entryDate: string;
  pieceReference: string;
  description: string;
  status: "BROUILLON" | "A_VALIDER" | "REJETEE" | "COMPTABILISEE" | "EXTOURNEE";
  totalDebit: string;
  totalCredit: string;
  sourceDocumentId: string | null;
  postedAtUtc: string | null;
  submittedAtUtc: string | null;
  reviewedAtUtc: string | null;
  reviewComment: string | null;
  reversalEntryId: string | null;
  lines: JournalEntryLine[];
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export interface GeneralLedgerRow {
  entryId: string;
  lineId: string;
  entryDate: string;
  journalCode: string;
  pieceReference: string;
  accountCode: string;
  accountName: string;
  label: string;
  debit: string;
  credit: string;
  thirdPartyName: string | null;
  sourceDocumentId: string | null;
  status: string;
  letterCode: string | null;
  reconciliationId: string | null;
}

export interface AccountReconciliation {
  id: string;
  accountId: string;
  account: LedgerAccount;
  code: string;
  reconciliationDate: string;
  totalDebit: string;
  totalCredit: string;
  lines: Array<JournalEntryLine & { entry: JournalEntry }>;
}

export interface AgedBalanceRow {
  thirdPartyName: string;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export interface FinancialSummary {
  assets: string;
  liabilities: string;
  equity: string;
  revenue: string;
  expenses: string;
  netResult: string;
}

export interface MonthlyTaxDeclaration {
  id: string;
  periodYear: number;
  periodMonth: number;
  vatCollected: string;
  vatDeductible: string;
  vatCreditPrevious: string;
  vatDue: string;
  vatCreditNext: string;
  withholdingTax: string;
  withholdingBase: string | null;
  withholdingNature: string | null;
  withholdingRate: string | null;
  tfpBase: string;
  tfpRate: string;
  tfpDue: string;
  foprolosBase: string;
  foprolosRate: string;
  foprolosDue: string;
  tclBase: string;
  tclRate: string;
  tclDue: string;
  stampDuty: string;
  totalDue: string;
  status:
    "BROUILLON" | "PRETE_POUR_REVISION" | "REJETEE" | "VALIDEE" | "DEPOSEE";
  calculationMode: "AUTOMATIQUE" | "AJUSTEE";
  adjustmentReason: string | null;
  sourceSnapshot: DeclarationSourceSnapshot | null;
  checksJson: DeclarationChecks | null;
  parameterSnapshot: Record<string, unknown> | null;
  snapshotJson: Record<string, unknown> | null;
  reviewedAtUtc: string | null;
  reviewComment: string | null;
  validatedAtUtc: string | null;
  filedAtUtc: string | null;
  filingReference: string | null;
  receiptDocumentId: string | null;
  receiptDocument?: AccountingDocument | null;
}

export interface DeclarationCheck {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
}

export interface DeclarationChecks {
  blockingCount: number;
  warningCount: number;
  items: DeclarationCheck[];
}

export interface DeclarationSourceSnapshot {
  fingerprint: string;
  generatedAtUtc: string;
  period: {
    periodYear: number;
    periodMonth: number;
    startsOn: string;
    endsOn: string;
  };
  invoiceIds: string[];
  payrollRunId: string | null;
  summary: {
    postedInvoiceCount: number;
    unpostedInvoiceCount: number;
    salesNet: string;
    purchaseNet: string;
    payrollGross: string;
    salaryWithholding: string;
    purchaseWithholding: string;
    withholdingCredit: string;
  };
  vatByRate: Array<{
    code: string;
    rate: string;
    collected: string;
    deductible: string;
  }>;
  withholdingByNature: Array<{ nature: string; amount: string }>;
}

export interface MonthlyDeclarationCalculation {
  input: {
    periodYear: number;
    periodMonth: number;
    vatCollected: string;
    vatDeductible: string;
    vatCreditPrevious: string;
    withholdingTax: string;
    tfpBase: string;
    foprolosBase: string;
    tclBase: string;
    stampDuty: string;
  };
  calculated: Omit<
    MonthlyTaxDeclaration,
    | "id"
    | "status"
    | "calculationMode"
    | "adjustmentReason"
    | "sourceSnapshot"
    | "checksJson"
    | "snapshotJson"
    | "reviewedAtUtc"
    | "reviewComment"
    | "validatedAtUtc"
    | "filedAtUtc"
    | "filingReference"
    | "receiptDocumentId"
    | "receiptDocument"
  >;
  sourceSnapshot: DeclarationSourceSnapshot;
  checks: DeclarationChecks;
}

export interface AccountingPeriodReadiness {
  draftEntries: number;
  unpostedDepreciation: number;
  unreconciledStatements: number;
  ready: boolean;
}

export interface AccountingPeriod {
  id: string | null;
  periodYear: number;
  periodMonth: number;
  startsOn: string;
  endsOn: string;
  status: "OUVERTE" | "VERROUILLEE" | "CLOTUREE";
  lockedAtUtc: string | null;
  note: string | null;
  readiness: AccountingPeriodReadiness;
}

export interface AccountingYearReadiness extends AccountingPeriodReadiness {
  periodYear: number;
  startsOn: string;
  endsOn: string;
  requiredPeriods: number;
  unlockedPeriods: Array<{ year: number; month: number }>;
  existingClosing: AccountingYearClosing | null;
  ready: boolean;
}

export interface AccountingYearClosing {
  id: string;
  periodYear: number;
  startsOn: string;
  endsOn: string;
  status: "CLOTUREE";
  netResult: string;
  closedAtUtc: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  iban: string | null;
  ledgerAccountId: string;
  ledgerAccount: LedgerAccount;
  journalId: string;
  journal: AccountingJournal;
  currency: string;
  isActive: boolean;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  statementId: string;
  transactionDate: string;
  valueDate: string | null;
  description: string;
  reference: string | null;
  amount: string;
  balance: string | null;
  status: "NON_RAPPROCHEE" | "ECRITURE_BROUILLON" | "RAPPROCHEE";
  matchType:
    "AUTOMATIQUE" | "REGLEMENT" | "ECRITURE" | "ECRITURE_GENEREE" | null;
  matchConfidence: number | null;
  matchedPaymentId: string | null;
  matchedPayment: ThirdPartyPayment | null;
  journalEntryId: string | null;
  journalEntry: JournalEntry | null;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  bankAccount: BankAccount;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  bookClosingBalance: string | null;
  difference: string | null;
  currentBookClosingBalance?: string;
  currentDifference?: string;
  sourceFileName: string;
  rowCount: number;
  matchedCount?: number;
  unmatchedCount?: number;
  status:
    "IMPORTE" | "PARTIELLEMENT_RAPPROCHE" | "PRET_A_VALIDER" | "RAPPROCHE";
  reconciledAtUtc: string | null;
  transactions?: BankTransaction[];
}
