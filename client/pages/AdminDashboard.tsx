import { useState } from "react";
import { Link } from "react-router-dom";
import BalloonLayout from "@/components/BalloonLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContestConnection } from "@/contexts/ContestConnectionContext";
import {
  ArrowLeft,
  Globe,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Play,
  Pause,
  Printer,
  FileText,
} from "lucide-react";

export default function AdminDashboard() {
  const {
    connectionStatus,
    apiConfig,
    printConfig,
    availablePrinters,
    isConnected,
    connect,
    disconnect,
    updateConfig,
    updatePrintConfig,
    fetchPrinters,
    autoReconnect,
    setAutoReconnect,
  } = useContestConnection();

  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleConfigChange = (
    field: keyof typeof apiConfig,
    value: string | number | boolean
  ) => {
    updateConfig({ [field]: value });
    setHasUnsavedChanges(true);
  };

  const handlePrintConfigChange = (
    field: keyof typeof printConfig,
    value: string | number | boolean
  ) => {
    updatePrintConfig({ [field]: value });
    setHasUnsavedChanges(true);
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);

    try {
      console.log("Configuration saved successfully");
      setHasUnsavedChanges(false);
      if (
        apiConfig.contestApiUrl &&
        apiConfig.username &&
        apiConfig.password &&
        apiConfig.enableAutoSync
      ) {
        connect();
      }
    } catch (error) {
      console.error("Failed to save configuration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const getStatusIcon = (status: typeof connectionStatus.status) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "disconnected":
        return <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "testing":
        return <Activity className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: typeof connectionStatus.status) => {
    switch (status) {
      case "connected":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
      case "disconnected":
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/20 dark:text-gray-300 dark:border-gray-700";
      case "error":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
      case "testing":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800";
    }
  };

  return (
    <BalloonLayout>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Configure contest settings and API connections
              </p>
            </div>
          </div>

          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
              >
                Unsaved Changes
              </Badge>
              <Button onClick={handleSaveConfig} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <Card
          className={`border-l-4 ${connectionStatus.status === "connected" ? "border-l-green-500" : connectionStatus.status === "error" ? "border-l-red-500" : "border-l-gray-400"}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(connectionStatus.status)}
                <div>
                  <h3 className="font-medium">API Connection Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {connectionStatus.message}
                  </p>
                  {connectionStatus.lastSync && (
                    <p className="text-xs text-muted-foreground">
                      Last sync:{" "}
                      {new Date(connectionStatus.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <Badge className={getStatusColor(connectionStatus.status)}>
                {connectionStatus.status.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contest-api-url">Contest API URL</Label>
                    <Input
                      id="contest-api-url"
                      placeholder="https://domjudge.example.com/api/v4"
                      value={apiConfig.contestApiUrl}
                      onChange={(e) =>
                        handleConfigChange("contestApiUrl", e.target.value)
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Base URL for the contest management system API
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="admin"
                      value={apiConfig.username}
                      onChange={(e) =>
                        handleConfigChange("username", e.target.value)
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Contest system username
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="admin"
                      value={apiConfig.password}
                      onChange={(e) =>
                        handleConfigChange("password", e.target.value)
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Contest system password
                    </p>
                  </div>
                  <div className="text-sm p-3 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/20 dark:border-blue-800">
                    <p className="font-medium text-blue-800 dark:text-blue-300">
                      ℹ️ Proxy Server Required
                    </p>
                    <p className="text-blue-700 dark:text-blue-400 mt-1">
                      Make sure the EventSource proxy server is running on port
                      3001. Use{" "}
                      <code className="text-xs bg-blue-100 dark:bg-blue-800 px-1 rounded">
                        npm run dev:proxy
                      </code>{" "}
                      to start it.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-sync"
                    checked={apiConfig.enableAutoSync}
                    onCheckedChange={(checked) =>
                      handleConfigChange("enableAutoSync", checked)
                    }
                  />
                  <Label htmlFor="auto-sync">Enable Auto Sync</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-reconnect"
                    checked={autoReconnect}
                    onCheckedChange={setAutoReconnect}
                  />
                  <Label htmlFor="auto-reconnect">Auto Reconnect</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={
                      !apiConfig.contestApiUrl ||
                      !apiConfig.username ||
                      !apiConfig.password ||
                      connectionStatus.status === "testing"
                    }
                  >
                    {isConnected ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Disconnect
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Connect
                      </>
                    )}
                  </Button>
                  <Button onClick={handleSaveConfig} disabled={isLoading}>
                    <Save className="mr-2 h-4 w-4" />
                    Save API Config
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-green-500 dark:text-green-400" />
                Print Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-printing">Enable Auto Print</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically print balloon deliveries when marked as
                        delivered
                      </p>
                    </div>
                    <Switch
                      id="enable-printing"
                      checked={printConfig.enablePrinting}
                      onCheckedChange={(checked) =>
                        handlePrintConfigChange("enablePrinting", checked)
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="printer-name">Select Printer</Label>
                    <div className="flex gap-2 mt-2">
                      <Select
                        value={printConfig.printerName}
                        onValueChange={(value: string) =>
                          handlePrintConfigChange("printerName", value)
                        }
                        disabled={!printConfig.enablePrinting}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a printer" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePrinters.map((printer) => (
                            <SelectItem key={printer.name} value={printer.name}>
                              {printer.displayName || printer.name}
                              {printer.isDefault && " (Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchPrinters}
                        disabled={!printConfig.enablePrinting}
                      >
                        🔄 Refresh
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {availablePrinters.length > 0
                        ? `${availablePrinters.length} printer(s) available`
                        : "No printers found. Click refresh to try again."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="print-template">Print Template</Label>
                    <Select
                      value={printConfig.printTemplate}
                      onValueChange={(value: "basic" | "detailed") =>
                        handlePrintConfigChange("printTemplate", value)
                      }
                      disabled={!printConfig.enablePrinting}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic Template</SelectItem>
                        <SelectItem value="detailed">
                          Detailed Template
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose between basic or detailed print format
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="include-qr">Include QR Code</Label>
                      <p className="text-xs text-muted-foreground">
                        Add verification code to printed receipts
                      </p>
                    </div>
                    <Switch
                      id="include-qr"
                      checked={printConfig.includeQRCode}
                      onCheckedChange={(checked) =>
                        handlePrintConfigChange("includeQRCode", checked)
                      }
                      disabled={!printConfig.enablePrinting}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="text-sm p-3 bg-green-50 border border-green-200 rounded-md dark:bg-green-900/20 dark:border-green-800">
                <p className="font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Backend Print Service
                </p>
                <p className="text-green-700 dark:text-green-400 mt-1">
                  Printing is handled by the backend server for reliable,
                  automatic delivery receipt printing. No browser popups or user
                  interaction required.
                </p>
                <p className="text-green-600 dark:text-green-500 mt-2 text-xs">
                  <strong>Requirements:</strong> Backend server must be running
                  on port 3001. Printers are automatically detected from your
                  system.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={isLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Print Config
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </BalloonLayout>
  );
}
