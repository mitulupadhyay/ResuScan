import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobMatchApi } from "@/api/jobMatch";
import { useToast } from "@/context/UIContext";

const key = {
  list: (resumeId) => ["jobMatches", "list", resumeId],
  one: (id) => ["jobMatches", "one", id],
};

export const useJobMatches = (resumeId) =>
  useQuery({
    queryKey: key.list(resumeId),
    queryFn: () => jobMatchApi.list(resumeId).then((d) => d.matches),
    enabled: !!resumeId,
  });

export const useJobMatch = (id) =>
  useQuery({
    queryKey: key.one(id),
    queryFn: () => jobMatchApi.get(id).then((d) => d.match),
    enabled: !!id,
  });

export function useCreateJobMatch(resumeId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body) => jobMatchApi.create({ resumeId, ...body }),
    onSuccess: (d) => {
      qc.setQueryData(key.one(d.match._id), d.match);
      qc.invalidateQueries({ queryKey: key.list(resumeId) });
    },
    onError: (e) => toast.error("Couldn't analyze job match", e?.message),
  });
}

export function usePatchRequirement(matchId, resumeId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ reqId, ...body }) => jobMatchApi.patchRequirement(matchId, reqId, body),
    onSuccess: (d) => {
      qc.setQueryData(key.one(matchId), d.match);
      qc.invalidateQueries({ queryKey: key.list(resumeId) });
    },
    onError: (e) => toast.error("Couldn't update requirement", e?.message),
  });
}

export function useDeleteJobMatch(resumeId) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id) => jobMatchApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key.list(resumeId) });
      toast.info("Job match deleted");
    },
    onError: (e) => toast.error("Couldn't delete", e?.message),
  });
}
