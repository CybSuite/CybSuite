import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/app/lib/api";

export interface ScanStatus {
  status: "idle" | "running" | "completed" | "failed";
  scanner_name: string | null;
  scanner_names?: string[];
  start_time: string | null;
  end_time: string | null;
  progress: number;
  progress_bar?: number;
  display_mode?: "single" | "dual";
  current_portion?: number;
  total_portions?: number | null;
  current_step?: number;
  total_steps?: number | null;
  portion_label?: string | null;
  step_label?: string | null;
  message: string;
  results: any | null;
  error: string | null;
  multi_scan?: boolean;
  current_scanner?: string;
  scanned_scanners?: string[];
}

export interface LogMessage {
  scanner_name: string;
  level: string;
  message: string;
  timestamp: number;
  id: string; // Add unique ID for React keys
}

export interface UseScanStatusReturn {
  status: ScanStatus;
  isConnected: boolean;
  connectionState:
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"
    | "polling";
  requestStatus: () => void;
  resetConnection: () => void;
  logs: LogMessage[];
  clearLogs: () => void;
  lastUpdate: Date | null;
}

const getWebSocketUrl = () => {
  if (typeof window === "undefined") return null;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  // Always use localhost:8000 for WebSocket connections in development
  let host = "localhost:8000";

  // In production, use the same host but port 8000
  if (
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    host = `${window.location.hostname}:8000`;
  }

  // Use environment variable if available, otherwise construct backend URL
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${host}`;
  return `${wsUrl}/ws/scan-status/`;
};

export const useScanStatus = (): UseScanStatusReturn => {
  const [status, setStatus] = useState<ScanStatus>({
    status: "idle",
    scanner_name: null,
    start_time: null,
    end_time: null,
    progress: 0,
    progress_bar: 0,
    display_mode: "single",
    current_portion: 0,
    total_portions: null,
    current_step: 0,
    total_steps: null,
    message: "No scan running",
    results: null,
    error: null,
  });

  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error" | "polling"
  >("disconnected");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [usePolling, setUsePolling] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 2;

  const requestStatus = useCallback(async () => {
    try {
      const response = await api.scanners.getScanStatus();
      if (response.data) {
        setStatus(response.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Error fetching scan status:", error);
    }
  }, []);

  const startPolling = useCallback(() => {
    // Close any existing WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }

    // Reset reconnection attempts to prevent further WebSocket attempts
    reconnectAttemptsRef.current = maxReconnectAttempts;

    setUsePolling(true);
    setConnectionState("polling");
    setIsConnected(true);

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Initial status fetch
    requestStatus();

    // Start polling interval
    pollingIntervalRef.current = setInterval(() => {
      requestStatus();
    }, 2000); // Poll every 2 seconds
  }, [requestStatus]);

  const tryWebSocket = useCallback(() => {
    if (usePolling) return; // Don't try if already using polling

    // Ensure we're in a proper browser environment
    if (typeof window === "undefined" || !window.WebSocket) {
      startPolling();
      return;
    }

    const wsUrl = getWebSocketUrl();

    if (!wsUrl) {
      startPolling();
      return;
    }

    setConnectionState("connecting");

    // Add a small delay to ensure browser is ready for WebSocket connections
    // This helps with Next.js navigation timing issues
    setTimeout(() => {
      if (usePolling) return; // Check again after delay

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // Set a timeout to fallback to polling if connection doesn't establish quickly
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            startPolling();
          }
        }, 3000);

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          setIsConnected(true);
          setConnectionState("connected");
          reconnectAttemptsRef.current = 0;

          // Request current status
          ws.send(JSON.stringify({ type: "get_status" }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "scan_status" && data.data) {
              setStatus(data.data);
              setLastUpdate(new Date());
            } else if (data.type === "log" && data.data) {
              // Add unique ID and add to logs
              const logMessage: LogMessage = {
                ...data.data,
                id: `${data.data.timestamp}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
              };
              setLogs((prevLogs) => {
                const newLogs = [...prevLogs, logMessage];
                // Keep only last 100 log messages to prevent memory issues
                return newLogs.slice(-100);
              });
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          setIsConnected(false);

          // Only process this close event if this WebSocket is still the current one
          if (wsRef.current === ws) {
            wsRef.current = null;

            // Only attempt reconnection if:
            // 1. It wasn't a clean close (code 1000)
            // 2. We haven't exceeded max attempts
            // 3. We're not already using polling
            if (
              event.code !== 1000 &&
              reconnectAttemptsRef.current < maxReconnectAttempts &&
              !usePolling
            ) {
              reconnectAttemptsRef.current++;
              setTimeout(() => {
                // Double-check we're still not using polling before reconnecting
                if (!usePolling) {
                  tryWebSocket();
                }
              }, 1000);
            } else {
              startPolling();
            }
          }
        };

        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          setIsConnected(false);

          if (!usePolling) {
            startPolling();
          }
        };
      } catch (error) {
        startPolling();
      }
    }, 500); // 500ms delay to ensure navigation is complete
  }, [usePolling, startPolling]);

  // Initialize connection
  useEffect(() => {
    // Reset state when component mounts
    setUsePolling(false);
    setIsConnected(false);
    setConnectionState("disconnected");
    reconnectAttemptsRef.current = 0;

    // Cleanup any existing connections
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }

    // Try WebSocket after a delay to ensure component is fully mounted
    const initTimeout = setTimeout(() => {
      tryWebSocket();
    }, 100);

    return () => {
      // Cleanup on unmount
      clearTimeout(initTimeout);

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array to avoid infinite re-renders

  // Manual request status method (for user-initiated requests)
  const manualRequestStatus = useCallback(() => {
    if (usePolling) {
      requestStatus();
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "get_status" }));
    }
  }, [usePolling, requestStatus]);

  // Clear logs function
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Force WebSocket connection (used for manual reconnection attempts)
  const forceWebSocketConnection = useCallback(() => {
    if (usePolling) {
      setUsePolling(false);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    const wsUrl = getWebSocketUrl();

    if (!wsUrl) {
      startPolling();
      return;
    }

    setConnectionState("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Use longer timeout for manual connection attempts
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          startPolling();
        }
      }, 5000); // 5 seconds instead of 3

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;

        // Request current status
        ws.send(JSON.stringify({ type: "get_status" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "scan_status" && data.data) {
            setStatus(data.data);
            setLastUpdate(new Date());
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        setIsConnected(false);

        if (wsRef.current === ws) {
          wsRef.current = null;
          // Fall back to polling if the forced connection fails
          startPolling();
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        setIsConnected(false);

        // Fall back to polling on error
        startPolling();
      };
    } catch (error) {
      startPolling();
    }
  }, [usePolling, startPolling]);

  // Reset connection function (can be called manually)
  const resetConnection = useCallback(() => {
    // Force reset to initial state
    setUsePolling(false);
    setIsConnected(false);
    setConnectionState("disconnected");
    reconnectAttemptsRef.current = 0;

    // Cleanup existing connections
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }

    // Force WebSocket attempt with longer timeout and more aggressive retry
    setTimeout(() => {
      forceWebSocketConnection();
    }, 300);
  }, []);

  return {
    status,
    isConnected,
    connectionState,
    requestStatus: manualRequestStatus,
    resetConnection,
    logs,
    clearLogs,
    lastUpdate,
  };
};
