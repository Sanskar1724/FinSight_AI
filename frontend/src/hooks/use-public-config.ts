import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export interface PublicConfig {
  support_email: string | null;
  demo_enabled: boolean;
}

export const REPOSITORY_ISSUES_URL = "https://github.com/Sanskar1724/FinSight_AI/issues";

/** Non-secret runtime settings (e.g. the support contact), set on the server. */
export function usePublicConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: () => api.get<PublicConfig>("/public-config"),
    staleTime: 60 * 60 * 1000,
  });
}
