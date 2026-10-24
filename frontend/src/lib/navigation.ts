import {
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  FlaskConical,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Sparkles,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

export const navigation: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { to: "/app", end: true, label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
      {
        to: "/app/transactions",
        label: "Transactions",
        icon: ArrowLeftRight,
        keywords: "ledger expenses income spending",
      },
      { to: "/app/budgets", label: "Budgets", icon: WalletCards, keywords: "limits categories" },
      { to: "/app/goals", label: "Goals", icon: Target, keywords: "savings target" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        to: "/app/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
        keywords: "trends reports recurring unusual forecast",
      },
      { to: "/app/scenarios", label: "Scenario lab", icon: Sparkles, keywords: "what if simulate" },
      { to: "/app/assistant", label: "AI assistant", icon: MessageSquareText, keywords: "chat ask" },
      { to: "/app/research", label: "Research lab", icon: FlaskConical, keywords: "evaluation" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/app/notifications", label: "Notifications", icon: Bell, keywords: "alerts inbox" },
      { to: "/app/settings", label: "Settings", icon: Settings, keywords: "preferences account" },
    ],
  },
];
