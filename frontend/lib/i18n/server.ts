import { cookies } from "next/headers";
import {
  createTranslator,
  LOCALE_COOKIE,
  normalizeLocale,
} from "./messages";

export async function getServerI18n() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  return { locale, t: createTranslator(locale) };
}
