import { useQuery } from "@tanstack/react-query";
import { useContestConnection } from "@/contexts/ContestConnectionContext";
import { useMemo } from "react";

interface ContestDataResponse {
  submissions: any[];
  teams: any[];
  problems: any[];
  judgements: any[];
  info?: any;
}

export const useContestData = () => {
  const { apiConfig, isConnected } = useContestConnection();

  const {
    data: rawContestData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["contestData", apiConfig.contestApiUrl, apiConfig.username],
    queryFn: async (): Promise<ContestDataResponse | null> => {
      if (
        !apiConfig.contestApiUrl ||
        !apiConfig.username ||
        !apiConfig.password
      ) {
        return null;
      }

      const proxyUrl = "http://localhost:3001/api/contest-proxy";
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiUrl: apiConfig.contestApiUrl,
          username: apiConfig.username,
          password: apiConfig.password,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    },
    enabled:
      isConnected &&
      !!apiConfig.contestApiUrl &&
      !!apiConfig.username &&
      !!apiConfig.password,
    refetchInterval: 7000,
    staleTime: 5000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) =>
      Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  const contestData = useMemo(() => {
    if (!rawContestData) return null;
    return rawContestData;
  }, [rawContestData]);

  return {
    contestData,
    isLoading,
    error,
    refetch,
    isConnected,
  };
};
