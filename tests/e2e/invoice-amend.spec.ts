import { expect, test } from "@playwright/test";

test("單據管理每張Invoice有修改單入口", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page
    .locator(".role-option")
    .filter({ hasText: "直接開單員" })
    .first()
    .click();
  await page.goto("/invoices");
  const row = page.locator(".invoice-list-table tbody tr").first();
  const invoiceNumber = (await row.locator("strong").first().innerText()).trim();
  await row.locator("td").nth(2).click();
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
  await page.goBack();
  await page.waitForTimeout(200);
  await expect(
    row.getByRole("button", { name: `修改${invoiceNumber}`, exact: true }),
  ).toBeVisible();
  await row
    .getByRole("button", { name: `修改${invoiceNumber}`, exact: true })
    .click();
  await expect(page).toHaveURL(/\/quotes\/[^/]+\/edit\?invoice=1$/);
  await expect(
    page.getByRole("heading", { name: "修改單", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "工程項目", exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "儲存修改", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "儲存修改", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices$/);
});
