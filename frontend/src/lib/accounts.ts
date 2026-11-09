import { Banknote, CreditCard, Landmark, PiggyBank, Wallet, type LucideIcon } from "lucide-react";

import type { Account, AccountKind } from "@/lib/types";

export const accountKinds: { value: AccountKind; label: string; icon: LucideIcon; liability: boolean }[] = [
  { value: "bank", label: "Bank account", icon: Landmark, liability: false },
  { value: "credit_card", label: "Credit card", icon: CreditCard, liability: true },
  { value: "wallet", label: "Wallet (Paytm, PhonePe…)", icon: Wallet, liability: false },
  { value: "cash", label: "Cash", icon: Banknote, liability: false },
  { value: "loan", label: "Loan", icon: PiggyBank, liability: true },
];

export function accountKind(kind: AccountKind) {
  return accountKinds.find((item) => item.value === kind) ?? accountKinds[0];
}

export function accountLabel(account: Pick<Account, "name" | "last4">) {
  return account.last4 ? `${account.name} ·· ${account.last4}` : account.name;
}
