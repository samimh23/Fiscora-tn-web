import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, signIn } from "./helpers";

const representativeRoutes = [
  { path: "/", heading: /Ma journée/ },
  { path: "/dossiers", heading: "Dossiers clients" },
  { path: "/honoraires", heading: "Honoraires clients" },
  { path: "/commerce-exterieur", heading: "Devises & commerce extérieur" },
];

test("reste utilisable sans débordement en français, en arabe et en anglais", async ({
  page,
}) => {
  await signIn(page);

  for (const route of representativeRoutes) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.getByRole("button", { name: "Changer la langue" }).click();
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveAttribute("dir", "rtl");
  await expectNoHorizontalOverflow(page);

  // English: left-to-right, translated navigation, still no overflow.
  await page.getByRole("button", { name: "تغيير اللغة" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("heading", { name: "Currencies & foreign trade" }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Back to French restores the original texts, not a double translation.
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("menuitem", { name: "Français" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(
    page.getByRole("heading", { name: "Devises & commerce extérieur" }).first(),
  ).toBeVisible();
});
