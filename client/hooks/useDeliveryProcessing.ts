import { useMemo, useCallback } from "react";
import { BalloonDelivery } from "@shared/balloonTypes";

interface UseDeliveryProcessingProps {
  contestData: any;
  deliveredBalloons: Set<string>;
}

export const useDeliveryProcessing = ({
  contestData,
  deliveredBalloons,
}: UseDeliveryProcessingProps) => {
  const processDeliveries = useCallback(() => {
    if (!contestData) return [];

    const { submissions, teams, problems, judgements } = contestData;
    if (!submissions || !teams || !problems || !judgements) {
      return [];
    }

    console.log(
      `🔍 Processing all submissions. Total submissions: ${submissions.length}, Total judgements: ${judgements.length}, Current delivered balloons: ${deliveredBalloons.size}`
    );

    const teamMap = new Map(teams.map((t: any) => [t.id, t]));
    const problemMap = new Map(problems.map((p: any) => [p.id, p]));
    const judgementsBySubmission = new Map();
    judgements.forEach((judgement: any) => {
      judgementsBySubmission.set(judgement.submission_id, judgement);
    });

    const deliveries: BalloonDelivery[] = [];
    const processedTeamProblems = new Set<string>();

    const sortedSubmissions = [...submissions].sort((a: any, b: any) => {
      const numA = parseInt(a.id);
      const numB = parseInt(b.id);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.id.localeCompare(b.id);
    });

    sortedSubmissions.forEach((submission: any) => {
      const judgement = judgementsBySubmission.get(submission.id);
      const isAccepted = judgement && judgement.judgement_type_id === "AC";

      if (isAccepted) {
        const team = teamMap.get(submission.team_id);
        const problem = problemMap.get(submission.problem_id);

        if (team && problem) {
          const teamProblemKey = `${submission.team_id}-${submission.problem_id}`;

          if (!processedTeamProblems.has(teamProblemKey)) {
            processedTeamProblems.add(teamProblemKey);

            const deliveryKey = `${submission.team_id}-${submission.problem_id}`;
            const isAlreadyDelivered = deliveredBalloons.has(deliveryKey);

            const existingProblemSolves = deliveries.filter(
              (d) => d.problemId === submission.problem_id
            );
            const isFirstSolve = existingProblemSolves.length === 0;

            const existingTeamSolves = deliveries.filter(
              (d) => d.teamId === submission.team_id
            );
            const isFirstTeamSolve = existingTeamSolves.length === 0;

            const isFirstACInContest = deliveries.length === 0;

            const delivery: BalloonDelivery = {
              id: `delivery-${submission.id}`,
              teamId: submission.team_id,
              problemId: submission.problem_id,
              problemLetter: (problem as any).id,
              submissionId: submission.id,
              requestedAt: submission.time,
              status: isAlreadyDelivered ? "delivered" : "pending",
              deliveredAt: isAlreadyDelivered ? submission.time : undefined,
              notes: [
                isFirstACInContest ? "First AC in contest!" : "",
                isFirstSolve ? "🥇 FIRST SOLVE of this problem!" : "",
                isFirstTeamSolve ? "" : "",
              ]
                .filter(Boolean)
                .join(" "),
              isFirstSolve: isFirstSolve,
              isFirstTeamSolve: isFirstTeamSolve,
              isFirstACInContest: isFirstACInContest,
            };

            deliveries.push(delivery);
          }
        }
      }
    });

    console.log(`📋 Processed ${deliveries.length} total deliveries`);
    return deliveries;
  }, [contestData, deliveredBalloons]);

  const deliveries = useMemo(() => {
    return processDeliveries();
  }, [processDeliveries]);

  return {
    deliveries,
  };
};
