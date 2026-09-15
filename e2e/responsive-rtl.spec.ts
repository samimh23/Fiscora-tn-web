import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, signIn } from "./helpers";

const representativeRoutes = [
  { path: "/", heading: /Ma journée/ },
  { path: "/dossiers", heading: "Dossiers clients" },
  { path: "/honoraires", heading: "Honoraires clients" },
  { path: "/commerce-exterieur", heading: "Devises & commerce extérieur" },
];

test("reste utilisable sans débordement en français et en arabe", async ({
  page,
}) => {
  await signIn(page);

  for (const route of representativeRoutes) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.getByRole("button", { name: "Changer la langue" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveAttribute("dir", "rtl");
  await expectNoHorizontalOverflow(page);
});
