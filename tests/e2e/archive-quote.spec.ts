import { expect, test } from "@playwright/test";

async function switchRoleToSales(page: import("@playwright/test").Page) {
  await page.locator(".actor-button").click();
  await page
    .locator(".role-option")
    .filter({ hasText: "文文B MM" })
    .first()
    .click();
}

test("Sales可封存未交Office草稿，並在封存列表查看不可再處理來源", async ({
  page,
}) => {
  await page.goto("/");
  await switchRoleToSales(page);
  await page.goto("/quotes/quote-draft-2");

  await expect(
    page.getByRole("button", { name: "封存報價", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "封存報價", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "封存這張報價？" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "封存原因", exact: true })
    .selectOption("no_follow_up");
  await dialog.getByRole("button", { name: "確認封存", exact: true }).click();

  await expect(page).toHaveURL(/\/quotes\?tab=archived/);
  const archivedRow = page
    .locator("tbody tr")
    .filter({ hasText: "QMM26100002" });
  await expect(archivedRow.getByText("已封存", { exact: true })).toBeVisible();
  await archivedRow
    .getByRole("link", { name: "QMM26100002", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "封存報價", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "修改報價", exact: true }),
  ).toHaveCount(0);
});
