import { useMemo } from "react";

interface UseStableColorMappingProps {
  teams: any[];
  problems: any[];
}

export const useStableColorMapping = ({
  teams,
  problems,
}: UseStableColorMappingProps) => {
  const teamMap = useMemo(() => {
    return new Map(teams.map((team: any) => [team.id, team]));
  }, [teams]);

  const problemMap = useMemo(() => {
    return new Map(problems.map((problem: any) => [problem.id, problem]));
  }, [problems]);

  const getTeamById = useMemo(() => {
    return (teamId: string) => teamMap.get(teamId);
  }, [teamMap]);

  const getProblemById = useMemo(() => {
    return (problemId: string) => problemMap.get(problemId);
  }, [problemMap]);

  return {
    teamMap,
    problemMap,
    getTeamById,
    getProblemById,
  };
};
