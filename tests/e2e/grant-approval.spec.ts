import { expect, test } from "@playwright/test";

test("8萬資助單未批核顯示待政府批核，填批核結果後更新進度", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page.goto("/quotes/quote-ready-invoice");
  const number = (await page.locator("h1").first().innerText()).trim();
  await page.goto("/quotes?tab=submitted");
  await page.getByPlaceholder("搜尋報價編號、客戶或電話").fill(number);
  const initialRow = page.locator("tbody tr").filter({ hasText: number });
  await expect(initialRow).toContainText("待政府批核");
  await initialRow.locator("a.source-link").click();
  await expect(page.getByText("批核結果", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "更改訂單", exact: true }),
  ).toBeVisible();
  const save = page.getByRole("button", { name: "儲存", exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel("資助申請編號").fill("M24902103");
  await page.getByLabel("政府批核金額").fill("82000");
  await expect(save).toBeEnabled();
  await save.click();
  await page.goto("/quotes?tab=submitted");
  await page.getByPlaceholder("搜尋報價編號、客戶或電話").fill(number);
  const row = page.locator("tbody tr").filter({ hasText: number });
  await expect(row).toBeVisible();
  await expect(row).toContainText("工程未進行，待收足50%訂");
});
