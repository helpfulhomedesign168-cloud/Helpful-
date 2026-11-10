import { expect, test } from "@playwright/test";

test("Sales可預覽4步建立報價流程", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.goto("/design/quote");
  await expect(page.getByRole("heading", { name: "建立報價", exact: true })).toBeVisible();
  await expect(page.locator(".quote-wizard-step")).toHaveCount(4);
  await page.getByRole("button", { name: /下一步/ }).click();
  await expect(page.getByText("打拆工程", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /下一步/ }).click();
  await expect(page.getByText("列印報價單", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByText("報價單號碼：", { exact: false })).toBeVisible();
  const signButton = page.getByRole("button", { name: "確認客戶已簽", exact: true });
  const payButton = page.getByRole("button", { name: "確認客戶付款", exact: true });
  const officeButton = page.getByRole("button", { name: "提交Office", exact: true });
  await expect(signButton).toBeDisabled();
  await expect(payButton).toBeDisabled();
  await expect(officeButton).toBeDisabled();
  await page.getByLabel("上載已簽文件").setInputFiles({
    name: "signed-quote.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 signed"),
  });
  await expect(signButton).toBeEnabled();
  await signButton.click();
  await expect(
    page.locator(".quote-handoff-card").filter({ hasText: "1. 客戶簽署" }),
  ).toContainText("✓ 已完成");
  await page.getByLabel("上載付款記錄").setInputFiles({
    name: "payment.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("payment"),
  });
  await expect(payButton).toBeEnabled();
  await payButton.click();
  await expect(
    page.locator(".quote-handoff-card").filter({ hasText: "2. 登記客戶付款" }),
  ).toContainText("✓ 已完成");
  await expect(officeButton).toBeEnabled();
  await officeButton.click();
  await expect(
    page.locator(".quote-handoff-card").filter({ hasText: "3. 交Office跟進" }),
  ).toContainText("✓ 已完成");
});
