import {
  BadgeIndianRupee,
  Briefcase,
  Bus,
  CircleEllipsis,
  CirclePlus,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  Plug,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  bus: Bus,
  home: Home,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  plug: Plug,
  "shopping-bag": ShoppingBag,
  repeat: Repeat,
  plane: Plane,
  "circle-ellipsis": CircleEllipsis,
  wallet: Wallet,
  "badge-indian-rupee": BadgeIndianRupee,
  briefcase: Briefcase,
  "circle-plus": CirclePlus,
};

interface CategoryIconProps {
  icon?: string;
  color?: string;
  className?: string;
  iconClassName?: string;
}

export function CategoryIcon({
  icon,
  color = "#10b981",
  className,
  iconClassName,
}: CategoryIconProps) {
  const Icon = icons[icon ?? ""] ?? CircleEllipsis;
  return (
    <span
      className={cn("grid size-9 shrink-0 place-items-center rounded-xl", className)}
      style={{ backgroundColor: `${color}14`, color }}
    >
      <Icon className={cn("size-4", iconClassName)} />
    </span>
  );
}
