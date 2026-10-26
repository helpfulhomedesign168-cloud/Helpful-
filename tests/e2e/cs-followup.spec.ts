import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("CS主管可安排及更改跟進同事，普通CS只讀", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.goto("/handoff");

  await expect(
    page.getByRole("button", { name: "可安排工程", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "已發工程部", exact: true }),
  ).toHaveCount(0);

  const row = page.locator("tbody tr").filter({ hasText: "D2600001" });
  await expect(row).toContainText("張子微");
  await expect(row).toContainText("91000006");
  await expect(row).toContainText("文文B MM");
  await expect(row).toContainText("自費");
  await expect(row).toContainText("未安排");
  await expect(row).toContainText("Invoice SHMM26100001");

  await row.getByRole("button", { name: "安排工程", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "安排CS跟進" });
  const select = dialog.getByRole("combobox");
  await expect(select.locator("option")).toHaveCount(6);
  await select.selectOption({ label: "Joe（工程CS）" });
  await dialog.getByRole("button", { name: "儲存安排", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("Joe");
  await expect(
    row.getByRole("button", { name: "更改安排", exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.locator("tbody tr").filter({ hasText: "D2600001" }),
  ).toContainText("Joe");

  await switchRole(page, "工程CS");
  await page.goto("/handoff");
  const readOnlyRow = page.locator("tbody tr").filter({ hasText: "D2600001" });
  await expect(readOnlyRow).toContainText("Joe");
  await expect(
    readOnlyRow.getByRole("button", { name: /安排工程|更改安排/ }),
  ).toHaveCount(0);

  await switchRole(page, "阿花");
  await page.goto("/handoff");
  const supervisorRow = page
    .locator("tbody tr")
    .filter({ hasText: "D2600001" });
  await supervisorRow
    .getByRole("button", { name: "更改安排", exact: true })
    .click();
  const changeDialog = page.getByRole("dialog", { name: "安排CS跟進" });
  await changeDialog
    .getByRole("combobox")
    .selectOption({ label: "Nicole（工程CS）" });
  await changeDialog
    .getByRole("button", { name: "儲存安排", exact: true })
    .click();
  await expect(supervisorRow).toContainText("Nicole");
  expect(errors).toEqual([]);
});
