import { supabase } from "../supabaseClient";

export const fetchCategoryData = async () => {
  const { data,} = await supabase.from("projects").select("category, subcategory");

  const map: Record<string, string[]> = {};
  const categories = new Set<string>();

  data?.forEach((row) => {
    if (!row.category) return;
    categories.add(row.category);
    if (!map[row.category]) map[row.category] = [];
    if (row.subcategory && !map[row.category].includes(row.subcategory)) {
      map[row.category].push(row.subcategory);
    }
  });

  return {
    categoryOptions: Array.from(categories),
    subcategoryMap: map,
  };
};
