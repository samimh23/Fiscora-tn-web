import { useMemo, useState } from "react";
import {
  BlockOutlined,
  DevicesOutlined,
  InfoOutlined,
  ManageAccountsOutlined,
  MoreVertRounded,
  SearchRounded,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { PlatformUser } from "../../types/api";

const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("fr-TN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Jamais";
const platformRole = "Admin Fiscora";

export function PlatformUsersPanel({
  users,
  currentUserId,
  search,
  onSearchChange,
  loading,
  hasError,
  onStatusChange,
  onRevoke,
}: {
  users: PlatformUser[];
  currentUserId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  hasError: boolean;
  onStatusChange: (user: PlatformUser) => void;
  onRevoke: (user: PlatformUser) => void;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [cabinet, setCabinet] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    user: PlatformUser;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = users.find((user) => user.id === detailId);
  const cabinets = useMemo(() => {
    const names = new Map<string, string>();
    users.forEach((user) =>
      user.memberships?.forEach((membership) =>
        names.set(membership.organizationId, membership.organizationName),
      ),
    );
    return [...names]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [users]);
  const roles = useMemo(
    () =>
      [
        ...new Set(
          users.flatMap((user) => [
            ...(user.isPlatformAdmin ? [platformRole] : []),
            ...(user.memberships?.map((membership) => membership.role) ?? []),
          ]),
        ),
      ]
        .sort((a, b) => a.localeCompare(b, "fr"))
        .map((value) => ({ value, label: value })),
    [users],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const filtered = users.filter((user) => {
    const memberships = user.memberships ?? [];
    const matchesMembership =
      !cabinet && !role
        ? true
        : role === platformRole
          ? user.isPlatformAdmin &&
            (!cabinet ||
              memberships.some(
                (membership) => membership.organizationId === cabinet,
              ))
          : memberships.some(
              (membership) =>
                (!cabinet || membership.organizationId === cabinet) &&
                (!role || membership.role === role),
            );
    return (
      matchesMembership &&
      (!status || (status === "active" ? user.isActive : !user.isActive)) &&
      `${user.fullName} ${user.email} ${memberships.map((m) => `${m.organizationName} ${m.role}`).join(" ")}`
        .toLocaleLowerCase("fr")
        .includes(normalizedSearch)
    );
  });
  const hasFilters = Boolean(search || cabinet || role || status);
  const beginAction = (callback: (user: PlatformUser) => void) => {
    if (!menu) return;
    callback(menu.user);
    setMenu(null);
  };

  return (
    <>
      <Box
        sx={{
          p: 2,
          bgcolor: "#fbfcfb",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
        >
          <Typography variant="subtitle2">
            {filtered.length} utilisateur(s)
            {hasFilters ? ` sur ${users.length}` : ""}
          </Typography>
          {hasFilters && (
            <Button
              size="small"
              onClick={() => {
                setCabinet("");
                setRole("");
                setStatus("");
                onSearchChange("");
              }}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "minmax(240px, 1.5fr) repeat(3, minmax(160px, 1fr))",
            },
            gap: 2,
          }}
        >
          <TextField
            size="small"
            label="Rechercher un compte"
            placeholder="Nom ou e-mail"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <SearchableSelect
            size="small"
            label="Cabinet"
            value={cabinet}
            onChange={setCabinet}
            options={cabinets}
            placeholder="Tous les cabinets"
          />
          <SearchableSelect
            size="small"
            label="Rôle"
            value={role}
            onChange={setRole}
            options={roles}
            placeholder="Tous les rôles"
          />
          <TextField
            size="small"
            select
            label="Statut"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <MenuItem value="">Tous les statuts</MenuItem>
            <MenuItem value="active">Actif</MenuItem>
            <MenuItem value="disabled">Désactivé</MenuItem>
          </TextField>
        </Box>
      </Box>
      {mobile ? (
        <Stack spacing={2} sx={{ p: 2 }}>
          {filtered.map((user) => (
            <Box
              key={user.id}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
                  >
                    {user.fullName}
                    {user.id === currentUserId ? " · Vous" : ""}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {user.email}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={`Actions pour ${user.fullName}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.user.id === user.id ? true : undefined}
                  onClick={(event) =>
                    setMenu({ anchor: event.currentTarget, user })
                  }
                >
                  <MoreVertRounded />
                </IconButton>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, my: 1.5 }}>
                <Chip
                  size="small"
                  label={user.isActive ? "Actif" : "Désactivé"}
                  color={user.isActive ? "success" : "default"}
                />
                {user.isPlatformAdmin && (
                  <Chip
                    size="small"
                    label={platformRole}
                    sx={{ color: "#4d58b8", bgcolor: "#eef0ff" }}
                  />
                )}
              </Stack>
              <Stack spacing={1}>
                {user.memberships?.map((membership) => (
                  <Box key={membership.organizationId}>
                    <Typography variant="body2">
                      {membership.organizationName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {membership.role}
                    </Typography>
                  </Box>
                ))}
                {!user.memberships?.length && (
                  <Typography variant="body2" color="text.secondary">
                    {user.memberships
                      ? "Aucune affectation active"
                      : "Détails des rôles indisponibles"}
                  </Typography>
                )}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 2 }}
              >
                Dernière connexion : {formatDate(user.lastLoginAtUtc)}
              </Typography>
            </Box>
          ))}
          {!loading && !hasError && !filtered.length && (
            <Box sx={{ py: 2, textAlign: "center" }}>
              <Typography>Aucun utilisateur trouvé.</Typography>
              {hasFilters && (
                <Typography variant="body2" color="text.secondary">
                  Essayez de modifier ou réinitialiser les filtres.
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      ) : (
        <TableContainer>
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Cabinet et rôle</TableCell>
                <TableCell>Dernière connexion</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>
                      {user.fullName}
                      {user.id === currentUserId && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          {" "}
                          · Vous
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                      <Chip
                        size="small"
                        label={user.isActive ? "Actif" : "Désactivé"}
                        color={user.isActive ? "success" : "default"}
                      />
                      {user.isPlatformAdmin && (
                        <Chip
                          size="small"
                          label={platformRole}
                          sx={{ color: "#4d58b8", bgcolor: "#eef0ff" }}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      {user.memberships?.map((membership) => (
                        <Box key={membership.organizationId}>
                          <Typography variant="body2">
                            {membership.organizationName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {membership.role}
                          </Typography>
                        </Box>
                      ))}
                      {!user.memberships?.length && (
                        <Typography variant="body2" color="text.secondary">
                          {user.memberships
                            ? "Aucune affectation active"
                            : "Détails des rôles indisponibles"}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDate(user.lastLoginAtUtc)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      aria-label={`Actions pour ${user.fullName}`}
                      aria-haspopup="menu"
                      aria-expanded={
                        menu?.user.id === user.id ? true : undefined
                      }
                      onClick={(event) =>
                        setMenu({ anchor: event.currentTarget, user })
                      }
                    >
                      <MoreVertRounded />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !hasError && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography>Aucun utilisateur trouvé.</Typography>
                    {hasFilters && (
                      <Typography variant="body2" color="text.secondary">
                        Essayez de modifier ou réinitialiser les filtres.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
      >
        <MenuItem
          onClick={() => {
            setDetailId(menu?.user.id ?? null);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <InfoOutlined fontSize="small" />
          </ListItemIcon>
          Voir les détails
        </MenuItem>
        <Divider />
        <MenuItem
          disabled={
            menu?.user.id === currentUserId || !menu?.user.activeSessionsCount
          }
          onClick={() => beginAction(onRevoke)}
        >
          <ListItemIcon>
            <DevicesOutlined fontSize="small" />
          </ListItemIcon>
          Révoquer les connexions
        </MenuItem>
        <MenuItem
          disabled={menu?.user.id === currentUserId}
          sx={{ color: menu?.user.isActive ? "error.main" : "success.main" }}
          onClick={() => beginAction(onStatusChange)}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            {menu?.user.isActive ? (
              <BlockOutlined fontSize="small" />
            ) : (
              <ManageAccountsOutlined fontSize="small" />
            )}
          </ListItemIcon>
          {menu?.user.id === currentUserId
            ? "Votre compte"
            : menu?.user.isActive
              ? "Désactiver le compte"
              : "Réactiver le compte"}
        </MenuItem>
      </Menu>
      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Détails du compte</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6">{detail.fullName}</Typography>
                <Typography
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {detail.email}
                </Typography>
              </Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                <Chip
                  size="small"
                  label={detail.isActive ? "Actif" : "Désactivé"}
                  color={detail.isActive ? "success" : "default"}
                />
                {detail.isPlatformAdmin && (
                  <Chip size="small" label={platformRole} color="info" />
                )}
              </Stack>
              {!detail.isActive && detail.disabledReason && (
                <Alert severity="info">
                  Motif de désactivation : {detail.disabledReason}
                </Alert>
              )}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Sécurité
                </Typography>
                <Stack spacing={1}>
                  <Typography>
                    E-mail :{" "}
                    {detail.emailVerified === undefined
                      ? "Information indisponible"
                      : detail.emailVerified
                        ? "Vérifié"
                        : "Non vérifié"}
                  </Typography>
                  <Typography>
                    Double authentification (MFA) :{" "}
                    {detail.mfaEnabled === undefined
                      ? "Information indisponible"
                      : detail.mfaEnabled
                        ? "Activée"
                        : "Désactivée"}
                  </Typography>
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Cabinets et rôles
                </Typography>
                <Stack spacing={1}>
                  {detail.memberships?.map((membership) => (
                    <Box key={membership.organizationId}>
                      <Typography>{membership.organizationName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {membership.role}
                      </Typography>
                    </Box>
                  ))}
                  {!detail.memberships?.length && (
                    <Typography color="text.secondary">
                      {detail.memberships
                        ? "Aucune affectation active"
                        : "Informations indisponibles"}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="body2">
                  Dernière connexion : {formatDate(detail.lastLoginAtUtc)}
                </Typography>
                <Typography variant="body2">
                  Compte créé :{" "}
                  {detail.createdAtUtc
                    ? formatDate(detail.createdAtUtc)
                    : "Information indisponible"}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                « Révoquer les connexions » empêche le renouvellement des
                connexions existantes. Les accès déjà délivrés restent valides
                jusqu’à leur expiration.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailId(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
