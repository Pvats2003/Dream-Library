import { Armchair, CircleEllipsis, House, IndianRupee, Users, type LucideIcon } from "lucide-react";

export const NAV_ITEMS: { href: string; key: "today" | "seats" | "students" | "fees" | "more"; Icon: LucideIcon }[] = [
  { href: "/today", key: "today", Icon: House },
  { href: "/seats", key: "seats", Icon: Armchair },
  { href: "/students", key: "students", Icon: Users },
  { href: "/fees", key: "fees", Icon: IndianRupee },
  { href: "/more", key: "more", Icon: CircleEllipsis },
];
