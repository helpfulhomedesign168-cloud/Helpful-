import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("工程CS有30張demo工程；阿花分派D260099後有31張及20項工程", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "工程CS");
  await page.goto("/orders");
  await expect(page.locator(".order-rail-row")).toHaveCount(30);
  await expect(
    page.locator(".order-rail-row").filter({ hasText: "D260099" }),
  ).toHaveCount(0);

  await switchRole(page, "阿花");
  await page.goto("/handoff");
  const row = page.locator("tbody tr").filter({ hasText: "D260099" });
  await row.getByRole("button", { name: "安排工程", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "安排CS跟進" });
  await dialog.getByRole("combobox").selectOption("cs");
  await dialog.getByRole("button", { name: "儲存安排", exact: true }).click();

  await switchRole(page, "工程CS");
  await page.goto("/orders");
  await expect(page.locator(".order-rail-row")).toHaveCount(31);
  await page.locator(".order-rail-row").filter({ hasText: "D260099" }).click();
  await expect(
    page.getByRole("heading", { name: "D260099", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".engineering-table tbody tr")).toHaveCount(20);
  expect(errors).toEqual([]);
});
