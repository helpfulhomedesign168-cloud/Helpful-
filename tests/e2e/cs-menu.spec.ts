import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("CS及Super Admin menu加入工程師傅、供應商、產品款式及工程價目", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "阿花");
  const nav = page.locator("nav");
  for (const label of [
    "工程單",
    "工程管理",
    "工程師傅",
    "供應商",
    "客戶",
    "產品款式",
    "工程價目",
  ])
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();

  for (const [label, title] of [
    ["工程師傅", "工程師傅"],
    ["供應商", "供應商"],
    ["產品款式", "產品款式"],
  ]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("此模組尚未建立", { exact: true }),
    ).toBeVisible();
  }

  await nav.getByRole("link", { name: "工程價目", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "工程價目", exact: true }),
  ).toBeVisible();

  await switchRole(page, "SuperAdmin");
  for (const label of [
    "工程單",
    "工程管理",
    "工程師傅",
    "供應商",
    "客戶",
    "產品款式",
    "工程價目",
  ])
    await expect(
      page.locator("nav").getByRole("link", { name: label, exact: true }),
    ).toBeVisible();

  await page
    .locator("nav")
    .getByRole("link", { name: "工程單", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "工程單", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "安排工程", exact: true }),
  ).toBeVisible();
});
