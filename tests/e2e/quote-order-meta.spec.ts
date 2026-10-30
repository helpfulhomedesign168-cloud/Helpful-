import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("報價可多選訂單分類及標記加單來源", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/quotes/quote-draft-1");

  const categories = page.locator(".order-category-chips");
  await expect(categories.getByRole("button", { name: "團購", exact: true })).toBeVisible();
  await categories.getByRole("button", { name: "團購", exact: true }).click();
  await categories
    .getByRole("button", { name: "8萬資助", exact: true })
    .click();
  await expect(
    categories.getByRole("button", { name: "團購", exact: true }),
  ).toHaveClass(/selected/);
  await expect(
    categories.getByRole("button", { name: "8萬資助", exact: true }),
  ).toHaveClass(/selected/);

  await page.getByRole("button", { name: "是", exact: true }).click();
  const parent = page.getByLabel("原本報價單", { exact: true });
  await expect(parent).toBeVisible();
  await parent.selectOption("quote-draft-2");

  await page.reload();
  await expect(
    page
      .locator(".order-category-chips")
      .getByRole("button", { name: "團購", exact: true }),
  ).toHaveClass(/selected/);
  await expect(
    page
      .locator(".order-category-chips")
      .getByRole("button", { name: "8萬資助", exact: true }),
  ).toHaveClass(/selected/);
  await expect(page.getByLabel("原本報價單", { exact: true })).toHaveValue(
    "quote-draft-2",
  );
  expect(errors).toEqual([]);
});
