import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("直接開單員可以建立 Invoice，不需要報價單", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "直接開單員");
  await expect(page).toHaveURL(/\/quotes\/new\?direct=1$/);
  await expect(
    page.getByRole("heading", { name: "銷售員資料", exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("發票日期", { exact: true })).not.toHaveValue("");
  await expect(page.getByText("Sales備註", { exact: true })).toHaveCount(0);
  await page.getByLabel("客戶姓名", { exact: false }).fill("直開測試客戶");
  await page.getByLabel(/^聯絡電話/).fill("91234567");
  await page.getByLabel(/^WhatsApp電話/).fill("91234567");
  await page.getByLabel("工程地區", { exact: false }).selectOption("黃大仙");
  await page.getByLabel(/^屋苑／大廈/).fill("直開苑");
  await page.getByLabel(/^樓層/).fill("8");
  await page.getByLabel(/^單位/).fill("A");
  await page.getByRole("button", { name: /^下一步/ }).click();
  await page.getByRole("button", { name: "新增工程", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "新增工程項目" });
  await picker.getByPlaceholder("搜尋工程名稱").fill("廚房牆身/地台 清拆打鑿");
  await page
    .locator(".service-option")
    .filter({ hasText: "廚房牆身/地台 清拆打鑿" })
    .first()
    .click();
  const line = page.locator(".line-card").first();
  await line.getByLabel("闊度", { exact: false }).fill("10");
  await line.getByLabel("高度", { exact: false }).fill("2");
  await expect(page.getByText("訂單分類", { exact: true })).toHaveCount(0);
  await expect(page.getByText("全單折扣", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /下一步：預覽發票/ }).click();
  await expect(
    page.getByRole("heading", { name: "3. 確認發票", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("預覽發票", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("INVOICE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "8萬資助", exact: true }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: "匯出", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(statSync(downloadPath!).size).toBeGreaterThan(1000);
  await page.getByRole("button", { name: /確定建立發票/ }).click();
  await expect(page).toHaveURL(/\/invoices$/);
  const toast = page.getByText(/發票DINV\d+已建立/);
  await expect(toast).toBeVisible();
  const invoiceNumber = (await toast.innerText()).match(/DINV\d+/)?.[0];
  await expect(page.locator("tbody tr").first()).toContainText(
    invoiceNumber!,
  );
  await expect(page.locator("tbody tr").first()).toContainText("8萬");
});
