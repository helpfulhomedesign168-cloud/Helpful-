import { expect, test } from "@playwright/test";

test("SuperAdmin報價查閱可按Team及Sales篩選", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page
    .locator("nav")
    .getByRole("link", { name: "報價查閱", exact: true })
    .click();
  await expect(page.getByLabel("報價Team")).toBeVisible();
  await expect(page.getByLabel("報價Sales")).toBeVisible();
  await expect(page.locator("thead")).toContainText("Sales");
  await page.getByLabel("報價Team").selectOption("B");
  await page.getByLabel("報價Sales").selectOption({ label: "嘉嘉B KK" });
  await expect(
    page.locator("tbody tr").filter({ hasText: "嘉嘉B KK" }).first(),
  ).toBeVisible();
});
