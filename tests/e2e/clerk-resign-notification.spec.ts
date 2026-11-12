import { expect, test } from "@playwright/test";

test("開單員改單後通知Sale重新簽署", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "開單員" }).first().click();
  await page.goto("/submissions");
  await page
    .locator(".submission-table tbody tr")
    .filter({ hasText: "QSHMM26100004" })
    .click();
  await expect(page).toHaveURL(/\/quotes\/quote-pending-office$/);
  await page.getByRole("button", { name: "更改訂單", exact: true }).click();
  await page.getByRole("button", { name: "儲存修改", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/quote-pending-office$/);
  const notify = page.getByRole("button", { name: "通知Sale", exact: true });
  await expect(notify).toBeVisible();
  await notify.click();
  await expect(
    page.getByRole("button", { name: "已通知Sale", exact: true }),
  ).toBeDisabled();

  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.getByRole("button", { name: "通知", exact: true }).click();
  const message = "報價單 QSHMM26100004 已有改動，需要客人再簽署。";
  const row = page.locator(".notification-row").filter({ hasText: message });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/\/quotes\/quote-pending-office$/);
  await expect(
    page.getByRole("button", { name: /上載已簽文件/ }),
  ).toBeVisible();
  await expect(page.getByText("簽署日期：", { exact: false })).toBeVisible();
});
