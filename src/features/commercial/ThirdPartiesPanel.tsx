import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Skeleton, Stack, TextField, Typography,
} from "@mui/material";
import { AddRounded, BadgeOutlined, BusinessOutlined, EditOutlined } from "@mui/icons-material";
import { api, ApiError } from "../../api/client";
import type { LedgerAccount, ThirdParty } from "../../types/api";
import { money, partyTypeLabels } from "./options";
import { useLanguage } from "../../i18n/LanguageContext";

type Form = {
  type: ThirdParty["type"]; name: string; taxIdentifier: string; rneNumber: string;
  email: string; phone: string; address: string; receivableAccountId: string; payableAccountId: string;
};
const emptyForm: Form = { type: "CLIENT", name: "", taxIdentifier: "", rneNumber: "", email: "", phone: "", address: "", receivableAccountId: "", payableAccountId: "" };

export function ThirdPartiesPanel({ organizationId, dossierId, parties, accounts, loading, archived, canManage }: {
  organizationId: string; dossierId: string; parties: ThirdParty[]; accounts: LedgerAccount[];
  loading: boolean; archived: boolean; canManage: boolean;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ThirdParty | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState("");
  const postingAccounts = accounts.filter((account) => account.isActive && account.allowsPosting);
  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        taxIdentifier: form.taxIdentifier.trim() || undefined,
        rneNumber: form.rneNumber.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        receivableAccountId: form.receivableAccountId || undefined,
        payableAccountId: form.payableAccountId || undefined,
      };
      const path = `/api/organizations/${organizationId}/dossiers/${dossierId}/third-parties${selected ? `/${selected.id}` : ""}`;
      return selected ? api.put<ThirdParty>(path, payload) : api.post<ThirdParty>(path, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["third-parties", organizationId, dossierId] });
      setOpen(false); setSelected(null); setForm(emptyForm); setError("");
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : t("Impossible d’enregistrer ce tiers.")),
  });
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const edit = (party: ThirdParty) => {
    setSelected(party);
    setForm({
      type: party.type, name: party.name, taxIdentifier: party.taxIdentifier ?? "",
      rneNumber: party.rneNumber ?? "", email: party.email ?? "", phone: party.phone ?? "",
      address: party.address ?? "", receivableAccountId: party.receivableAccountId ?? "",
      payableAccountId: party.payableAccountId ?? "",
    });
    setError(""); setOpen(true);
  };

  return <>
    <Card>
      <Box sx={{ p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box><Typography variant="h3" sx={{ fontSize: 24 }}>{t("Clients et fournisseurs")}</Typography><Typography variant="body2" color="text.secondary">{t("Fiches tiers, coordonnées, adresses et soldes comptables.")}</Typography></Box>
        {canManage && !archived && <Button variant="contained" startIcon={<AddRounded />} onClick={() => { setSelected(null); setForm(emptyForm); setError(""); setOpen(true); }}>{t("Nouveau tiers")}</Button>}
      </Box>
      {loading && <Box sx={{ p: 2.5 }}><Skeleton height={75} /><Skeleton height={75} /></Box>}
      {!loading && parties.length === 0 && <Box sx={{ p: 6, textAlign: "center" }}><BusinessOutlined sx={{ fontSize: 46, color: "text.disabled" }} /><Typography sx={{ fontWeight: 800, mt: 1 }}>{t("Aucun tiers enregistré")}</Typography><Typography variant="body2" color="text.secondary">{t("Ajoutez d’abord vos clients et fournisseurs pour créer leurs factures.")}</Typography></Box>}
      {parties.map((party) => <Box key={party.id} sx={{ px: 3, py: 2.2, borderTop: "1px solid", borderColor: "divider", display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 170px 170px auto" }, gap: 2, alignItems: "center" }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}><Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}><BadgeOutlined /></Box><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }} noWrap>{party.name}</Typography><Stack direction="row" spacing={1} sx={{ mt: .4, flexWrap: "wrap" }}><Chip label={t(partyTypeLabels[party.type])} size="small" variant="outlined" />{party.taxIdentifier && <Typography variant="caption" color="text.secondary">MF {party.taxIdentifier}</Typography>}</Stack><Typography variant="caption" color="text.secondary">{[party.phone, party.email, party.address].filter(Boolean).join(" · ") || t("Aucune coordonnée")}</Typography></Box></Box>
        <Box><Typography variant="caption" color="text.secondary">{t("À recevoir")}</Typography><Typography sx={{ fontWeight: 800, color: Number(party.receivableBalance) > 0 ? "success.dark" : "text.primary" }}>{money(party.receivableBalance)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">{t("À payer")}</Typography><Typography sx={{ fontWeight: 800, color: Number(party.payableBalance) > 0 ? "warning.dark" : "text.primary" }}>{money(party.payableBalance)}</Typography></Box>
        {canManage && !archived && <Button size="small" startIcon={<EditOutlined />} onClick={() => edit(party)}>{t("Modifier")}</Button>}
      </Box>)}
    </Card>

    <Dialog open={open} onClose={mutation.isPending ? undefined : () => setOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>{selected ? t("Modifier le tiers") : t("Ajouter un client ou fournisseur")}</DialogTitle>
      <DialogContent sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: "12px !important" }}>
        {error && <Alert severity="error" sx={{ gridColumn: "1 / -1" }}>{error}</Alert>}
        <TextField select label={t("Type")} value={form.type} onChange={(event) => set("type", event.target.value as Form["type"])}><MenuItem value="CLIENT">{t("Client")}</MenuItem><MenuItem value="FOURNISSEUR">{t("Fournisseur")}</MenuItem><MenuItem value="CLIENT_ET_FOURNISSEUR">{t("Client et fournisseur")}</MenuItem></TextField>
        <TextField label={t("Nom / raison sociale")} value={form.name} onChange={(event) => set("name", event.target.value)} required />
        <TextField label={t("Matricule fiscal")} value={form.taxIdentifier} onChange={(event) => set("taxIdentifier", event.target.value)} />
        <TextField label={t("Numéro RNE")} value={form.rneNumber} onChange={(event) => set("rneNumber", event.target.value)} />
        <TextField label={t("E-mail")} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
        <TextField label={t("Téléphone")} value={form.phone} onChange={(event) => set("phone", event.target.value)} />
        <TextField label={t("Adresse complète")} multiline minRows={2} value={form.address} onChange={(event) => set("address", event.target.value)} sx={{ gridColumn: "1 / -1" }} helperText={t("Requise pour préparer une facture électronique TTN.")} />
        {(form.type === "CLIENT" || form.type === "CLIENT_ET_FOURNISSEUR") && <TextField select label={t("Compte client (facultatif)")} value={form.receivableAccountId} onChange={(event) => set("receivableAccountId", event.target.value)}><MenuItem value="">{t("Non défini")}</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>}
        {(form.type === "FOURNISSEUR" || form.type === "CLIENT_ET_FOURNISSEUR") && <TextField select label={t("Compte fournisseur (facultatif)")} value={form.payableAccountId} onChange={(event) => set("payableAccountId", event.target.value)}><MenuItem value="">{t("Non défini")}</MenuItem>{postingAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.code} — {account.name}</MenuItem>)}</TextField>}
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>{t("Annuler")}</Button><Button variant="contained" disabled={!form.name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? t("Enregistrement…") : selected ? t("Enregistrer") : t("Ajouter")}</Button></DialogActions>
    </Dialog>
  </>;
}
