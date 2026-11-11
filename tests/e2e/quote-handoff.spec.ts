import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Sales完成正式Step 3列印簽署及Step 4交Office", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/quotes/new");
  await page.getByLabel("客戶姓名", { exact: false }).fill("E2E Handoff");
  await page.getByLabel(/^聯絡電話/).fill("91234567");
  await page.getByLabel(/^WhatsApp電話/).fill("91234567");
  await page.getByLabel("工程地區", { exact: false }).selectOption("黃大仙");
  await page.getByLabel(/^屋苑／大廈/).fill("測試苑");
  await page.getByLabel(/^樓層/).fill("12");
  await page.getByLabel(/^單位/).fill("A");
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
  await line.getByLabel("長度", { exact: false }).fill("10");
  await line.getByLabel("闊度", { exact: false }).fill("2");
  await page
    .getByRole("button", { name: /下一步：列印簽署/ })
    .click();
  await expect(page).toHaveURL(/\/quotes\/.+\/handoff$/);
  await expect(
    page.getByRole("heading", { name: "3. 列印簽署", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "新訂單", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "加單", exact: true })).toBeVisible();
  await page.getByLabel("當日主管", { exact: false }).selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "準備列印報價單", exact: true })
    .click();
  await expect(page.getByText("正式報價號", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "4. 遞交office", exact: true }),
  ).toBeVisible();
  await page.getByLabel("上載已簽文件").setInputFiles({
    name: "signed.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 signed"),
  });
  await page
    .getByLabel("我確認客戶已簽署上述正式報價版本")
    .check();
  const sign = page.getByRole("button", { name: "確認客戶已簽", exact: true });
  await expect(sign).toBeEnabled();
  await sign.click();
  await expect(page.locator(".handoff-card").filter({ hasText: "1. 客戶簽署" })).toContainText("✓ 已完成");
  await page.getByLabel("上載付款記錄").setInputFiles({
    name: "payment.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("proof"),
  });
  const pay = page.getByRole("button", { name: "確認客戶付款", exact: true });
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(page.locator(".handoff-card").filter({ hasText: "2. 登記客戶付款" })).toContainText("✓ 已完成");
  const office = page.getByRole("button", { name: "提交Office", exact: true });
  await expect(office).toBeEnabled();
  await office.click();
  await expect(page.locator(".handoff-card").filter({ hasText: "3. 交Office跟進" })).toContainText("✓ 已完成");
});
