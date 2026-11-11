import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../../services/api";

export function useStokiBriefing(enabled) {
  return useQuery({
    queryKey: ["terrain", "stoki", "briefing"],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => (await api.get("ai/chat/briefing")).data,
  });
}

export function useStokiSend() {
  return useMutation({
    retry: false,
    mutationFn: async ({ message, history }) => {
      const { data } = await api.post("ai/chat", { message, history, lang: "fr" });
      return data;
    },
  });
}
