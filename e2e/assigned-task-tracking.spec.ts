import { expect, test } from "@playwright/test";

for (const manager of [false, true]) {
  test(`${manager ? "manager" : "worker"} sees the server-scoped time tracking tasks`, async ({ page }) => {
    const organization = {
      id: "task-org", name: "Cabinet test", slug: "tasks",
      role: manager ? "Propriétaire" : "Collaborateur",
      permissions: ["tasks.view", "time_tracking.view", "time_tracking.manage", "dossiers.view",
        ...(manager ? ["tasks.assign", "tasks.validate", "time_tracking.approve"] : [])],
    };
    const user = { id: "worker-user", email: "worker@example.invalid", fullName: "Colab", isPlatformAdmin: false, mfaEnabled: false };
    const task = (id: string, title: string) => ({
      id, title, dossierId: "test-dossier", status: "EN_COURS", type: "FISCALE",
      checklist: [], checklistCompleted: 0, checklistTotal: 0,
    });
    await page.addInitScript(({ organization, user }) => {
      sessionStorage.setItem("compta-tn.session", JSON.stringify({
        accessToken: "mock", refreshToken: "mock", accessTokenExpiresAtUtc: "2099-01-01T00:00:00Z", user, organizations: [organization],
      }));
      localStorage.setItem("compta-tn.organization", organization.id);
    }, { organization, user });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith("/api/")) return route.continue();
      let body: unknown = [];
      if (path === "/api/auth/me") body = { ...user, organizations: [organization] };
      else if (path.endsWith("/dossiers")) body = { items: [{ id: "test-dossier", legalName: "Dossier test", status: "ACTIF" }], total: 1, page: 1, pageSize: 100 };
      else if (path.endsWith("/tasks")) {
        const items = [task("august", "Déclaration mensuelle — 08/2026"), ...(manager ? [task("july", "Déclaration mensuelle — 07/2026")] : [])];
        body = { items, total: items.length, page: 1, pageSize: 100 };
      } else if (path.endsWith("/work-sessions/active")) body = null;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto("/temps?dossierId=test-dossier");
    const notice = page.getByText(/Seules les tâches qui vous sont affectées sont proposées/);
    if (manager) await expect(notice).toHaveCount(0);
    else await expect(notice).toBeVisible();
    await page.getByRole("combobox", { name: "Tâche", exact: true }).click();
    await expect(page.getByRole("option", { name: "Déclaration mensuelle — 08/2026", exact: true })).toBeVisible();
    const other = page.getByRole("option", { name: "Déclaration mensuelle — 07/2026", exact: true });
    if (manager) await expect(other).toBeVisible();
    else await expect(other).toHaveCount(0);
  });
}
