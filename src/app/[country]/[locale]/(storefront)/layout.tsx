import type { Category } from "@spree/sdk";
import Link from "next/link";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getCategories } from "@/lib/data/categories";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ country: string; locale: string }>;
}

interface StorefrontNavigationProps {
  basePath: string;
  country: string;
  locale: string;
}

const EMPTY_CATEGORIES: Category[] = [];

/**
 * Navigation categories are optional chrome, so defer their first load until
 * there is a real request instead of making every prerendered page contact the
 * Store API. Primitive arguments let React deduplicate Header and Footer calls
 * within the request; successful responses keep using the persistent cache in
 * getCategories.
 */
const getRootCategories = cache(async (country: string, locale: string) => {
  await connection();

  return getCategories(
    {
      depth_eq: 0,
      expand: ["children.children"],
    },
    { country, locale },
  )
    .then((res) => res.data)
    .catch((error) => {
      console.error("StorefrontLayout: failed to load categories", error);
      return EMPTY_CATEGORIES;
    });
});

function CategoryLinks({
  categories,
  basePath,
}: {
  categories: Category[];
  basePath: string;
}) {
  return (
    <ul>
      {categories.map((category) => (
        <li key={category.id}>
          <Link href={`${basePath}/c/${category.permalink}`}>
            {category.name}
          </Link>
          {category.children && category.children.length > 0 && (
            <CategoryLinks categories={category.children} basePath={basePath} />
          )}
        </li>
      ))}
    </ul>
  );
}

async function StorefrontHeader({
  basePath,
  country,
  locale,
}: StorefrontNavigationProps) {
  const rootCategories = await getRootCategories(country, locale);

  return (
    <>
      <Header
        rootCategories={rootCategories}
        basePath={basePath}
        locale={locale as Locale}
      />
      {rootCategories.length > 0 && (
        <nav aria-label="Category navigation" className="sr-only">
          <CategoryLinks categories={rootCategories} basePath={basePath} />
        </nav>
      )}
    </>
  );
}

async function StorefrontFooter({
  basePath,
  country,
  locale,
}: StorefrontNavigationProps) {
  const rootCategories = await getRootCategories(country, locale);

  return (
    <Footer
      rootCategories={rootCategories}
      basePath={basePath}
      locale={locale as Locale}
    />
  );
}

export default async function StorefrontLayout({
  children,
  params,
}: StorefrontLayoutProps) {
  const { country, locale } = await params;
  const basePath = `/${country}/${locale}`;

  return (
    <>
      <Suspense
        fallback={
          <Header
            rootCategories={EMPTY_CATEGORIES}
            basePath={basePath}
            locale={locale as Locale}
          />
        }
      >
        <StorefrontHeader
          basePath={basePath}
          country={country}
          locale={locale}
        />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense
        fallback={
          <Footer
            rootCategories={EMPTY_CATEGORIES}
            basePath={basePath}
            locale={locale as Locale}
          />
        }
      >
        <StorefrontFooter
          basePath={basePath}
          country={country}
          locale={locale}
        />
      </Suspense>
    </>
  );
}
