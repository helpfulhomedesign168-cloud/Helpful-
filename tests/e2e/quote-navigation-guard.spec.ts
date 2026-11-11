import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

async function startQuote(page: import("@playwright/test").Page) {
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/quotes/new");
  await page.getByLabel("客戶姓名", { exact: false }).fill("導航守衛客戶");
  await page.getByLabel(/^聯絡電話/).fill("91234567");
  await page.getByLabel(/^WhatsApp電話/).fill("91234567");
  await page.getByLabel("工程地區", { exact: false }).selectOption("黃大仙");
  await page.getByLabel(/^屋苑／大廈/).fill("守衛苑");
  await page.getByLabel(/^樓層/).fill("8");
  await page.getByLabel(/^單位/).fill("A");
}

test("Step 1 點menu其他module會先問儲存草稿", async ({ page }) => {
  await startQuote(page);
  await page.getByRole("link", { name: "客戶", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "儲存草稿？" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/quotes\/new$/);
  await dialog.getByRole("button", { name: "儲存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await page.goto("/quotes?tab=draft");
  const row = page.locator("tbody tr").filter({ hasText: "導航守衛客戶" });
  await expect(row).toBeVisible();
  await row.locator("a.source-link").click();
  await expect(page).toHaveURL(/\/quotes\/.+\/edit\?step=1/);
  await expect(page.getByLabel("客戶姓名", { exact: false })).toHaveValue(
    "導航守衛客戶",
  );
});

test("Step 3 點menu其他module會保存Step 3草稿", async ({ page }) => {
  await startQuote(page);
  await page.getByRole("button", { name: "下一步", exact: true }).click();
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
  await page.getByRole("button", { name: /下一步：列印簽署/ }).click();
  await page.getByRole("link", { name: "客戶", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "儲存草稿？" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "儲存草稿", exact: true }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await page.goto("/quotes?tab=draft");
  const row = page.locator("tbody tr").filter({ hasText: "導航守衛客戶" });
  await expect(row).toBeVisible();
  await row.locator("a.source-link").click();
  await expect(page).toHaveURL(/\/quotes\/.+\/handoff$/);
  await expect(
    page.getByRole("heading", { name: "3. 列印簽署", exact: true }),
  ).toBeVisible();
});
