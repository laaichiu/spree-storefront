import {
  expect,
  type FrameLocator,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

/**
 * Checkout golden-path E2E.
 *
 * Walks a guest user through home → PDP → cart → checkout, fills the
 * shipping address, selects a delivery rate, pays with a Stripe test card,
 * and confirms the order-placed page renders.
 *
 * Backend: e2e-backend/docker-compose.yml (Spree 5.4.3.1 with sample data).
 * Payments: real Stripe test mode (pk_test_...) — card 4242 4242 4242 4242.
 *
 * Run with: npm run e2e:up && npm run test:e2e
 */

const TEST_CARD = "4242424242424242";
const TEST_EMAIL = "e2e-buyer@example.com";

test("guest can complete a checkout with a Stripe test card", async ({
  page,
}) => {
  // 1. Land on the home page (default market: us/en).
  await page.goto("/us/en");
  await expect(page).toHaveTitle(/.+/);

  // 2. Navigate to the products listing and pick the first available product.
  await page.goto("/us/en/products");
  const firstProduct = page.locator('a[href*="/products/"]').first();
  await expect(firstProduct).toBeVisible({ timeout: 15_000 });
  await firstProduct.click();
  await page.waitForURL(/\/products\/[^/]+/);

  // 3. Add to cart from the PDP. The cart drawer opens automatically after
  // the server action resolves and the cart cookie is set — wait for the
  // drawer's Checkout link rather than racing the navigation by going
  // straight to /cart (which would race the cookie write).
  const addToCart = page.getByRole("button", { name: /add to cart/i });
  await expect(addToCart).toBeEnabled({ timeout: 10_000 });
  await addToCart.click();

  const drawerCheckout = page
    .getByRole("dialog")
    .getByRole("link", { name: /^checkout$/i });
  await expect(drawerCheckout).toBeVisible({ timeout: 15_000 });
  // The drawer keeps re-rendering as the cart revalidates (its Express
  // Checkout widget remounts), which can detach the link mid-click
  // indefinitely — navigate to the link's target instead of clicking it.
  const checkoutHref = await drawerCheckout.getAttribute("href");
  if (!checkoutHref) {
    throw new Error("Drawer checkout link has no href");
  }
  await page.goto(checkoutHref);
  await page.waitForURL(/\/checkout\//);

  // 4. Fill contact + shipping address. The checkout is single-page with
  // auto-save: address persists on container blur (no explicit "Continue"
  // button). Email input has no <label> — its accessible name comes from
  // `placeholder`, so use getByPlaceholder.
  await page.getByPlaceholder(/email address/i).fill(TEST_EMAIL);
  await fillAddress(page);

  // Trigger the address auto-save by blurring the form. Clicking the
  // page heading takes focus out of the AddressFormFields container,
  // which fires handleContainerBlur → tryAutoSave.
  await page.getByRole("heading", { name: /shipping method/i }).click();

  // 5. Pick the first available shipping rate. Spree sample data ships
  //    with at least one rate for US destinations.
  const firstRate = page.getByRole("radio").first();
  await expect(firstRate).toBeVisible({ timeout: 30_000 });
  await firstRate.check();

  // 6. Pay with a Stripe test card. The Payment Element only renders
  //    after a session-based payment method is selected, which only
  //    appears once shipping is locked in. Several Stripe iframes share
  //    the "Secure payment input frame" title (an accessory frame mounts
  //    lazily next to the real form, before or after it), so resolve the
  //    frame that actually contains the card form rather than trusting
  //    mount order — a fill aimed at the wrong frame "succeeds" silently
  //    while the real card field stays empty.
  const stripeFrames = page.locator(
    'iframe[title="Secure payment input frame"]',
  );
  let cardFrame: FrameLocator | undefined;
  await expect(async () => {
    for (let i = 0; i < (await stripeFrames.count()); i++) {
      const frame = stripeFrames.nth(i).contentFrame();
      if (await frame.getByRole("textbox", { name: "Card number" }).count()) {
        cardFrame = frame;
        return;
      }
    }
    throw new Error("Card form has not rendered in any Stripe frame yet");
  }).toPass({ timeout: 30_000 });
  if (!cardFrame) {
    throw new Error("Card form frame not resolved");
  }

  const cardNumber = cardFrame.getByRole("textbox", { name: "Card number" });
  await cardNumber.fill(TEST_CARD);
  // Stripe formats the value with spaces — assert the digits landed in
  // THIS frame before paying, since a wrong-frame fill is silent.
  await expect(cardNumber).toHaveValue(/4242/);
  // The expiry field's accessible name varies across Payment Element
  // mounts ("Expiration date" vs "Expiration (MM/YY)"); the placeholder
  // is the stable handle.
  await cardFrame.getByPlaceholder("MM / YY").fill("12 / 30");
  await cardFrame.getByRole("textbox", { name: "Security code" }).fill("123");
  // US card forms include their own required ZIP field (distinct from
  // the shipping address) — Pay Now fails validation if it stays blank.
  const zip = cardFrame.getByRole("textbox", { name: /zip code/i });
  if (await zip.count()) {
    await zip.fill("10001");
  }

  // 7. Accept policies + submit.
  await page.getByRole("checkbox", { name: /i agree/i }).check();
  await page.getByRole("button", { name: /pay now|place order/i }).click();
  await page.waitForURL(/\/order-placed\//, { timeout: 60_000 });

  // 8. Confirm the order summary rendered.
  await expect(page.getByText(/order #/i)).toBeVisible();
});

async function fillAddress(page: Page) {
  // The Country dropdown defaults alphabetically (Canada before US) — pick
  // United States explicitly so the rest of the test data (NY state, ZIP
  // 10001, US phone) is valid for the selected country.
  await page.getByLabel(/country/i).selectOption({ label: "United States" });

  await safeFill(page.getByLabel(/first name/i), "Test");
  await safeFill(page.getByLabel(/last name/i), "Buyer");
  await safeFill(page.getByLabel(/^address$/i).first(), "123 Test St");
  await safeFill(page.getByLabel(/city/i), "New York");
  await safeFill(page.getByLabel(/zip|postal code/i), "10001");
  await safeFill(page.getByLabel(/phone/i), "5555550100");

  // State/province renders in one of three shapes depending on country +
  // load state in AddressFormFields:
  //   1. enabled  <select> — country has states, list is loaded
  //   2. disabled <select> — country has states, list still loading
  //   3. text     <input>  — country has no states
  // Wait for it to leave the "loading" state, then dispatch by tag.
  const stateField = page.getByLabel(/state|province/i).first();
  if (!(await stateField.isVisible().catch(() => false))) return;

  // Wait out the loading state so we don't try to select on a disabled <select>.
  await stateField
    .evaluate(
      (el) =>
        new Promise<void>((resolve) => {
          const settled = () =>
            !(el as HTMLSelectElement | HTMLInputElement).disabled;
          if (settled()) return resolve();
          const observer = new MutationObserver(() => {
            if (settled()) {
              observer.disconnect();
              resolve();
            }
          });
          observer.observe(el, {
            attributes: true,
            attributeFilter: ["disabled"],
          });
          setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 5_000);
        }),
    )
    .catch(() => undefined);

  const tagName = await stateField.evaluate((el) => el.tagName);
  if (tagName === "SELECT") {
    // Match the test's NY city + 10001 ZIP. Falls back to first option
    // if New York isn't in the list (different country, etc.).
    await stateField
      .selectOption({ label: "New York" })
      .catch(() => stateField.selectOption({ index: 1 }));
  } else {
    await stateField.fill("NY");
  }
}

async function safeFill(locator: Locator, value: string) {
  const target = locator.first();
  await expect(target).toBeVisible({ timeout: 10_000 });
  await target.fill(value);
}
