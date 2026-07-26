import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { AddRounded, CurrencyExchangeRounded, PostAddRounded } from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DossierSelector, Money, QueryState } from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";
import type { AccountingJournal, LedgerAccount } from "../types/api";

interface ExchangeRate { id: string; currencyCode: string; effectiveDate: string; rate: string; sourceLabel: string }
interface SuspensionCertificate { id: string; number: string; validFrom: string; validTo: string; authorizedBase: string; usedBase: string; remainingBase: string; currentStatus: string }
interface TradeOperation {
  id: string; direction: "IMPORT" | "EXPORT"; reference: string; operationDate: string;
  thirdPartyName: string; countryCode: string; currencyCode: string; foreignAmount: string;
  exchangeRate: string; localAmount: string; landedCost: string; importVat: string;
  exchangeDifference: string | null; status: string; repatriationDate: string | null;
  repatriationBankReference: string | null;
}

const today = new Date().toISOString().slice(0, 10);
const emptyOperation = {
  direction: "IMPORT" as "IMPORT" | "EXPORT", reference: "", operationDate: today,
  thirdPartyName: "", countryCode: "FR", currencyCode: "EUR", foreignAmount: "",
  exchangeRate: "", freightAmount: "0.000", insuranceAmount: "0.000",
  customsDuties: "0.000", importVat: "0.000", otherCosts: "0.000", incoterm: "CIF",
  customsDeclarationNumber: "", customsDeclarationDate: "", vatSuspensionCertificateId: "",
  journalId: "", tradeAccountId: "", thirdPartyAccountId: "", vatAccountId: "",
};

export function ForeignTradePage() {
  const { organization, can } = useAuth();
  const organizationId = organization?.id ?? "";
  const [dossierId, setDossierId] = useState("");
  const [tab, setTab] = useState(0);
  const [operationOpen, setOperationOpen] = useState(false);
  const [settleOperation, setSettleOperation] = useState<TradeOperation | null>(null);
  const [rate, setRate] = useState({ currencyCode: "EUR", effectiveDate: today, rate: "", sourceLabel: "Saisie cabinet", sourceUrl: "" });
  const [certificate, setCertificate] = useState({ number: "", validFrom: today, validTo: `${new Date().getFullYear()}-12-31`, authorizedBase: "", notes: "" });
  const [operation, setOperation] = useState(emptyOperation);
  const [settlement, setSettlement] = useState({ settlementDate: today, settlementRate: "", journalId: "", fxGainAccountId: "", fxLossAccountId: "", repatriationDate: today, repatriationBankReference: "" });
  const qc = useQueryClient();
  const orgBase = organizationId ? `/api/organizations/${organizationId}` : "";
  const base = dossierId ? `${orgBase}/foreign-trade/dossiers/${dossierId}` : "";

  const rates = useQuery({ queryKey: ["exchange-rates", organizationId], queryFn: () => api.get<ExchangeRate[]>(`${orgBase}/foreign-trade/exchange-rates`), enabled: Boolean(orgBase) });
  const certificates = useQuery({ queryKey: ["trade-certificates", organizationId, dossierId], queryFn: () => api.get<SuspensionCertificate[]>(`${base}/certificates`), enabled: Boolean(base) });
  const operations = useQuery({ queryKey: ["trade-operations", organizationId, dossierId], queryFn: () => api.get<TradeOperation[]>(`${base}/operations`), enabled: Boolean(base) });
  const accounts = useQuery({ queryKey: ["ledger-accounts", organizationId, dossierId], queryFn: () => api.get<LedgerAccount[]>(`${orgBase}/dossiers/${dossierId}/ledger-accounts`), enabled: Boolean(orgBase && dossierId && can("chart_of_accounts.view")) });
  const journals = useQuery({ queryKey: ["journals", organizationId, dossierId], queryFn: () => api.get<AccountingJournal[]>(`${orgBase}/dossiers/${dossierId}/journals`), enabled: Boolean(dossierId && can("accounting.view")) });
  const activeAccounts = useMemo(() => accounts.data?.filter((item) => item.isActive && item.allowsPosting) ?? [], [accounts.data]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["exchange-rates"] });
    void qc.invalidateQueries({ queryKey: ["trade-certificates"] });
    void qc.invalidateQueries({ queryKey: ["trade-operations"] });
    void qc.invalidateQueries({ queryKey: ["journal-entries"] });
  };
  const saveRate = useMutation({ mutationFn: () => api.post(`${orgBase}/foreign-trade/exchange-rates`, rate), onSuccess: () => { refresh(); setRate({ ...rate, rate: "" }); } });
  const saveCertificate = useMutation({ mutationFn: () => api.post(`${base}/certificates`, certificate), onSuccess: () => { refresh(); setCertificate({ ...certificate, number: "", authorizedBase: "", notes: "" }); } });
  const saveOperation = useMutation({ mutationFn: () => api.post(`${base}/operations`, { ...operation, exchangeRate: operation.exchangeRate || undefined, customsDeclarationDate: operation.customsDeclarationDate || undefined, vatSuspensionCertificateId: operation.vatSuspensionCertificateId || undefined, vatAccountId: operation.vatAccountId || undefined }), onSuccess: () => { refresh(); setOperationOpen(false); setOperation(emptyOperation); } });
  const postOperation = useMutation({ mutationFn: (id: string) => api.post(`${base}/operations/${id}/post`), onSuccess: refresh });
  const settle = useMutation({ mutationFn: () => api.post(`${base}/operations/${settleOperation?.id}/settle`, settlement), onSuccess: () => { refresh(); setSettleOperation(null); } });
  const error = saveRate.error ?? saveCertificate.error ?? saveOperation.error ?? postOperation.error ?? settle.error;
  const accountOptions = (value: string, set: (value: string) => void, label: string) => (
    <TextField select fullWidth label={label} value={value} onChange={(event) => set(event.target.value)}>
      {activeAccounts.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}
    </TextField>
  );

  return <>
    <PageHeader eyebrow="International" title="Devises & commerce extérieur" description="Historisez les taux, comptabilisez les imports/exports en TND et constatez les écarts de change." action={<DossierSelector value={dossierId} onChange={setDossierId} />} />
    <Alert severity="info" sx={{ mb: 2 }}>Le taux exprime 1 unité de devise en TND. Chaque écriture conserve le montant d’origine et le taux utilisé.</Alert>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error instanceof Error ? error.message : "Une erreur est survenue."}</Alert>}
    <Card>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        <Tab label={`Opérations (${operations.data?.length ?? 0})`} />
        <Tab label={`Taux de change (${rates.data?.length ?? 0})`} />
        <Tab label={`Suspension de TVA (${certificates.data?.length ?? 0})`} />
      </Tabs>
      <CardContent>
        {tab === 0 && <>
          <Stack direction="row" sx={{ mb: 2, justifyContent: "flex-end" }}><Button variant="contained" startIcon={<AddRounded />} disabled={!base || !can("foreign_trade.manage")} onClick={() => setOperationOpen(true)}>Nouvelle opération</Button></Stack>
          <QueryState loading={operations.isLoading} error={operations.isError} empty={!operations.data?.length} emptyText="Aucune opération import/export." />
          {!!operations.data?.length && <Box sx={{ overflowX: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Opération</TableCell><TableCell>Tiers / pays</TableCell><TableCell>Devise</TableCell><TableCell align="right">Valeur TND</TableCell><TableCell align="right">Coût rendu</TableCell><TableCell>Statut</TableCell><TableCell /></TableRow></TableHead><TableBody>
            {operations.data.map((item) => <TableRow key={item.id}><TableCell><b>{item.reference}</b><br /><Typography variant="caption">{item.operationDate} · {item.direction}</Typography>{item.repatriationBankReference && <Typography variant="caption" color="success.main" sx={{ display: "block" }}>Rapatriement : {item.repatriationBankReference}</Typography>}</TableCell><TableCell>{item.thirdPartyName}<br /><Typography variant="caption">{item.countryCode}</Typography></TableCell><TableCell>{item.foreignAmount} {item.currencyCode}<br /><Typography variant="caption">Taux {item.exchangeRate}</Typography></TableCell><TableCell align="right"><Money value={item.localAmount} /></TableCell><TableCell align="right"><Money value={item.landedCost} />{item.exchangeDifference && <Typography variant="caption" sx={{ display: "block" }}>Écart : {item.exchangeDifference} TND</Typography>}</TableCell><TableCell><Chip size="small" label={item.status} color={item.status === "REGLEE" ? "success" : item.status === "BROUILLON" ? "default" : "primary"} /></TableCell><TableCell><Stack direction="row" spacing={1}>{item.status === "BROUILLON" && can("foreign_trade.post") && <Button size="small" startIcon={<PostAddRounded />} onClick={() => postOperation.mutate(item.id)}>Comptabiliser</Button>}{item.status === "COMPTABILISEE" && can("foreign_trade.post") && <Button size="small" startIcon={<CurrencyExchangeRounded />} onClick={() => setSettleOperation(item)}>Régler</Button>}</Stack></TableCell></TableRow>)}
          </TableBody></Table></Box>}
        </>}
        {tab === 1 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" }, gap: 3 }}>
          <Card variant="outlined"><CardContent><Typography variant="h6" sx={{ mb: 2 }}>Ajouter un cours</Typography><Stack spacing={2}><TextField label="Devise ISO" value={rate.currencyCode} onChange={(e) => setRate({ ...rate, currencyCode: e.target.value.toUpperCase() })} /><TextField type="date" label="Date d’effet" value={rate.effectiveDate} onChange={(e) => setRate({ ...rate, effectiveDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="1 devise = TND" value={rate.rate} onChange={(e) => setRate({ ...rate, rate: e.target.value })} /><TextField label="Source" value={rate.sourceLabel} onChange={(e) => setRate({ ...rate, sourceLabel: e.target.value })} /><TextField label="Lien source (facultatif)" value={rate.sourceUrl} onChange={(e) => setRate({ ...rate, sourceUrl: e.target.value })} /><Button variant="contained" disabled={!rate.rate || !can("foreign_trade.manage")} onClick={() => saveRate.mutate()}>Enregistrer le taux</Button></Stack></CardContent></Card>
          <Box><QueryState loading={rates.isLoading} error={rates.isError} empty={!rates.data?.length} /><Table size="small"><TableHead><TableRow><TableCell>Devise</TableCell><TableCell>Date</TableCell><TableCell align="right">Cours TND</TableCell><TableCell>Source</TableCell></TableRow></TableHead><TableBody>{rates.data?.map((item) => <TableRow key={item.id}><TableCell><b>{item.currencyCode}</b></TableCell><TableCell>{item.effectiveDate}</TableCell><TableCell align="right">{item.rate}</TableCell><TableCell>{item.sourceLabel}</TableCell></TableRow>)}</TableBody></Table></Box>
        </Box>}
        {tab === 2 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "400px 1fr" }, gap: 3 }}>
          <Card variant="outlined"><CardContent><Typography variant="h6" sx={{ mb: 2 }}>Nouvelle attestation</Typography><Stack spacing={2}><TextField label="Numéro" value={certificate.number} onChange={(e) => setCertificate({ ...certificate, number: e.target.value })} /><Stack direction="row" spacing={1}><TextField fullWidth type="date" label="Du" value={certificate.validFrom} onChange={(e) => setCertificate({ ...certificate, validFrom: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth type="date" label="Au" value={certificate.validTo} onChange={(e) => setCertificate({ ...certificate, validTo: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack><TextField label="Plafond de base TND" value={certificate.authorizedBase} onChange={(e) => setCertificate({ ...certificate, authorizedBase: e.target.value })} /><TextField multiline label="Notes" value={certificate.notes} onChange={(e) => setCertificate({ ...certificate, notes: e.target.value })} /><Button variant="contained" disabled={!base || !certificate.number || !certificate.authorizedBase || !can("foreign_trade.manage")} onClick={() => saveCertificate.mutate()}>Créer l’attestation</Button></Stack></CardContent></Card>
          <Box><QueryState loading={certificates.isLoading} error={certificates.isError} empty={!certificates.data?.length} /><Table size="small"><TableHead><TableRow><TableCell>Attestation</TableCell><TableCell>Validité</TableCell><TableCell align="right">Plafond</TableCell><TableCell align="right">Utilisé</TableCell><TableCell align="right">Restant</TableCell><TableCell>Statut</TableCell></TableRow></TableHead><TableBody>{certificates.data?.map((item) => <TableRow key={item.id}><TableCell><b>{item.number}</b></TableCell><TableCell>{item.validFrom}<br />{item.validTo}</TableCell><TableCell align="right"><Money value={item.authorizedBase} /></TableCell><TableCell align="right"><Money value={item.usedBase} /></TableCell><TableCell align="right"><Money value={item.remainingBase} /></TableCell><TableCell><Chip size="small" label={item.currentStatus} /></TableCell></TableRow>)}</TableBody></Table></Box>
        </Box>}
      </CardContent>
    </Card>

    <Dialog open={operationOpen} onClose={() => setOperationOpen(false)} fullWidth maxWidth="md"><DialogTitle>Nouvelle opération internationale</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField select fullWidth label="Sens" value={operation.direction} onChange={(e) => setOperation({ ...operation, direction: e.target.value as "IMPORT" | "EXPORT" })}><MenuItem value="IMPORT">Importation</MenuItem><MenuItem value="EXPORT">Exportation</MenuItem></TextField><TextField fullWidth label="Référence" value={operation.reference} onChange={(e) => setOperation({ ...operation, reference: e.target.value })} /><TextField fullWidth type="date" label="Date" value={operation.operationDate} onChange={(e) => setOperation({ ...operation, operationDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth label="Tiers étranger" value={operation.thirdPartyName} onChange={(e) => setOperation({ ...operation, thirdPartyName: e.target.value })} /><TextField label="Pays" value={operation.countryCode} onChange={(e) => setOperation({ ...operation, countryCode: e.target.value.toUpperCase() })} /><TextField label="Devise" value={operation.currencyCode} onChange={(e) => setOperation({ ...operation, currencyCode: e.target.value.toUpperCase() })} /><TextField label="Montant devise" value={operation.foreignAmount} onChange={(e) => setOperation({ ...operation, foreignAmount: e.target.value })} /><TextField label="Taux (auto si vide)" value={operation.exchangeRate} onChange={(e) => setOperation({ ...operation, exchangeRate: e.target.value })} /></Stack>{operation.direction === "IMPORT" && <><Stack direction={{ xs: "column", sm: "row" }} spacing={2}>{(["freightAmount", "insuranceAmount", "customsDuties", "importVat", "otherCosts"] as const).map((key, index) => <TextField key={key} fullWidth label={["Fret TND", "Assurance TND", "Droits TND", "TVA import TND", "Autres frais TND"][index]} value={operation[key]} onChange={(e) => setOperation({ ...operation, [key]: e.target.value })} />)}</Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth label="Incoterm" value={operation.incoterm} onChange={(e) => setOperation({ ...operation, incoterm: e.target.value.toUpperCase() })} /><TextField fullWidth label="Déclaration douanière" value={operation.customsDeclarationNumber} onChange={(e) => setOperation({ ...operation, customsDeclarationNumber: e.target.value })} /><TextField fullWidth type="date" label="Date douane" value={operation.customsDeclarationDate} onChange={(e) => setOperation({ ...operation, customsDeclarationDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField select fullWidth label="Attestation suspension" value={operation.vatSuspensionCertificateId} onChange={(e) => setOperation({ ...operation, vatSuspensionCertificateId: e.target.value })}><MenuItem value="">Aucune</MenuItem>{certificates.data?.filter((item) => item.currentStatus === "ACTIVE").map((item) => <MenuItem key={item.id} value={item.id}>{item.number} — restant {item.remainingBase} TND</MenuItem>)}</TextField></Stack></>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField select fullWidth label="Journal" value={operation.journalId} onChange={(e) => setOperation({ ...operation, journalId: e.target.value })}>{journals.data?.filter((item) => item.type === (operation.direction === "IMPORT" ? "ACHATS" : "VENTES")).map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}</TextField>{accountOptions(operation.tradeAccountId, (value) => setOperation({ ...operation, tradeAccountId: value }), operation.direction === "IMPORT" ? "Compte d’achat / stock" : "Compte de vente")}{accountOptions(operation.thirdPartyAccountId, (value) => setOperation({ ...operation, thirdPartyAccountId: value }), "Compte tiers")}{operation.direction === "IMPORT" && accountOptions(operation.vatAccountId, (value) => setOperation({ ...operation, vatAccountId: value }), "Compte TVA import")}</Stack></Stack></DialogContent><DialogActions><Button onClick={() => setOperationOpen(false)}>Annuler</Button><Button variant="contained" disabled={!operation.reference || !operation.thirdPartyName || !operation.foreignAmount || !operation.journalId || !operation.tradeAccountId || !operation.thirdPartyAccountId || saveOperation.isPending} onClick={() => saveOperation.mutate()}>Enregistrer le brouillon</Button></DialogActions></Dialog>

    <Dialog open={Boolean(settleOperation)} onClose={() => setSettleOperation(null)} fullWidth maxWidth="sm"><DialogTitle>Régler l’opération et constater l’écart</DialogTitle><DialogContent><Alert severity="warning" sx={{ my: 1 }}>Cette action crée, si nécessaire, une écriture d’écart de change.</Alert><Stack spacing={2} sx={{ mt: 2 }}><TextField type="date" label="Date de règlement" value={settlement.settlementDate} onChange={(e) => setSettlement({ ...settlement, settlementDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Taux de règlement" value={settlement.settlementRate} onChange={(e) => setSettlement({ ...settlement, settlementRate: e.target.value })} /><TextField select label="Journal d’opérations diverses" value={settlement.journalId} onChange={(e) => setSettlement({ ...settlement, journalId: e.target.value })}>{journals.data?.filter((item) => item.type === "OPERATIONS_DIVERSES").map((item) => <MenuItem key={item.id} value={item.id}>{item.code} — {item.name}</MenuItem>)}</TextField>{accountOptions(settlement.fxGainAccountId, (value) => setSettlement({ ...settlement, fxGainAccountId: value }), "Compte gains de change")}{accountOptions(settlement.fxLossAccountId, (value) => setSettlement({ ...settlement, fxLossAccountId: value }), "Compte pertes de change")}{settleOperation?.direction === "EXPORT" && <><Alert severity="info">Article 74 LF 2026 : conservez la référence bancaire ou le relevé prouvant le rapatriement.</Alert><TextField type="date" label="Date de rapatriement" value={settlement.repatriationDate} onChange={(e) => setSettlement({ ...settlement, repatriationDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Référence du relevé / avis bancaire" value={settlement.repatriationBankReference} onChange={(e) => setSettlement({ ...settlement, repatriationBankReference: e.target.value })} required helperText="Le lien vers une pièce GED sera ajouté dans une étape dédiée." /></>}</Stack></DialogContent><DialogActions><Button onClick={() => setSettleOperation(null)}>Annuler</Button><Button variant="contained" disabled={!settlement.settlementRate || !settlement.journalId || !settlement.fxGainAccountId || !settlement.fxLossAccountId || (settleOperation?.direction === "EXPORT" && !settlement.repatriationBankReference) || settle.isPending} onClick={() => settle.mutate()}>Comptabiliser le règlement</Button></DialogActions></Dialog>
  </>;
}
