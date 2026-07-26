import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
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
import {
  AddRounded,
  CalculateRounded,
  CheckRounded,
} from "@mui/icons-material";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  DossierSelector,
  Money,
  QueryState,
} from "../components/WorkspaceTools";
import { PageHeader } from "../components/PageHeader";

interface Employee {
  id: string;
  fullName: string;
  cin: string | null;
  cnssNumber: string | null;
  hireDate: string;
  contractType: string;
  grossSalary: string;
  isHigherEducationGraduate: boolean;
  employerSupportEligible: boolean;
  employerSupportStartDate: string | null;
}
interface PayrollLine {
  id: string;
  employee: Employee;
  grossSalary: string;
  employeeCnss: string;
  incomeTax: string;
  netSalary: string;
  employerCnss: string;
  employerCnssGross: string;
  employerSupportRate: string;
  employerSupportAmount: string;
}
interface PayrollRun {
  id: string;
  periodYear: number;
  periodMonth: number;
  totalGross: string;
  totalNet: string;
  totalEmployerCost: string;
  totalEmployerSupport: string;
  status: string;
  lines: PayrollLine[];
}
interface CnssReport {
  year: number;
  quarter: number;
  employees: Array<{
    employeeId: string;
    fullName: string;
    cnssNumber: string | null;
    grossSalary: string;
    employeeCnss: string;
    employerCnss: string;
  }>;
}

export function PayrollPage() {
  const { organization, can } = useAuth();
  const qc = useQueryClient();
  const [dossierId, setDossierId] = useState("");
  const [tab, setTab] = useState(0);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(
    Math.ceil((new Date().getMonth() + 1) / 3),
  );
  const [employee, setEmployee] = useState({
    fullName: "",
    cin: "",
    cnssNumber: "",
    hireDate: new Date().toISOString().slice(0, 10),
    contractType: "CDI",
    grossSalary: "",
    isHigherEducationGraduate: false,
    employerSupportEligible: false,
    employerSupportStartDate: new Date().toISOString().slice(0, 10),
  });
  const [period, setPeriod] = useState({
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
  });
  const base =
    organization?.id && dossierId
      ? `/api/organizations/${organization.id}/dossiers/${dossierId}`
      : "";
  const employees = useQuery({
    queryKey: ["employees", organization?.id, dossierId],
    queryFn: () => api.get<Employee[]>(`${base}/employees`),
    enabled: Boolean(base),
  });
  const runs = useQuery({
    queryKey: ["payroll-runs", organization?.id, dossierId],
    queryFn: () => api.get<PayrollRun[]>(`${base}/payroll-runs`),
    enabled: Boolean(base),
  });
  const cnss = useQuery({
    queryKey: ["cnss", organization?.id, dossierId, year, quarter],
    queryFn: () =>
      api.get<CnssReport>(`${base}/payroll/cnss/${year}/${quarter}`),
    enabled: Boolean(base && tab === 2),
  });
  const saveEmployee = useMutation({
    mutationFn: () => api.post(`${base}/employees`, employee),
    onSuccess: () => {
      setEmployeeOpen(false);
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
  const generate = useMutation({
    mutationFn: () => api.post(`${base}/payroll-runs`, period),
    onSuccess: () => {
      setRunOpen(false);
      void qc.invalidateQueries({ queryKey: ["payroll-runs"] });
    },
  });
  const validate = useMutation({
    mutationFn: (id: string) => api.post(`${base}/payroll-runs/${id}/validate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["payroll-runs"] }),
  });
  const error = saveEmployee.error ?? generate.error ?? validate.error;
  return (
    <>
      <PageHeader
        eyebrow="Social"
        title="Paie & CNSS"
        description="Salariés, bulletins mensuels calculés avec les paramètres applicables et état CNSS trimestriel."
        action={<DossierSelector value={dossierId} onChange={setDossierId} />}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : "Une erreur est survenue."}
        </Alert>
      )}
      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="Salariés" />
          <Tab label="Traitements de paie" />
          <Tab label="CNSS trimestrielle" />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <>
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={!base || !can("payroll.manage")}
                  onClick={() => setEmployeeOpen(true)}
                >
                  Nouveau salarié
                </Button>
              </Stack>
              <QueryState
                loading={employees.isLoading}
                error={employees.isError}
                empty={!employees.data?.length}
                emptyText="Aucun salarié actif."
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Salarié</TableCell>
                    <TableCell>CIN / CNSS</TableCell>
                    <TableCell>Contrat</TableCell>
                    <TableCell align="right">Salaire brut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employees.data?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>
                          {item.fullName}
                        </Typography>
                        <Typography variant="caption">
                          Embauche : {item.hireDate}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.cin || "—"} / {item.cnssNumber || "—"}
                      </TableCell>
                      <TableCell>{item.contractType}</TableCell>
                      <TableCell align="right">
                        <Money value={item.grossSalary} />
                        {item.employerSupportEligible && (
                          <Typography variant="caption" sx={{ display: "block" }} color="success.main">
                            Aide patronale art. 13 activée
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          {tab === 1 && (
            <>
              <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  startIcon={<CalculateRounded />}
                  disabled={!base || !can("payroll.manage")}
                  onClick={() => setRunOpen(true)}
                >
                  Calculer une paie
                </Button>
              </Stack>
              <QueryState
                loading={runs.isLoading}
                error={runs.isError}
                empty={!runs.data?.length}
                emptyText="Aucun traitement de paie."
              />
              {runs.data?.map((run) => (
                <Card variant="outlined" key={run.id} sx={{ mt: 2 }}>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{ alignItems: { md: "center" } }}
                    >
                      <Box>
                        <Typography variant="h6">
                          Paie {String(run.periodMonth).padStart(2, "0")}/
                          {run.periodYear}
                        </Typography>
                        <Chip
                          size="small"
                          label={run.status}
                          color={
                            run.status === "VALIDEE" ? "success" : "warning"
                          }
                        />
                      </Box>
                      <Box sx={{ flex: 1 }} />
                      <Typography>
                        Brut :{" "}
                        <b>
                          <Money value={run.totalGross} />
                        </b>
                      </Typography>
                      <Typography>
                        Net :{" "}
                        <b>
                          <Money value={run.totalNet} />
                        </b>
                      </Typography>
                      <Typography>
                        Coût employeur :{" "}
                        <b>
                          <Money value={run.totalEmployerCost} />
                        </b>
                      </Typography>
                      {Number(run.totalEmployerSupport) > 0 && (
                        <Chip
                          color="success"
                          label={`Aide estimée : ${Number(run.totalEmployerSupport).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND`}
                        />
                      )}
                      {run.status === "BROUILLON" && (
                        <Button
                          startIcon={<CheckRounded />}
                          disabled={
                            !can("payroll.validate") || validate.isPending
                          }
                          onClick={() => validate.mutate(run.id)}
                        >
                          Valider
                        </Button>
                      )}
                    </Stack>
                    <Box sx={{ overflowX: "auto", mt: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Salarié</TableCell>
                            <TableCell align="right">Brut</TableCell>
                            <TableCell align="right">CNSS salarié</TableCell>
                            <TableCell align="right">IRPP</TableCell>
                            <TableCell align="right">Net</TableCell>
                            <TableCell align="right">CNSS employeur</TableCell>
                            <TableCell align="right">Prise en charge État</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {run.lines.map((line) => (
                            <TableRow key={line.id}>
                              <TableCell>{line.employee.fullName}</TableCell>
                              <TableCell align="right">
                                <Money value={line.grossSalary} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={line.employeeCnss} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={line.incomeTax} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={line.netSalary} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={line.employerCnss} />
                              </TableCell>
                              <TableCell align="right">
                                <Money value={line.employerSupportAmount} />
                                {Number(line.employerSupportRate) > 0 && (
                                  <Typography variant="caption" sx={{ display: "block" }}>
                                    {(Number(line.employerSupportRate) * 100).toFixed(0)} %
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
          {tab === 2 && (
            <>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  type="number"
                  label="Année"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
                <TextField
                  select
                  size="small"
                  label="Trimestre"
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((q) => (
                    <MenuItem key={q} value={q}>
                      T{q}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <QueryState
                loading={cnss.isLoading}
                error={cnss.isError}
                empty={!cnss.data?.employees.length}
                emptyText="Aucune paie validée pour ce trimestre."
              />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Salarié</TableCell>
                    <TableCell>N° CNSS</TableCell>
                    <TableCell align="right">Assiette brute</TableCell>
                    <TableCell align="right">Part salarié</TableCell>
                    <TableCell align="right">Part employeur</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cnss.data?.employees.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>{row.cnssNumber || "Manquant"}</TableCell>
                      <TableCell align="right">
                        <Money value={row.grossSalary} />
                      </TableCell>
                      <TableCell align="right">
                        <Money value={row.employeeCnss} />
                      </TableCell>
                      <TableCell align="right">
                        <Money value={row.employerCnss} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={employeeOpen}
        onClose={() => setEmployeeOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nouveau salarié</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom complet"
              value={employee.fullName}
              onChange={(e) =>
                setEmployee({ ...employee, fullName: e.target.value })
              }
            />
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                label="CIN"
                value={employee.cin}
                onChange={(e) =>
                  setEmployee({ ...employee, cin: e.target.value })
                }
              />
              <TextField
                fullWidth
                label="N° CNSS"
                value={employee.cnssNumber}
                onChange={(e) =>
                  setEmployee({ ...employee, cnssNumber: e.target.value })
                }
              />
            </Stack>
            <TextField
              type="date"
              label="Date d’embauche"
              value={employee.hireDate}
              onChange={(e) =>
                setEmployee({ ...employee, hireDate: e.target.value })
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label="Contrat"
              value={employee.contractType}
              onChange={(e) =>
                setEmployee({ ...employee, contractType: e.target.value })
              }
            >
              {["CDI", "CDD", "SIVP", "STAGE", "AUTRE"].map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Salaire brut mensuel (TND)"
              value={employee.grossSalary}
              onChange={(e) =>
                setEmployee({ ...employee, grossSalary: e.target.value })
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={employee.isHigherEducationGraduate}
                  onChange={(e) =>
                    setEmployee({
                      ...employee,
                      isHigherEducationGraduate: e.target.checked,
                      employerSupportEligible: e.target.checked
                        ? employee.employerSupportEligible
                        : false,
                    })
                  }
                />
              }
              label="Diplômé de l’enseignement supérieur"
            />
            {employee.isHigherEducationGraduate && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={employee.employerSupportEligible}
                      onChange={(e) =>
                        setEmployee({
                          ...employee,
                          employerSupportEligible: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Éligibilité à la prise en charge patronale vérifiée (LF 2026, art. 13)"
                />
                {employee.employerSupportEligible && (
                  <>
                    <TextField
                      type="date"
                      label="Début de la prise en charge"
                      value={employee.employerSupportStartDate}
                      onChange={(e) =>
                        setEmployee({
                          ...employee,
                          employerSupportStartDate: e.target.value,
                        })
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <Alert severity="warning">
                      Activez cette aide uniquement après vérification des conditions et conservation du justificatif.
                    </Alert>
                  </>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmployeeOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={
              !employee.fullName ||
              !employee.grossSalary ||
              saveEmployee.isPending
            }
            onClick={() => saveEmployee.mutate()}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={runOpen} onClose={() => setRunOpen(false)}>
        <DialogTitle>Calculer une paie</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <TextField
              type="number"
              label="Année"
              value={period.periodYear}
              onChange={(e) =>
                setPeriod({ ...period, periodYear: Number(e.target.value) })
              }
            />
            <TextField
              select
              label="Mois"
              value={period.periodMonth}
              onChange={(e) =>
                setPeriod({ ...period, periodMonth: Number(e.target.value) })
              }
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Les taux CNSS et le barème IRPP applicables seront pris
            automatiquement dans les paramètres fiscaux.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
          >
            Calculer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
