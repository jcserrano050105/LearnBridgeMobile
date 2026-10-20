import { useEffect, useState } from "react";

// Time-of-day greeting from the device clock:
//   before 12 PM → "Good Morning", 12–5:59 PM → "Good Afternoon", 6 PM onward → "Good Evening".
export function greetingFor(date: Date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

// Re-checks every minute so the greeting changes while the dashboard stays open.
export function useGreeting() {
  const [greeting, setGreeting] = useState(() => greetingFor());
  useEffect(() => {
    const t = setInterval(() => setGreeting(greetingFor()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return greeting;
}
