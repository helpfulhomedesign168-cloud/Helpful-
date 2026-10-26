import { test, expect } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("CS可讀已發工程部的Invoice與工程；開單員不可再直入工程查閱", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "工程CS");
  await page.goto("/documents/invoice/invoice-issued");
  await expect(
    page.getByRole("heading", { name: "工程Invoice", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SHMM26100001", { exact: true })).toBeVisible();
  await page.goto("/orders/workorder-issued");
  await expect(
    page.getByRole("heading", { name: "Demo 已開工程客戶的工程", exact: true }),
  ).toBeVisible();

  await switchRole(page, "開單員");
  await expect(
    page.getByRole("heading", { name: "提交報價", exact: true }),
  ).toBeVisible();
  await page.goto("/orders/workorder-issued");
  await expect(page).toHaveURL(/\/submissions$/);
  await expect(
    page.getByRole("heading", { name: "提交報價", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("報價詳情返回列表會回到目前Sales或會計工作區；開單員直入原Q會被導回提交報價", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "會計");
  await page.goto("/quotes/quote-pending-office");
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(page).toHaveURL(/\/finance$/);

  await switchRole(page, "開單員");
  await page.goto("/quotes/quote-pending-office");
  await expect(page).toHaveURL(/\/submissions$/);

  await switchRole(page, "文文B MM");
  await page.goto("/quotes/quote-draft-2");
  await page.getByRole("button", { name: "返回列表", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes$/);
});

test("開單員在提交報價頁核對Sales付款，分類前開單按鈕保持不可用", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  const row = page.locator("tbody tr").filter({ hasText: "Demo 待核款客戶" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "核對收款", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "核對這筆客戶收款" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Demo-1500", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "確認有效收款", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    row.getByRole("button", { name: /已核對並開單/ }),
  ).toBeDisabled();
  await expect(row.getByRole("combobox", { name: /分類/ })).toHaveValue("");
});
