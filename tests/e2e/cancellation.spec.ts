import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("開單員建立退款個案，會計退款及扣回佣金", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  await page
    .locator("nav")
    .getByRole("link", { name: "提交報價", exact: true })
    .click();
  const quoteRow = page.locator("tbody tr").filter({ hasText: "王小虎" });
  await quoteRow.getByRole("button", { name: /已核對並開單/ }).click();
  await expect(page).toHaveURL(/\/invoices\//);
  await page
    .getByRole("button", { name: "建立退款個案", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "建立退款個案" });
  await dialog.getByLabel("退款原因").fill("客人取消工程");
  await dialog.getByRole("button", { name: "建立個案", exact: true }).click();
  await expect(page).toHaveURL(/\/cancellation-cases\//);
  const caseUrl = page.url();
  await expect(page.getByText("待會計處理", { exact: true })).toBeVisible();

  await switchRole(page, "會計");
  await page.goto(caseUrl);
  await page.getByLabel("退款金額").fill("3000");
  await page.getByLabel("扣減金額").fill("1200");
  await page
    .getByPlaceholder("例如：合約訂明沒收訂金、行政費")
    .fill("合約扣除行政費");
  await page.getByLabel("銀行名稱").fill("Demo Bank");
  await page.getByLabel("退款戶名").fill("王小虎");
  await page.getByLabel("退款戶口號碼").fill("123456789");
  await page.getByLabel("轉帳參考").fill("REFUND-001");
  const uploads = page.locator("input[type=file]");
  const pdf = {
    name: "credit-note.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nDemo Credit Note\n%%EOF"),
  };
  await uploads.nth(0).setInputFiles(pdf);
  await uploads.nth(1).setInputFiles({
    ...pdf,
    name: "credit-note-signed.pdf",
  });
  await uploads.nth(2).setInputFiles({
    ...pdf,
    name: "transfer-proof.pdf",
  });
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "完成銀行轉帳退款", exact: true })
    .click();
  await expect(page.getByText("已完成退款", { exact: true })).toBeVisible();
  await expect(page.getByText("佣金扣回", { exact: true })).toBeVisible();
});
