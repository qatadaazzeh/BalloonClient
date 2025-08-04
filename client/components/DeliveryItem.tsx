import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BsBalloonFill } from "react-icons/bs";
import { Clock, Check, CheckCircle, AlertCircle, Package } from "lucide-react";
import { BalloonDelivery } from "@shared/balloonTypes";
import { DateTime } from "luxon";

interface DeliveryItemProps {
  delivery: BalloonDelivery;
  team: any;
  problem: any;
  onMarkAsDelivered: (deliveryId: string) => void;
  getStatusColor: (status: BalloonDelivery["status"]) => string;
  isPending?: boolean;
}

export const DeliveryItem = memo(
  ({
    delivery,
    team,
    problem,
    onMarkAsDelivered,
    getStatusColor,
    isPending = false,
  }: DeliveryItemProps) => {
    const formatTime = (timeString: string) => {
      try {
        const dt = DateTime.fromISO(timeString, { zone: "Asia/Amman" });
        if (!dt.isValid) return "Invalid date";
        return dt.toFormat("h:mm:ss a");
      } catch {
        return "Invalid date";
      }
    };

    const getStatusIcon = (status: BalloonDelivery["status"]) => {
      switch (status) {
        case "pending":
          return (
            <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
          );
        case "assigned":
          return (
            <Package className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          );
        case "delivered":
          return (
            <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
          );
        case "confirmed":
          return (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300" />
          );
        default:
          return <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      }
    };

    return (
      <div
        key={delivery.id}
        className={`flex items-center justify-between p-4 border rounded-lg ${
          isPending ? "hover:bg-muted/50 transition-colors" : ""
        }`}
      >
        <div className="flex items-center">
          <div className="flex items-center mr-5">
            {!isPending && getStatusIcon(delivery.status)}
            <BsBalloonFill size={32} color={problem?.rgb || "#000000"} />

            {delivery.isFirstSolve && (
              <BsBalloonFill size={32} color={problem?.rgb || "#000000"} />
            )}

            {delivery.isFirstACInContest && (
              <BsBalloonFill size={32} color={problem?.rgb || "#000000"} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {team?.name + ` (ID: ${delivery.teamId})`}
              </span>
              <Badge variant="outline" className="text-xs">
                Problem {delivery.problemLetter}
              </Badge>
              {isPending && (
                <Badge className={getStatusColor(delivery.status)}>
                  {delivery.status}
                </Badge>
              )}
              {delivery.isFirstSolve && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
                  🥇 FIRST!
                </Badge>
              )}
              {delivery.isFirstACInContest && (
                <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
                  FIRST To Solve in contest!
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(
                  isPending
                    ? delivery.requestedAt
                    : delivery.deliveredAt || delivery.requestedAt
                )}
              </span>
            </div>
            {delivery.notes && (
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {delivery.notes}
              </p>
            )}
          </div>
        </div>
        {isPending && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              onClick={() => onMarkAsDelivered(delivery.id)}
            >
              <Check className="h-4 w-4 mr-1" />
              Mark as Delivered
            </Button>
          </div>
        )}
      </div>
    );
  }
);

DeliveryItem.displayName = "DeliveryItem";
