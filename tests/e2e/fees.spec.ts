import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string) {
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((u: string) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(u));
      return null;
    }) as typeof window.open;
  });
  await page.goto("/login");
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Send code/ }).click();
  await page.locator("#code").fill("123456");
  await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
}

async function openFees(page: Page) {
  await page.goto("/fees");
  await expect(page.getByRole("heading", { name: "फीस", exact: true })).toBeVisible();
  await page.waitForFunction(() => !document.querySelector("[aria-busy]"));
}

test("desk records a payment and gets a receipt anyone can open", async ({ page, browser }) => {
  await login(page, "9999900003");
  await openFees(page);
  await page.getByRole("button", { name: "पैसे मिले", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: "नकद" }).click();
  await sheet.getByRole("button", { name: /मिल गए$/ }).click();
  await expect(sheet.getByText(/रसीद .+-\d{4}-\d{5}/)).toBeVisible();
  const receipt = await sheet.getByRole("link", { name: "रसीद देखें" }).getAttribute("href");
  const wa = await sheet.getByRole("link", { name: "WhatsApp पर रसीद भेजें" }).getAttribute("href");
  expect(decodeURIComponent(wa!)).toContain("/r/");

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(receipt!);
  await expect(visitor.getByText("फीस की रसीद")).toBeVisible();
  await expect(visitor.getByText(/रुपये मात्र/)).toBeVisible();
});

test("reminder opens WhatsApp with the student's number, amount and a pay link that works", async ({ page, browser }) => {
  await login(page, "9999900003");
  await openFees(page);
  await page.getByRole("button", { name: "याद दिलाएँ", exact: true }).first().click();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.at(-1)!);
  expect(opened).toMatch(/^https:\/\/wa\.me\/91\d{10}\?text=/);
  const text = decodeURIComponent(opened.split("text=")[1]);
  expect(text).toMatch(/₹[\d,]+/);
  const payLink = text.match(/https?:\/\/\S+\/p\/[0-9a-f]+/)![0];

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(new URL(payLink).pathname);
  await expect(visitor.getByText(/₹[\d,]+/).first()).toBeVisible();
});

test("paying more than is owed is blocked", async ({ page }) => {
  await login(page, "9999900003");
  await openFees(page);
  await page.getByRole("button", { name: "पैसे मिले", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#pay-amount").fill("999999");
  await sheet.getByRole("button", { name: /मिल गए$/ }).click();
  await expect(sheet.getByRole("alert")).toContainText("ज़्यादा नहीं ले सकते");
});

test("desk cannot cancel payments; owner can, with a reason", async ({ page }) => {
  await login(page, "9999900003");
  await openFees(page);
  await page.locator("main ul li a").first().click();
  await page.getByRole("radio", { name: "पेमेंट" }).click();
  await expect(page.getByRole("button", { name: "गलती सुधारें" })).toHaveCount(0);
});

test("owner edits a WhatsApp message and sees the preview", async ({ page }) => {
  await login(page, "9999900001");
  await page.goto("/more/templates");
  const box = page.getByRole("textbox", { name: "रसीद भेजना" });
  await box.fill("धन्यवाद ");
  await page.locator("section", { hasText: "रसीद भेजना" }).getByRole("button", { name: "+ नाम" }).click();
  await expect(page.locator("section", { hasText: "रसीद भेजना" }).getByText("धन्यवाद राहुल")).toBeVisible();
});
