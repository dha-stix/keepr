"use client";

import type { CategoryKey } from "@/lib/types";
import { cx, naira } from "@/lib/utils";
import { useCategories } from "./CategoriesProvider";

/** A room type's current price per night, with a placeholder until the live price has loaded */
export function NightlyPrice({ category, from, className }: { category: CategoryKey; from?: boolean; className?: string }) {
  const { categories, ready } = useCategories();
  return (
    <div className={cx("num text-sm", className)}>
      {from && "from "}
      {ready ? <b className="text-xl font-medium">{naira(categories[category].price)}</b> : <span className="skeleton inline-block h-5 w-20 align-middle" aria-label="Loading price" />} / night
    </div>
  );
}
