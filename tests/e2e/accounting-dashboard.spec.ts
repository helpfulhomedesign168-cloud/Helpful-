import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("會計主管Vinson可查看營運Dashboard及MYOB狀態", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "Vinson");
  await expect(page).toHaveURL(/\/accounting-dashboard$/);
  await expect(
    page.getByRole("heading", { name: "營運儀表板", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("統計月份")).toHaveValue("2026-10");
  await expect(page.locator(".accounting-kpi")).toHaveCount(7);
  await expect(page.getByText("本月營業額", { exact: true })).toBeVisible();
  await expect(page.getByText("MYOB 對接", { exact: true })).toBeVisible();
  await expect(page.getByText("未連接", { exact: true })).toBeVisible();
  expect(await page.locator(".accounting-job-table tbody tr").count()).toBeGreaterThan(0);
  await expect(page.locator(".accounting-sales-table")).toBeVisible();
});

test("普通開單員不可直接進入營運Dashboard", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/accounting-dashboard");
  await expect(page).toHaveURL(/\/submissions$/);
  await expect(
    page.getByRole("heading", { name: "提交報價", exact: true }),
  ).toBeVisible();
});
