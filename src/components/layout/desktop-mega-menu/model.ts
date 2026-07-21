import type { Category } from "@spree/sdk";

export function categoryPathMatches({
  basePath,
  category,
  pathname,
}: {
  basePath: string;
  category: Category;
  pathname: string;
}) {
  const categoryPath = `${basePath}/c/${category.permalink}`;

  return pathname === categoryPath || pathname.startsWith(`${categoryPath}/`);
}

export function categoryPathEquals({
  basePath,
  category,
  pathname,
}: {
  basePath: string;
  category: Category;
  pathname: string;
}) {
  return pathname === `${basePath}/c/${category.permalink}`;
}
