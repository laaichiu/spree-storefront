import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import "../../globals.css";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { DocumentShell } from "@/components/layout/DocumentShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { StoreProvider } from "@/contexts/StoreContext";
import {
  DEFAULT_LOCALE,
  loadMessages,
  resolveSupportedLocale,
} from "@/i18n/locales";
import {
  findMarketForCountry,
  getDefaultMarketLocaleTarget,
  getMarketDefaultLocale,
  isLocaleEnabledForMarket,
} from "@/i18n/markets";
import {
  buildLocalizedRedirectPath,
  REQUEST_PATHNAME_HEADER,
  REQUEST_SEARCH_HEADER,
} from "@/i18n/routing";
import { getMarkets } from "@/lib/data/markets";
import { generateStoreMetadata } from "@/lib/metadata/store";
import { buildOrganizationJsonLd } from "@/lib/seo";
import { getDefaultCountry, getDefaultLocale } from "@/lib/store";

interface CountryLocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    country: string;
    locale: string;
  }>;
}

async function redirectToLocalizedRoute(
  country: string,
  locale: string,
): Promise<never> {
  const requestHeaders = await headers();
  redirect(
    buildLocalizedRedirectPath({
      country,
      locale,
      pathname: requestHeaders.get(REQUEST_PATHNAME_HEADER),
      search: requestHeaders.get(REQUEST_SEARCH_HEADER),
    }),
  );
}

/**
 * Root layouts with dynamic segments must provide their required build-time
 * params. Prebuild only the configured default route so every nested page is
 * not multiplied by the full Market list. Other valid routes render on demand.
 */
export function generateStaticParams() {
  return [
    {
      country: getDefaultCountry(),
      locale: resolveSupportedLocale(getDefaultLocale()) ?? DEFAULT_LOCALE,
    },
  ];
}

export async function generateMetadata({
  params,
}: CountryLocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  return generateStoreMetadata({ locale });
}

export default async function CountryLocaleLayout({
  children,
  params,
}: CountryLocaleLayoutProps) {
  const { country, locale } = await params;

  const requestedLocale = resolveSupportedLocale(locale);
  if (!requestedLocale) notFound();

  // Fetch Market configuration through a known-valid storefront context. The
  // requested country/locale pair has not been validated yet; forwarding it to
  // the Store API can fail before we get the Market data needed to redirect an
  // unsupported pair (for example /pl/pl when Poland's Market supports de).
  const marketLookupLocale =
    resolveSupportedLocale(getDefaultLocale()) ?? DEFAULT_LOCALE;
  const markets = await getMarkets({
    country: getDefaultCountry(),
    locale: marketLookupLocale,
  })
    .then((res) => res.data)
    .catch(() => null);

  // Let route-level data handling surface an API outage instead of redirecting
  // the request back to itself. Static storefront locale validation still runs.
  if (markets === null) {
    const messages = await loadMessages(requestedLocale);
    return (
      <DocumentShell locale={requestedLocale}>
        <CountryLocaleProviders
          country={country}
          locale={requestedLocale}
          markets={[]}
          messages={messages}
        >
          {children}
        </CountryLocaleProviders>
      </DocumentShell>
    );
  }

  // Validate that the URL country belongs to an available market.
  // If not, redirect server-side to avoid SSR with wrong prices.
  const currentMarket = findMarketForCountry(markets, country);

  if (!currentMarket) {
    const defaultTarget = getDefaultMarketLocaleTarget(markets);
    const fallbackCountry = defaultTarget?.country ?? getDefaultCountry();
    const fallbackLocale =
      defaultTarget?.locale ??
      resolveSupportedLocale(getDefaultLocale()) ??
      DEFAULT_LOCALE;

    return redirectToLocalizedRoute(fallbackCountry, fallbackLocale);
  }

  // A globally available bundle is not necessarily enabled for every Market.
  // Redirect to a renderable locale instead of letting an automatically
  // negotiated country/locale combination become a storefront 404.
  if (!isLocaleEnabledForMarket(currentMarket, requestedLocale)) {
    const fallbackLocale = getMarketDefaultLocale(currentMarket);
    if (!fallbackLocale) notFound();
    return redirectToLocalizedRoute(country, fallbackLocale);
  }

  const messages = await loadMessages(requestedLocale);

  return (
    <DocumentShell locale={requestedLocale}>
      <CountryLocaleProviders
        country={country}
        locale={requestedLocale}
        markets={markets}
        messages={messages}
      >
        {children}
      </CountryLocaleProviders>
    </DocumentShell>
  );
}

interface CountryLocaleProvidersProps {
  children: React.ReactNode;
  country: string;
  locale: Locale;
  markets: Awaited<ReturnType<typeof getMarkets>>["data"];
  messages: IntlMessages;
}

function CountryLocaleProviders({
  children,
  country,
  locale,
  markets,
  messages,
}: CountryLocaleProvidersProps) {
  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <StoreProvider
        initialCountry={country}
        initialLocale={locale}
        initialMarkets={markets}
      >
        <AuthProvider>
          <CartProvider>
            <JsonLd data={buildOrganizationJsonLd()} />
            {children}
            <CartDrawer />
            <Toaster />
          </CartProvider>
        </AuthProvider>
      </StoreProvider>
    </NextIntlClientProvider>
  );
}
