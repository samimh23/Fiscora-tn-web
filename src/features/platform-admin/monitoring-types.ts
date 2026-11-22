export interface AiFeatureUsage {
  feature: string;
  provider: string;
  model: string;
  calls: number;
  errors: number;
  fallbacks: number;
  retried: number;
  p50Ms: number;
  p95Ms: number;
  inputTokens: number;
  outputTokens: number;
  units: number;
  costUsd: number;
  lastCallAtUtc: string | null;
  lastProblemAtUtc: string | null;
}

export interface AiUsageReport {
  days: number;
  totals: { calls: number; problems: number; costUsd: number };
  features: AiFeatureUsage[];
  daily: Array<{
    date: string;
    calls: number;
    problems: number;
    costUsd: number;
  }>;
  assistant: {
    answers: number;
    likes: number;
    dislikes: number;
    comments: number;
    withoutSource: number;
    weekly: Array<{ week: string; likes: number; dislikes: number }>;
    organizations: Array<{
      organizationName: string;
      answers: number;
      dislikes: number;
    }>;
  };
}

export interface RatedAnswer {
  id: string;
  createdAtUtc: string | null;
  feedbackAtUtc: string | null;
  rating: number;
  comment: string | null;
  question: string;
  answer: string;
  sources: string[];
  modelName: string;
  organizationName: string;
  dossierName: string | null;
}

export interface CloudCostReport {
  provider: "azure" | "gcp";
  status: "OK" | "NOT_CONFIGURED" | "WAITING_FOR_EXPORT" | "ERROR";
  scope: string | null;
  currency: string | null;
  monthToDate: number | null;
  credits: number | null;
  lastMonth: number | null;
  monthlyBudget: number | null;
  byService: Array<{ name: string; project: string | null; cost: number }>;
  daily: Array<{ date: string; cost: number }>;
  refreshedAtUtc: string;
  message: string | null;
}

export interface CloudCosts {
  azure: CloudCostReport;
  gcp: CloudCostReport;
}
