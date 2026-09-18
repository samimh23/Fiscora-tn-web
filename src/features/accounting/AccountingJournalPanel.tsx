import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  InputAdornment,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DownloadRounded, SearchRounded } from "@mui/icons-material";
import type { AccountingJournal, JournalEntry } from "../../types/api";
import { money, shortDate } from "./options";

const firstDayOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function AccountingJournalPanel({
  entries,
  journals,
  loading,
}: {
  entries: JournalEntry[];
  journals: AccountingJournal[];
  loading: boolean;
}) {
  const [from, setFrom] = useState(firstDayOfYear());
  const [to, setTo] = useState(today());
  const [journalId, setJournalId] = useState("TOUS");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return entries
      .filter((entry) =>
        ["COMPTABILISEE", "EXTOURNEE"].includes(entry.status),
      )
      .filter((entry) => !from || entry.entryDate >= from)
      .filter((entry) => !to || entry.entryDate <= to)
      .filter((entry) => journalId === "TOUS" || entry.journalId === journalId)
      .filter((entry) => {
        if (!needle) return true;
        const searchable = [
          entry.pieceReference,
          entry.description,
          entry.journal.code,
          ...entry.lines.flatMap((line) => [
            line.account.code,
            line.account.name,
            line.label,
            line.thirdPartyName ?? "",
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase("fr");
        return searchable.includes(needle);
      })
      .sort((left, right) => {
        const dateOrder = left.entryDate.localeCompare(right.entryDate);
        const pieceOrder = left.pieceReference.localeCompare(
          right.pieceReference,
          "fr",
        );
        const result = dateOrder || pieceOrder;
        return sort === "asc" ? result : -result;
      });
  }, [entries, from, journalId, search, sort, to]);

  const rows = useMemo(
    () =>
      visibleEntries.flatMap((entry) =>
        entry.lines.map((line) => ({ entry, line })),
      ),
    [visibleEntries],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (current, row) => ({
          debit: current.debit + Number(row.line.debit || 0),
          credit: current.credit + Number(row.line.credit || 0),
        }),
        { debit: 0, credit: 0 },
      ),
    [rows],
  );
  const paginatedRows = rows.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  useEffect(() => {
    setPage(0);
  }, [from, journalId, search, sort, to]);

  const exportCsv = () => {
    const header = [
      "Date",
      "Journal",
      "Pièce",
      "Compte",
      "Libellé",
      "Tiers",
      "Débit",
      "Crédit",
      "Lettrage",
      "Statut",
    ];
    const content = [
      header.map(csvCell).join(";"),
      ...rows.map(({ entry, line }) =>
        [
          entry.entryDate,
          entry.journal.code,
          entry.pieceReference,
          line.account.code,
          line.label,
          line.thirdPartyName,
          line.debit,
          line.credit,
          line.letterCode,
          entry.status,
        ]
          .map(csvCell)
          .join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-${from || "debut"}-${to || "fin"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <Box
        sx={{
          p: 2.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h3">Journal comptable</Typography>
          <Typography variant="body2" color="text.secondary">
            Consultez les mouvements validés. Les brouillons et validations se
            traitent dans l’onglet Saisie & validation.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
          disabled={!rows.length}
          onClick={exportCsv}
        >
          Exporter CSV
        </Button>
      </Box>

      <Box
        sx={{
          px: 2.5,
          pb: 2.5,
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "150px 150px 190px minmax(260px, 1fr) 150px",
          },
          gap: 1.5,
        }}
      >
        <TextField
          size="small"
          type="date"
          label="Du"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          type="date"
          label="Au"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          size="small"
          label="Journal"
          value={journalId}
          onChange={(event) => setJournalId(event.target.value)}
        >
          <MenuItem value="TOUS">Tous les journaux</MenuItem>
          {journals.map((journal) => (
            <MenuItem key={journal.id} value={journal.id}>
              {journal.code} — {journal.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="Pièce, libellé, compte ou tiers…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Tri"
          value={sort}
          onChange={(event) => setSort(event.target.value as "asc" | "desc")}
        >
          <MenuItem value="asc">Date croissante</MenuItem>
          <MenuItem value="desc">Date décroissante</MenuItem>
        </TextField>
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ px: 2.5, pb: 2.5 }}
      >
        <Chip label={`${visibleEntries.length} pièce(s)`} variant="outlined" />
        <Chip label={`${rows.length} mouvement(s)`} variant="outlined" />
        <Chip label={`Débit ${money(totals.debit)}`} color="primary" />
        <Chip label={`Crédit ${money(totals.credit)}`} color="primary" />
      </Stack>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1050 }}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Journal</TableCell>
              <TableCell>Pièce</TableCell>
              <TableCell>Compte</TableCell>
              <TableCell>Libellé / tiers</TableCell>
              <TableCell align="right">Débit</TableCell>
              <TableCell align="right">Crédit</TableCell>
              <TableCell>Lettrage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} sx={{ py: 3 }}>
                  <Skeleton height={44} />
                  <Skeleton height={44} />
                </TableCell>
              </TableRow>
            )}
            {paginatedRows.map(({ entry, line }) => (
              <TableRow key={line.id} hover>
                <TableCell>{shortDate(entry.entryDate)}</TableCell>
                <TableCell>
                  <Chip
                    label={entry.journal.code}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {entry.pieceReference}
                  </Typography>
                  {entry.status === "EXTOURNEE" && (
                    <Typography variant="caption" color="warning.main">
                      Extournée
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {line.account.code}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {line.account.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{line.label}</Typography>
                  {line.thirdPartyName && (
                    <Typography variant="caption" color="text.secondary">
                      {line.thirdPartyName}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{money(line.debit)}</TableCell>
                <TableCell align="right">{money(line.credit)}</TableCell>
                <TableCell>{line.letterCode ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!loading && !rows.length && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    Aucun mouvement comptabilisé
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Modifiez les filtres ou validez une écriture depuis l’onglet
                    Saisie & validation.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.length > 0 && (
              <TableRow>
                <TableCell colSpan={5} align="right" sx={{ fontWeight: 800 }}>
                  Totaux affichés
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  {money(totals.debit)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  {money(totals.credit)}
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from: first, to: last, count }) =>
          `${first}–${last} sur ${count}`
        }
      />
    </Card>
  );
}
