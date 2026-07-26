import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { ForumOutlined, SendRounded } from "@mui/icons-material";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

interface PortalMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAtUtc: string;
}

export function DossierClientMessagesPanel({ organizationId, dossierId }: { organizationId: string; dossierId: string }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const base = `/api/organizations/${organizationId}/dossiers/${dossierId}/client-portal/messages`;
  const messages = useQuery({ queryKey: ["dossier-client-messages", organizationId, dossierId], queryFn: () => api.get<PortalMessage[]>(base) });
  const send = useMutation({ mutationFn: () => api.post(base, { body }), onSuccess: () => { setBody(""); void qc.invalidateQueries({ queryKey: ["dossier-client-messages", organizationId, dossierId] }); } });
  return <Card><CardContent sx={{ p: { xs: 2, md: 3 } }}><Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 1 }}><ForumOutlined color="primary" /><Typography variant="h3" sx={{ fontSize: 25 }}>Messages du portail client</Typography></Box><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Conversation partagée avec les clients affectés à ce dossier.</Typography>{messages.isError && <Alert severity="error" sx={{ mb: 2 }}>La conversation ne peut pas être chargée.</Alert>}{messages.isLoading && <><Skeleton height={80} /><Skeleton height={80} /></>}<Box sx={{ bgcolor: "#f5f4ef", borderRadius: 3, p: 2, minHeight: 280, maxHeight: 520, overflowY: "auto" }}>{!messages.isLoading && !messages.data?.length && <Box sx={{ py: 7, textAlign: "center" }}><ForumOutlined sx={{ fontSize: 42, color: "text.disabled" }} /><Typography color="text.secondary" sx={{ mt: 1 }}>Aucun message échangé.</Typography></Box>}{messages.data?.map((item) => { const mine = item.senderUserId === session?.user.id; return <Box key={item.id} sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", mb: 1.5 }}><Box sx={{ maxWidth: "78%", bgcolor: mine ? "primary.main" : "white", color: mine ? "white" : "text.primary", px: 2, py: 1.5, borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px", boxShadow: "0 4px 15px rgba(0,0,0,.06)" }}><Typography variant="caption" sx={{ color: mine ? "rgba(255,255,255,.72)" : "primary.main", fontWeight: 800 }}>{mine ? "Vous" : `${item.senderName} · ${item.senderRole}`}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{item.body}</Typography><Typography variant="caption" sx={{ color: mine ? "rgba(255,255,255,.55)" : "text.disabled" }}>{new Intl.DateTimeFormat("fr-TN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAtUtc))}</Typography></Box></Box>; })}</Box><Stack direction="row" spacing={1.5} sx={{ mt: 2 }}><TextField fullWidth multiline maxRows={5} placeholder="Répondre au client…" value={body} onChange={(e) => setBody(e.target.value)} /><Button variant="contained" endIcon={<SendRounded />} disabled={!body.trim() || send.isPending} onClick={() => send.mutate()}>Envoyer</Button></Stack>{send.isError && <Alert severity="error" sx={{ mt: 2 }}>Le message n’a pas pu être envoyé.</Alert>}</CardContent></Card>;
}
