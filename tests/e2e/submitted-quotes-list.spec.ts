import { expect, test } from "@playwright/test";

test("已提交列表有排序、訂金比率、進度及整行入口", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.goto("/quotes?tab=submitted");
  await expect(page.getByLabel("報價排序")).toHaveValue("newest");
  await expect(page.getByText("訂金比率", { exact: true })).toBeVisible();
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toContainText("%");
  await expect(firstRow).toContainText("工程未進行，待收足50%訂");
  await expect(firstRow.getByRole("button")).toHaveCount(0);
  const rows = page.locator("tbody tr");
  await expect(rows.nth(1)).toContainText("50%");
  await expect(rows.nth(2)).toContainText("100%");
  await expect(rows.nth(2)).toContainText("工程進行中，待完工");
  await expect(rows.nth(1)).toContainText("SHMM");
  await expect(rows.nth(2)).toContainText("SHMM");
  await expect(firstRow).not.toContainText("SHMM");
  const number = (await firstRow.locator("a.source-link").innerText()).trim();
  await firstRow.locator("td").nth(2).click();
  await expect(page).toHaveURL(/\/quotes\/quote-/);
  await expect(
    page.getByRole("heading", { name: number, exact: true }),
  ).toBeVisible();
});
