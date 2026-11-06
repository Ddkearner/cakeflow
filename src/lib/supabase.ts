import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uhlamtyaokkubrhcbfjt.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_fmXy-ZYZlYeYLLVl3cjxmg_r-UbzRqb";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
