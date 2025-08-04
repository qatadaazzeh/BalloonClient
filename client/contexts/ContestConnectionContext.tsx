import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

interface ApiConfig {
  contestApiUrl: string;
  enableAutoSync: boolean;
  username: string;
  password: string;
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
  isConnected: boolean;

  connect: () => void;
  disconnect: () => void;
  updateConfig: (config: Partial<ApiConfig>) => void;

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

  const [events, setEvents] = useState<ContestEvent[]>([]);
  const [autoReconnect, setAutoReconnect] = useState(true);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const pollingInterval = 7000;

  const addEvent = (type: string, data: any) => {
    const event: ContestEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    setEvents((prev) => {
      const newEvents = [event, ...prev];
      return newEvents;
    });
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const updateConfig = (newConfig: Partial<ApiConfig>) => {
    setApiConfig((prev) => ({ ...prev, ...newConfig }));
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
    return () => {
      disconnect();
    };
  }, []);

  const isConnected = connectionStatus.status === "connected";

  const contextValue: ContestConnectionContextType = {
    connectionStatus,
    apiConfig,
    isConnected,
    connect,
    disconnect,
    updateConfig,
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
