export interface BalloonDelivery {
  id: string;
  teamId: string;
  problemId: string;
  problemLetter: string;
  status: "pending" | "assigned" | "delivered" | "confirmed";
  requestedAt: string;
  deliveredAt?: string;
  notes?: string;
  submissionId?: string;
  isFirstSolve?: boolean;
  isFirstTeamSolve?: boolean;
  isFirstACInContest?: boolean;
}
