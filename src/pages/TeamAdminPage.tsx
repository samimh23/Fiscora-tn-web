import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { AddRounded, PersonAddOutlined } from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { OrganizationMember } from "../types/api";
interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}
interface Permission {
  name: string;
  description?: string;
}
interface Audit {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson: string | null;
  createdAtUtc: string;
}
interface Invitation {
  id: string;
  email: string;
  roleId: string;
  role: string;
  status: "EN_ATTENTE" | "ENVOYEE" | "ECHEC" | "ACCEPTEE" | "REVOQUEE" | "EXPIREE";
  deliveryStatus: string;
  deliveryAttempts: number;
  deliveryError: string | null;
  expiresAtUtc: string;
  sentAtUtc: string | null;
  acceptedAtUtc: string | null;
  invitationUrl?: string;
}
export function TeamAdminPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", roleId: "" });
  const [invitationResult, setInvitationResult] = useState<Invitation | null>(null);
  const [role, setRole] = useState({ name: "", permissions: [] as string[] });
  const base = organization?.id ? `/api/organizations/${organization.id}` : "";
  const members = useQuery({
    queryKey: ["team-members", organization?.id],
    queryFn: () => api.get<OrganizationMember[]>(`${base}/members`),
    enabled: Boolean(base),
  });
  const roles = useQuery({
    queryKey: ["team-roles", organization?.id],
    queryFn: () => api.get<Role[]>(`${base}/roles`),
    enabled: Boolean(base && can("roles.view")),
  });
  const invitations = useQuery({
    queryKey: ["team-invitations", organization?.id],
    queryFn: () => api.get<Invitation[]>(`${base}/invitations`),
    enabled: Boolean(base && can("users.view")),
  });
  const permissions = useQuery({
    queryKey: ["permissions", organization?.id],
    queryFn: () => api.get<Permission[]>(`${base}/permissions`),
    enabled: Boolean(base && can("roles.view")),
  });
  const audit = useQuery({
    queryKey: ["audit", organization?.id],
    queryFn: () => api.get<Audit[]>(`${base}/audit-logs?take=100`),
    enabled: Boolean(base && tab === 2 && can("audit.view")),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["team-members"] });
    void qc.invalidateQueries({ queryKey: ["team-roles"] });
    void qc.invalidateQueries({ queryKey: ["team-invitations"] });
  };
  const inviteMember = useMutation({
    mutationFn: () => api.post<Invitation>(`${base}/invitations`, invite),
    onSuccess: (result) => {
      setInvitationResult(result);
      refresh();
    },
  });
  const invitationAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "resend" | "revoke" }) =>
      action === "resend"
        ? api.post<Invitation>(`${base}/invitations/${id}/resend`)
        : api.delete(`${base}/invitations/${id}`),
    onSuccess: (result, variables) => {
      if (variables.action === "resend") setInvitationResult(result as Invitation);
      refresh();
    },
  });
  const createRole = useMutation({
    mutationFn: () => api.post(`${base}/roles`, role),
    onSuccess: () => {
      setRoleOpen(false);
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: ({
      member,
      roleId,
      isActive,
    }: {
      member: OrganizationMember;
      roleId: string;
      isActive: boolean;
    }) =>
      api.patch(`${base}/members/${member.membershipId}`, { roleId, isActive }),
    onSuccess: refresh,
  });
  const error = inviteMember.error ?? invitationAction.error ?? createRole.error ?? update.error;
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Équipe, rôles & accès"
        description="Invitez les collaborateurs, contrôlez leurs rôles et consultez la piste d’audit du cabinet."
        action={
          <Stack direction="row" spacing={1}>
            {can("roles.manage") && (
              <Button
                startIcon={<AddRounded />}
                onClick={() => setRoleOpen(true)}
              >
                Nouveau rôle
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<PersonAddOutlined />}
              disabled={!can("users.manage")}
              onClick={() => {
                setInvitationResult(null);
                setInvite({ email: "", roleId: roles.data?.[0]?.id ?? "" });
                setInviteOpen(true);
              }}
            >
              Inviter
            </Button>
          </Stack>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "Erreur"}
        </Alert>
      )}
      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Membres" />
          <Tab label="Rôles & permissions" disabled={!can("roles.view")} />
          <Tab label="Journal d’audit" disabled={!can("audit.view")} />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <>
              {!!invitations.data?.length && (
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6">Invitations</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Suivi des e-mails envoyés et des invitations encore actives.
                    </Typography>
                    <Table size="small">
                      <TableHead><TableRow><TableCell>Destinataire</TableCell><TableCell>Rôle</TableCell><TableCell>Expiration</TableCell><TableCell>Statut</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
                      <TableBody>{invitations.data.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.email}{item.deliveryError && <Typography variant="caption" color="error" sx={{ display: "block" }}>{item.deliveryError}</Typography>}</TableCell>
                          <TableCell>{item.role}</TableCell>
                          <TableCell>{new Date(item.expiresAtUtc).toLocaleString("fr-TN")}</TableCell>
                          <TableCell><Chip size="small" label={item.status} color={item.status === "ACCEPTEE" ? "success" : item.status === "ECHEC" ? "error" : item.status === "ENVOYEE" ? "info" : "default"} /></TableCell>
                          <TableCell><Stack direction="row" spacing={1}>{!["ACCEPTEE", "REVOQUEE"].includes(item.status) && can("users.manage") && <><Button size="small" disabled={invitationAction.isPending} onClick={() => invitationAction.mutate({ id: item.id, action: "resend" })}>Renvoyer</Button><Button size="small" color="error" disabled={invitationAction.isPending} onClick={() => invitationAction.mutate({ id: item.id, action: "revoke" })}>Révoquer</Button></>}</Stack></TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              <QueryState
                loading={members.isLoading}
                error={members.isError}
                empty={!members.data?.length}
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Collaborateur</TableCell>
                    <TableCell>Rôle</TableCell>
                    <TableCell>Accès</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.data?.map((m) => (
                    <TableRow key={m.membershipId}>
                      <TableCell>
                        <b>{m.fullName}</b>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {m.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={m.roleId}
                          disabled={!can("users.manage") || update.isPending}
                          onChange={(e) =>
                            update.mutate({
                              member: m,
                              roleId: e.target.value,
                              isActive: m.isActive,
                            })
                          }
                        >
                          {roles.data?.map((r) => (
                            <MenuItem key={r.id} value={r.id}>
                              {r.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={m.isActive ? "Actif" : "Suspendu"}
                          color={m.isActive ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          color={m.isActive ? "error" : "success"}
                          disabled={!can("users.manage")}
                          onClick={() =>
                            update.mutate({
                              member: m,
                              roleId: m.roleId,
                              isActive: !m.isActive,
                            })
                          }
                        >
                          {m.isActive ? "Suspendre" : "Réactiver"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {tab === 1 && (
            <>
              <QueryState
                loading={roles.isLoading}
                error={roles.isError}
                empty={!roles.data?.length}
              />
              {roles.data?.map((r) => (
                <Card variant="outlined" key={r.id} sx={{ mb: 1.5 }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="h6">{r.name}</Typography>
                      {r.isSystem && <Chip size="small" label="Système" />}
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {r.permissions.length} permission(s)
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ mt: 1, flexWrap: "wrap" }}
                    >
                      {r.permissions.map((p) => (
                        <Chip
                          key={p}
                          label={p}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
          {tab === 2 && (
            <>
              <QueryState
                loading={audit.isLoading}
                error={audit.isError}
                empty={!audit.data?.length}
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Objet</TableCell>
                    <TableCell>Détails</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {audit.data?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {new Date(a.createdAtUtc).toLocaleString("fr-TN")}
                      </TableCell>
                      <TableCell>
                        <b>{a.action}</b>
                      </TableCell>
                      <TableCell>
                        {a.entityType} · {a.entityId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {a.detailsJson || "—"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={inviteOpen} onClose={() => { setInviteOpen(false); setInvitationResult(null); }}>
        <DialogTitle>Inviter un collaborateur</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 360 }}>
            {invitationResult && (
              <Alert severity={invitationResult.deliveryStatus === "ENVOYEE" ? "success" : "warning"}>
                {invitationResult.deliveryStatus === "ENVOYEE"
                  ? `E-mail envoyé à ${invitationResult.email}.`
                  : `Invitation créée, mais l’e-mail n’a pas été envoyé : ${invitationResult.deliveryError ?? "erreur SMTP"}`}
              </Alert>
            )}
            {invitationResult?.invitationUrl && (
              <Button component="a" href={invitationResult.invitationUrl} target="_blank" rel="noreferrer" variant="outlined">
                Ouvrir le lien d’invitation
              </Button>
            )}
            {invitationResult && (
              <Button component="a" href="http://localhost:8025" target="_blank" rel="noreferrer">
                Ouvrir la boîte Mailpit
              </Button>
            )}
            {!invitationResult && <>
            <TextField
              type="email"
              label="E-mail"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
            <TextField
              select
              label="Rôle"
              value={invite.roleId}
              onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}
            >
              {roles.data?.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
            </>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setInviteOpen(false); setInvitationResult(null); }}>
            {invitationResult ? "Fermer" : "Annuler"}
          </Button>
          {!invitationResult && (
          <Button
            variant="contained"
            disabled={!invite.email || !invite.roleId || inviteMember.isPending}
            onClick={() => inviteMember.mutate()}
          >
            Envoyer l’invitation
          </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Nouveau rôle</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom du rôle"
            value={role.name}
            onChange={(e) => setRole({ ...role, name: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          <Typography sx={{ fontWeight: 700 }}>Permissions</Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap" }}>
            {permissions.data?.map((p) => (
              <FormControlLabel
                key={p.name}
                sx={{ width: { xs: "100%", md: "48%" } }}
                control={
                  <Checkbox
                    checked={role.permissions.includes(p.name)}
                    onChange={(e) =>
                      setRole({
                        ...role,
                        permissions: e.target.checked
                          ? [...role.permissions, p.name]
                          : role.permissions.filter((x) => x !== p.name),
                      })
                    }
                  />
                }
                label={p.description || p.name}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!role.name || createRole.isPending}
            onClick={() => createRole.mutate()}
          >
            Créer le rôle
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
