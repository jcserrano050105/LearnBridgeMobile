// Calendar helpers shared by the parent booking calendar and the tutor Calendar page.
// Same functions/constants as the website's FindTutorsPage.jsx and TutorCalendarPage.jsx.

export const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const HOURS      = Array.from({ length: 15 }, (_, i) => i + 6); // 6am to 8pm
export const REQUIRED_SESSIONS = 8;

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayStr() {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

/** 13 → "1:00 PM" */
export function fmtHour(h: number) {
  if (h === 12) return "12:00 PM";
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

/** "13:00:00" → "1:00 PM" */
export function fmtTime(t?: string | null) {
  if (!t) return "";
  const hr = parseInt(t.split(":")[0], 10);
  return `${hr > 12 ? hr - 12 : hr || 12}:00 ${hr >= 12 ? "PM" : "AM"}`;
}

/** 13 → "13:00:00" (format stored in booking_slots.slot_time) */
export function hourToTimeStr(h: number) {
  return `${String(h).padStart(2, "0")}:00:00`;
}

/** "2026-10-21" → "Wed, Oct 21" (or any Intl options) */
export function fmtDate(dateStr: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", opts);
}

/** Month navigation helpers */
export function prevMonth(year: number, month: number): [number, number] {
  return month === 0 ? [year - 1, 11] : [year, month - 1];
}
export function nextMonth(year: number, month: number): [number, number] {
  return month === 11 ? [year + 1, 0] : [year, month + 1];
}
