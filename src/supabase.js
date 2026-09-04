// 실운영 연결 지점. 프로토타입은 App.jsx의 샘플 데이터를 사용한다.
// .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
import { createClient } from "@supabase/supabase-js";
export const supabase = import.meta.env.VITE_SUPABASE_URL
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;
