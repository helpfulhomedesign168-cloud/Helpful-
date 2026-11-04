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
    page.getByRole("heading", { name: "儀表板", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("統計月份")).toHaveValue("2026-10");
  await expect(page.locator(".accounting-kpi")).toHaveCount(7);
  await expect(page.getByText("本月營業額", { exact: true })).toBeVisible();
  await expect(page.getByText("MYOB 對接", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "營業額、工程支出及毛利趨勢圖" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "年", exact: true })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "星期", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "年", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "營業額、工程支出及毛利趨勢圖" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "月", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "營業單", exact: true, level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "查看全部營業單", exact: true }),
  ).toBeVisible();
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


test("營業單module可篩選年月、狀態及Sales", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "Vinson");
  await page
    .locator("nav")
    .getByRole("link", { name: "營業單", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "營業單", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("營業單年份")).toHaveValue("2026");
  await expect(page.getByLabel("營業單月份")).toHaveValue("10");
  await expect(page.locator(".business-order-table tbody tr").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "完成單", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "退單", exact: true }).click();
  await expect(page.getByText("本月未有退單", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "全部", exact: true }).click();
  await page.getByLabel("營業單月份").selectOption("09");
  await expect(page.getByText("本月未有退單", { exact: true })).toHaveCount(0);
  await page.getByLabel("營業單月份").selectOption("10");
  await page.getByLabel("營業單Sales").selectOption({ label: "文文B MM" });
  await expect(page.locator(".business-order-table tbody tr").first()).toContainText("文文B MM");
});
