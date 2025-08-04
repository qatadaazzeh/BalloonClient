import { useState, useEffect } from "react";
import BalloonLayout from "@/components/BalloonLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BsBalloonFill } from "react-icons/bs";
import { useContestConnection } from "@/contexts/ContestConnectionContext";
import {
  Circle,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  Laptop2,
  Trophy,
  Check,
  CheckCheck,
} from "lucide-react";
import { BalloonDelivery } from "@shared/balloonTypes";
import { DateTime } from "luxon";

function getDate(date) {
  const dt = DateTime.fromISO(date);
  return dt.toMillis();
}

export default function Index() {
  const { isConnected, events, printBalloonDelivery } = useContestConnection();
  const [pendingDeliveries, setPendingDeliveries] = useState<BalloonDelivery[]>(
    []
  );
  const [recentDeliveries, setRecentDeliveries] = useState<BalloonDelivery[]>(
    []
  );
  const [allDeliveries, setAllDeliveries] = useState<BalloonDelivery[]>([]);
  const [deliveredBalloons, setDeliveredBalloons] = useState<Set<string>>(
    new Set()
  );
  useEffect(() => {
    const saved = localStorage.getItem("deliveredBalloons");
    if (saved) {
      try {
        const deliveredArray = JSON.parse(saved);
        setDeliveredBalloons(new Set(deliveredArray));
      } catch (error) {
        console.error("Error loading delivered balloons:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "deliveredBalloons",
      JSON.stringify(Array.from(deliveredBalloons))
    );
  }, [deliveredBalloons]);

  useEffect(() => {
    if (events.length === 0) return;

    const contestData = events[0].data.data;
    const { submissions, teams, problems, judgements } = contestData;

    if (!submissions || !teams || !problems || !judgements) return;

    const acceptedSubmissions = new Map<string, any>();
    const firstSolves = new Map<string, string>();
    const firstTeamSolve = new Map<string, string>();
    let firstACInContest: any = null;

    const sortedSubmissions = [...submissions].sort(
      (a, b) => getDate(a.time) - getDate(b.time)
    );

    const judgementsBySubmission = new Map<string, any>();
    judgements.forEach((judgement) => {
      judgementsBySubmission.set(judgement.submission_id, judgement);
    });

    sortedSubmissions.forEach((submission) => {
      const submissionId = submission.id;
      const teamId = submission.team_id;
      const problemId = submission.problem_id;

      const judgement = judgementsBySubmission.get(submissionId);
      const isAccepted = judgement && judgement.judgement_type_id === "AC";

      if (isAccepted) {
        acceptedSubmissions.set(submissionId, submission);

        if (!firstACInContest) {
          firstACInContest = submission;
        }

        if (!firstSolves.has(problemId)) {
          firstSolves.set(problemId, teamId);
        }

        if (!firstTeamSolve.has(teamId)) {
          firstTeamSolve.set(teamId, problemId);
        }
      }
    });

    const newDeliveries: BalloonDelivery[] = [];
    let deliveryIdCounter = 1;

    acceptedSubmissions.forEach((submission, submissionId) => {
      const team = teams.find((t) => t.id === submission.team_id);
      const problem = problems.find((p) => p.id === submission.problem_id);

      if (!team || !problem) return;

      const isFirstSolveOfProblem =
        firstSolves.get(submission.problem_id) === submission.team_id;
      const isFirstSolveOfTeam =
        firstTeamSolve.get(submission.team_id) === submission.problem_id;
      const isFirstACInContest =
        firstACInContest && firstACInContest.id === submissionId;

      const deliveryKey = `${submission.team_id}-${submission.problem_id}`;
      const isAlreadyDelivered = deliveredBalloons.has(deliveryKey);

      const delivery: BalloonDelivery = {
        id: `delivery-${deliveryIdCounter++}`,
        teamId: submission.team_id,
        problemId: submission.problem_id,
        problemLetter: problem.id,
        submissionId: submissionId,
        requestedAt: submission.time,
        status: isAlreadyDelivered ? "delivered" : "pending",
        deliveredAt: isAlreadyDelivered ? submission.time : undefined,
        notes: [
          isFirstACInContest ? "First AC in contest!" : "",
          isFirstSolveOfProblem ? "🥇 FIRST SOLVE of this problem!" : "",
          isFirstSolveOfTeam ? "" : "",
        ]
          .filter(Boolean)
          .join(" "),
        isFirstSolve: isFirstSolveOfProblem,
        isFirstTeamSolve: isFirstSolveOfTeam,
        isFirstACInContest: isFirstACInContest,
      };

      newDeliveries.push(delivery);
    });

    setAllDeliveries(newDeliveries);
  }, [events, deliveredBalloons]);

  useEffect(() => {
    setPendingDeliveries(
      allDeliveries.filter(
        (d) => d.status === "pending" || d.status === "assigned"
      )
    );
    setRecentDeliveries(
      allDeliveries
        .filter((d) => d.status === "delivered" || d.status === "confirmed")
        .slice(0, 10)
    );
  }, [allDeliveries]);

  const markAsDelivered = async (deliveryId: string) => {
    const delivery = allDeliveries.find((d) => d.id === deliveryId);
    if (!delivery) return;

    setAllDeliveries((prev) =>
      prev.map((delivery) => {
        if (delivery.id === deliveryId) {
          const deliveryKey = `${delivery.teamId}-${delivery.problemId}`;
          setDeliveredBalloons(
            (prevDelivered) => new Set([...prevDelivered, deliveryKey])
          );

          const updatedDelivery = {
            ...delivery,
            status: "delivered" as const,
            deliveredAt: new Date().toISOString(),
          };
          if (contestData) {
            printBalloonDelivery(updatedDelivery, contestData).catch((error) =>
              console.error("Failed to print delivery:", error)
            );
          }

          return updatedDelivery;
        }
        return delivery;
      })
    );
  };

  const getStatusIcon = (status: BalloonDelivery["status"]) => {
    switch (status) {
      case "pending":
        return (
          <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
        );
      case "assigned":
        return <Package className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
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

  const getStatusColor = (status: BalloonDelivery["status"]) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800";
      case "assigned":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
      case "confirmed":
        return "bg-green-100 text-green-900 border-green-300 dark:bg-green-900/20 dark:text-green-200 dark:border-green-700";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/20 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getContestData = () => {
    if (events.length === 0) return null;
    return events[0].data.data;
  };

  const contestData = getContestData();

  const stats = [
    {
      title: "Total Deliveries",
      value: allDeliveries.filter(
        (d) => d.status === "delivered" || d.status === "confirmed"
      ).length,
      icon: CheckCheck,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Pending",
      value: pendingDeliveries.length,
      icon: AlertCircle,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      title: "Active Teams",
      value: contestData?.teams?.length || 0,
      icon: Users,
      color: "text-green-600 dark:text-green-400",
    },
    {
      title: "Contest Problems",
      value: contestData?.problems?.length || 0,
      icon: Laptop2,
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <BalloonLayout>
      <div className="container py-6 space-y-6">
        <Card className="bg-gradient-to-r from-blue-50 to-red-50 border-blue-200 dark:from-blue-950/20 dark:to-red-950/20 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-red-500 dark:from-blue-600 dark:to-red-600">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {contestData?.info?.formal_name || "No Contest"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isConnected ? "Contest is LIVE" : "Contest is PAUSED"} •
                    Duration: {contestData?.info?.duration || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${isConnected ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                  ></div>
                  <span className="font-medium">
                    {isConnected ? "LIVE" : "PAUSED"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                    </div>
                    <Icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pending ({pendingDeliveries.length})
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Circle className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                  Pending Balloon Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingDeliveries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Circle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending deliveries</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingDeliveries.map((delivery) => {
                      const team = contestData?.teams?.find(
                        (t) => t.id === delivery.teamId
                      );
                      const problem = contestData?.problems?.find(
                        (p) => p.id === delivery.problemId
                      );

                      return (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center">
                            <div className="flex items-center mr-5">
                              <BsBalloonFill
                                size={32}
                                color={problem?.rgb || "#000000"}
                              />

                              {delivery.isFirstSolve && (
                                <BsBalloonFill
                                  size={32}
                                  color={problem?.rgb || "#000000"}
                                />
                              )}

                              {delivery.isFirstACInContest && (
                                <BsBalloonFill
                                  size={32}
                                  color={problem?.rgb || "#000000"}
                                />
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
                                <Badge
                                  className={getStatusColor(delivery.status)}
                                >
                                  {delivery.status}
                                </Badge>
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
                                  {(() => {
                                    const dt = DateTime.fromISO(
                                      delivery.requestedAt,
                                      {
                                        zone: "Asia/Amman",
                                      }
                                    );
                                    if (!dt.isValid) return "Invalid date";
                                    return dt.toFormat("h:mm:ss a");
                                  })()}
                                </span>
                              </div>
                              {delivery.notes && (
                                <p className="text-xs text-muted-foreground mt-1 font-medium">
                                  {delivery.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                              onClick={() => markAsDelivered(delivery.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Mark as Delivered
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                  Recent Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentDeliveries.map((delivery) => {
                    const team = contestData?.teams?.find(
                      (t) => t.id === delivery.teamId
                    );
                    const problem = contestData?.problems?.find(
                      (p) => p.id === delivery.problemId
                    );

                    return (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(delivery.status)}
                            <BsBalloonFill
                              size={32}
                              color={problem?.rgb || "#000000"}
                            />

                            {delivery.isFirstSolve && (
                              <BsBalloonFill
                                size={32}
                                color={problem?.rgb || "#000000"}
                              />
                            )}

                            {delivery.isFirstACInContest && (
                              <BsBalloonFill
                                size={32}
                                color={problem?.rgb || "#000000"}
                              />
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
                              {delivery.isFirstSolve && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                  FIRST SOLVE!
                                </Badge>
                              )}
                              {delivery.isFirstACInContest && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  FIRST In Contest!
                                </Badge>
                              )}
                            </div>

                            {delivery.notes && (
                              <p className="text-xs text-muted-foreground font-medium">
                                {delivery.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>
                            {(() => {
                              if (!delivery.deliveredAt)
                                return "No delivery time";
                              const dt = DateTime.fromISO(
                                delivery.deliveredAt,
                                {
                                  zone: "Asia/Amman",
                                }
                              );
                              if (!dt.isValid) return "Invalid date";
                              return dt.toFormat("h:mm:ss a");
                            })()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Circle className="h-5 w-5" />
              Problem Color Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {contestData?.problems?.map((problem) => (
                <div key={problem.id} className="flex items-center space-x-2">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-background shadow-md"
                    style={{ backgroundColor: problem.rgb }}
                  ></div>
                  <div>
                    <p className="font-medium">
                      {problem.id} : {problem.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {problem.color}
                    </p>
                  </div>
                </div>
              )) || (
                <div className="col-span-full text-center text-muted-foreground">
                  No contest data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </BalloonLayout>
  );
}
