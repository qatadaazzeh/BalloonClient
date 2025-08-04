import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

interface ApiConfig {
  contestApiUrl: string;
  enableAutoSync: boolean;
  username: string;
  password: string;
}

interface PrintConfig {
  enablePrinting: boolean;
  printerName: string;
  printTemplate: "basic" | "detailed";
  includeQRCode: boolean;
}

interface PrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
  status?: string;
}

interface PrintersData {
  availablePrinters: PrinterInfo[];
  defaultPrinter: string;
}

interface ConnectionStatus {
  status: "connected" | "disconnected" | "error" | "testing";
  lastSync: string | null;
  message: string;
}

interface ContestEvent {
  type: string;
  data: any;
  timestamp: string;
  [key: string]: any;
}

interface ContestConnectionContextType {
  connectionStatus: ConnectionStatus;
  apiConfig: ApiConfig;
  printConfig: PrintConfig;
  availablePrinters: PrinterInfo[];
  isConnected: boolean;

  connect: () => void;
  disconnect: () => void;
  updateConfig: (config: Partial<ApiConfig>) => void;
  updatePrintConfig: (config: Partial<PrintConfig>) => void;
  printBalloonDelivery: (delivery: any, contestData: any) => Promise<void>;
  fetchPrinters: () => Promise<void>;

  events: ContestEvent[];
  clearEvents: () => void;

  autoReconnect: boolean;
  setAutoReconnect: (enabled: boolean) => void;
}

const ContestConnectionContext = createContext<
  ContestConnectionContextType | undefined
>(undefined);

export const useContestConnection = () => {
  const context = useContext(ContestConnectionContext);
  if (context === undefined) {
    throw new Error(
      "useContestConnection must be used within a ContestConnectionProvider"
    );
  }
  return context;
};

interface ContestConnectionProviderProps {
  children: React.ReactNode;
}

export const ContestConnectionProvider: React.FC<
  ContestConnectionProviderProps
> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "disconnected",
    lastSync: null,
    message: "No API connection configured",
  });

  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    contestApiUrl: "",
    enableAutoSync: false,
    username: "",
    password: "",
  });

  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    enablePrinting: false,
    printerName: "",
    printTemplate: "basic",
    includeQRCode: false,
  });

  const [availablePrinters, setAvailablePrinters] = useState<PrinterInfo[]>([]);

  const [events, setEvents] = useState<ContestEvent[]>([]);
  const [autoReconnect, setAutoReconnect] = useState(true);

  const lastContestDataRef = useRef<string>("");

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const pollingInterval = 7000;
  const getContestDataHash = useCallback((data: any): string => {
    try {
      const { submissions, judgements, teams, problems } =
        data?.data?.data || {};
      if (!submissions || !judgements || !teams || !problems) return "";
      const submissionIds = submissions
        .map((s: any) => s.id)
        .sort()
        .join(",");
      const judgementIds = judgements
        .map((j: any) => j.id)
        .sort()
        .join(",");
      const acceptedSubmissions = judgements.filter(
        (j: any) => j.judgement_type_id === "AC"
      ).length;
      const hash = `s:${submissions.length}-j:${judgements.length}-ac:${acceptedSubmissions}-teams:${teams.length}-problems:${problems.length}`;
      const lastSubmissions = submissions
        .slice(-3)
        .map((s: any) => s.id)
        .join(",");
      const lastJudgements = judgements
        .slice(-3)
        .map((j: any) => j.id)
        .join(",");

      return `${hash}-lastSub:${lastSubmissions}-lastJudg:${lastJudgements}`;
    } catch {
      return "";
    }
  }, []);

  const addEvent = useCallback(
    (type: string, data: any) => {
      if (type === "contest") {
        const currentHash = getContestDataHash(data);
        if (currentHash && currentHash === lastContestDataRef.current) {
          console.log("⏭️ Skipping event - no data changes detected");
          return;
        }
        lastContestDataRef.current = currentHash;
        console.log("✅ New contest data detected, updating events");
      }

      const event: ContestEvent = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      setEvents((prev) => {
        const newEvents = [event, ...prev];
        return newEvents;
      });
    },
    [getContestDataHash]
  );

  const clearEvents = () => {
    setEvents([]);
  };

  const updateConfig = (newConfig: Partial<ApiConfig>) => {
    setApiConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const updatePrintConfig = (newConfig: Partial<PrintConfig>) => {
    setPrintConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const fetchPrinters = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/api/printers/refresh",
        {
          method: "POST",
        }
      );
      if (response.ok) {
        const data: PrintersData = await response.json();
        setAvailablePrinters(data.availablePrinters);
        if (!printConfig.printerName && data.defaultPrinter) {
          setPrintConfig((prev) => ({
            ...prev,
            printerName: data.defaultPrinter,
          }));
        }

        console.log("🖨️ Refreshed printers:", data.availablePrinters.length);
      } else {
        console.error("Failed to refresh printers:", response.statusText);
      }
    } catch (error) {
      console.error("Error refreshing printers:", error);
    }
  };

  const printBalloonDelivery = async (delivery: any, contestData: any) => {
    if (!printConfig.enablePrinting) {
      console.log("Printing is disabled");
      return;
    }

    try {
      const team = contestData?.teams?.find(
        (t: any) => t.id === delivery.teamId
      );
      const problem = contestData?.problems?.find(
        (p: any) => p.id === delivery.problemId
      );

      if (!team || !problem) {
        console.error("Team or problem data not found for printing");
        return;
      }

      const deliveryData = {
        team: team.name,
        teamId: delivery.teamId,
        problem: problem.name,
        problemLetter: delivery.problemLetter,
        problemColor: problem.color,
        problemRgb: problem.rgb,
        isFirstSolve: delivery.isFirstSolve,
        isFirstACInContest: delivery.isFirstACInContest,
        deliveredAt: new Date().toLocaleString(),
        notes: delivery.notes,
      };

      const printConfigData = {
        template: printConfig.printTemplate,
        printerName: printConfig.printerName,
        includeQRCode: printConfig.includeQRCode,
      };

      showPrintNotification(deliveryData.team, deliveryData.problemLetter);

      const response = await fetch("http://localhost:3001/api/print/balloon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryData,
          printConfig: printConfigData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Balloon delivery printed successfully:", result);
      } else {
        const error = await response.json();
        console.error("❌ Print request failed:", error);
        throw new Error(error.message || "Print request failed");
      }
    } catch (error) {
      console.error("Failed to print balloon delivery:", error);
      showErrorNotification("Failed to print delivery");
    }
  };

  const showPrintNotification = (teamName: string, problemLetter: string) => {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      transition: all 0.3s ease;
      max-width: 300px;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>🖨️</span>
        <div>
          <div style="font-weight: bold;">Printing Balloon Delivery</div>
          <div style="font-size: 12px; opacity: 0.9;">${teamName} - Problem ${problemLetter}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  const showErrorNotification = (message: string) => {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      transition: all 0.3s ease;
      max-width: 300px;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>❌</span>
        <div>
          <div style="font-weight: bold;">Print Error</div>
          <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  };

  const disconnect = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectAttempts.current = 0;

    localStorage.setItem("balloonWasConnected", "false");

    setConnectionStatus({
      status: "disconnected",
      lastSync: null,
      message: "Disconnected from API polling",
    });
  }, []);

  const connect = useCallback(() => {
    if (
      !apiConfig.contestApiUrl ||
      !apiConfig.username ||
      !apiConfig.password
    ) {
      setConnectionStatus({
        status: "error",
        lastSync: null,
        message: "API URL, username, and password are required",
      });
      return;
    }

    disconnect();

    setConnectionStatus({
      status: "testing",
      lastSync: null,
      message: "Connecting to API...",
    });

    const pollApi = async () => {
      try {
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
        reconnectAttempts.current = 0;
        localStorage.setItem("balloonWasConnected", "true");

        setConnectionStatus({
          status: "connected",
          lastSync: new Date().toISOString(),
          message: "Connected to API via polling",
        });
        addEvent("contest", data);
      } catch (error) {
        console.error("❌ Fetch error:", error);

        const errorMessage = `Failed to fetch from API: ${(error as Error).message}`;

        setConnectionStatus({
          status: "error",
          lastSync: null,
          message: errorMessage,
        });

        addEvent("error", { message: errorMessage });
        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );

          console.log(
            `🔄 Attempting reconnect ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (autoReconnect) {
              connect();
            }
          }, delay);
        } else {
          console.log(
            "❌ Max reconnection attempts reached or auto-reconnect disabled"
          );

          localStorage.setItem("balloonWasConnected", "false");
        }
      }
    };

    pollApi().then(() => {
      if (autoReconnect) {
        pollingIntervalRef.current = setInterval(pollApi, pollingInterval);
      }
    });
  }, [apiConfig, autoReconnect, disconnect, addEvent]);

  useEffect(() => {
    const savedConfig = localStorage.getItem("balloonApiConfig");
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setApiConfig(config);
      } catch (error) {
        console.error("Error loading saved config:", error);
      }
    }

    const savedPrintConfig = localStorage.getItem("balloonPrintConfig");
    if (savedPrintConfig) {
      try {
        const config = JSON.parse(savedPrintConfig);
        setPrintConfig(config);
      } catch (error) {
        console.error("Error loading saved print config:", error);
      }
    }

    fetchPrinters();

    const wasConnected = localStorage.getItem("balloonWasConnected");
    if (wasConnected === "true") {
      setTimeout(() => {
        const currentConfig = JSON.parse(
          localStorage.getItem("balloonApiConfig") || "{}"
        );
        if (
          currentConfig.contestApiUrl &&
          currentConfig.username &&
          currentConfig.password &&
          currentConfig.enableAutoSync
        ) {
          console.log("🔄 Restoring previous connection...");
        }
      }, 100);
    }
  }, []);

  useEffect(() => {
    const wasConnected = localStorage.getItem("balloonWasConnected");
    if (
      wasConnected === "true" &&
      apiConfig.contestApiUrl &&
      apiConfig.username &&
      apiConfig.password &&
      apiConfig.enableAutoSync &&
      connectionStatus.status === "disconnected"
    ) {
      console.log("🔄 Auto-connecting with loaded config...");
      connect();
    }
  }, [apiConfig, connect, connectionStatus.status]);

  useEffect(() => {
    localStorage.setItem("balloonApiConfig", JSON.stringify(apiConfig));
  }, [apiConfig]);

  useEffect(() => {
    localStorage.setItem("balloonPrintConfig", JSON.stringify(printConfig));
  }, [printConfig]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const isConnected = connectionStatus.status === "connected";

  const contextValue: ContestConnectionContextType = {
    connectionStatus,
    apiConfig,
    printConfig,
    availablePrinters,
    isConnected,
    connect,
    disconnect,
    updateConfig,
    updatePrintConfig,
    printBalloonDelivery,
    fetchPrinters,
    events,
    clearEvents,
    autoReconnect,
    setAutoReconnect,
  };

  return (
    <ContestConnectionContext.Provider value={contextValue}>
      {children}
    </ContestConnectionContext.Provider>
  );
};
