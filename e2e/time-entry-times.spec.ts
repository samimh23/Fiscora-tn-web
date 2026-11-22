import { expect, test, type Page } from "@playwright/test";

const organization = {
  id: "time-org", name: "Cabinet test", slug: "time",
  role: "Propriétaire",
  permissions: ["tasks.view", "time_tracking.view", "time_tracking.manage", "time_tracking.approve", "dossiers.view"],
};
const user = { id: "owner-user", email: "owner@example.invalid", fullName: "Owner", isPlatformAdmin: false, mfaEnabled: false };

const entry = (overrides: Record<string, unknown>) => ({
  id: "entry", dossierId: "test-dossier", membershipId: "member", fullName: "Colab",
  taskId: null, taskTitle: null, workDate: "2026-09-14", durationMinutes: 30, durationHours: "0.50",
  source: "MANUEL", sourceSessionId: null, startedAtUtc: null, stoppedAtUtc: null,
  originalDurationMinutes: null, correctionReason: null, requiresReview: false, anomalyCode: null,
  billable: true, description: "Travail", status: "SOUMIS", submittedAtUtc: "2026-09-14T10:00:00Z",
  reviewedAtUtc: null, reviewedByUserId: null, reviewComment: null,
  ...overrides,
});

const entries = [
  // Timer from 09:12 to 10:05 Tunis time, then 5 min changed to 6 min.
  entry({
    id: "timer", source: "AUTOMATIQUE", sourceSessionId: "session",
    startedAtUtc: "2026-09-14T08:12:00Z", stoppedAtUtc: "2026-09-14T09:05:00Z",
    durationMinutes: 6, durationHours: "0.10", originalDurationMinutes: 5,
    correctionReason: "Appel client non chronométré", requiresReview: true, anomalyCode: "DUREE_CORRIGEE",
    description: "Révision des achats",
  }),
  entry({ id: "manual", requiresReview: true, anomalyCode: "SAISIE_MANUELLE", description: "Réunion au cabinet" }),
];

async function openTimeTracking(page: Page, language?: string) {
  await page.addInitScript(({ organization, user, language }) => {
    sessionStorage.setItem("compta-tn.session", JSON.stringify({
      accessToken: "mock", refreshToken: "mock", accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z", user, organizations: [organization],
    }));
    localStorage.setItem("compta-tn.organization", organization.id);
    if (language) localStorage.setItem("compta-tn-language", language);
  }, { organization, user, language });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let body: unknown = [];
    if (path === "/api/auth/me") body = { ...user, organizations: [organization] };
    else if (path.endsWith("/dossiers")) body = { items: [{ id: "test-dossier", legalName: "Dossier test", status: "ACTIF" }], total: 1, page: 1, pageSize: 100 };
    else if (path.endsWith("/tasks")) body = { items: [], total: 0, page: 1, pageSize: 100 };
    else if (path.endsWith("/work-sessions/active")) body = null;
    else if (path.endsWith("/time-entries")) body = entries;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/temps?dossierId=test-dossier");
}

test("owner sees when the timer ran, the original duration and the reason", async ({ page }) => {
  await openTimeTracking(page);
  const timerRow = page.getByRole("row").filter({ hasText: "Révision des achats" });
  await expect(timerRow.getByText("09:12 → 10:05", { exact: true })).toBeVisible();
  await expect(timerRow.getByText("5 min → 6 min", { exact: true })).toBeVisible();
  await expect(timerRow.getByText("Motif : Appel client non chronométré", { exact: true })).toBeVisible();

  const manualRow = page.getByRole("row").filter({ hasText: "Réunion au cabinet" });
  await expect(manualRow.getByText("Saisie sans chronomètre", { exact: true })).toBeVisible();
  await expect(manualRow.getByText(/→/)).toHaveCount(0);
});

test("the new time details are translated in English", async ({ page }) => {
  await openTimeTracking(page, "en");
  await expect(page.getByText("Entered without the timer", { exact: true })).toBeVisible();
  await expect(page.getByText("Reason: Appel client non chronométré", { exact: true })).toBeVisible();
});
