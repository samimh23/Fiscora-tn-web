import { expect, test } from "@playwright/test";

test.describe("staging public smoke checks", () => {
  test("serves the login route and its essential controls", async ({ page }) => {
    const response = await page.goto("/connexion");

    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("recovers the application after a direct-route refresh", async ({ page }) => {
    await page.goto("/connexion");
    await page.reload();

    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByText("Unexpected Application Error")).toHaveCount(0);
  });

  test("loads without broken scripts or stylesheets", async ({ page }) => {
    const failedRequests: string[] = [];
    const failedResponses: string[] = [];

    page.on("requestfailed", (request) => {
      if (["script", "stylesheet"].includes(request.resourceType())) {
        failedRequests.push(request.url());
      }
    });
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        ["script", "stylesheet"].includes(response.request().resourceType())
      ) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto("/connexion");
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();

    expect(failedRequests).toEqual([]);
    expect(failedResponses).toEqual([]);
  });
});
