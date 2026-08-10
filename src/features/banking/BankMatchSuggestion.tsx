import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import {
  ArrowRightAltRounded,
  CheckCircleRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import type { BankPaymentSuggestion, BankTransaction } from "../../types/api";

const money = (value: string) =>
  new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(Number(value));

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("fr-TN", { day: "2-digit", month: "short" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );

/**
 * Ligne de relevé face au règlement que la comptabilité connaît déjà.
 *
 * Le rapprochement se joue sur une seule question : « est-ce bien la même
 * opération ? ». La mettre à plat — relevé à gauche, pièce à droite, écart au
 * milieu — évite d'aller chercher la contrepartie dans le grand livre. Un
 * montant différent n'est jamais présenté comme certain.
 */
export function BankMatchSuggestion({
  transaction,
  onMatch,
  pending,
  disabled,
}: {
  transaction: BankTransaction;
  onMatch: (suggestion: BankPaymentSuggestion) => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  const suggestions = transaction.paymentSuggestions ?? [];
  if (!suggestions.length) return null;
  const [best, ...others] = suggestions;
  const confident = best.exactAmount && best.confidence >= 80;

  return (
    <Box
      sx={{
        mt: 1.5,
        border: "1px solid",
        borderColor: confident ? "success.main" : "warning.main",
        borderRadius: 2,
        bgcolor: "grey.50",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr auto 1fr" },
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Ligne du relevé
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
            {transaction.description}
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 15, mt: 0.25 }}>
            {money(transaction.amount)}
          </Typography>
        </Box>

        <Stack sx={{ alignItems: "center" }} spacing={0.5}>
          {confident ? (
            <CheckCircleRounded sx={{ fontSize: 18, color: "success.main" }} />
          ) : (
            <WarningAmberRounded sx={{ fontSize: 18, color: "warning.main" }} />
          )}
          <Chip
            size="small"
            label={`${best.confidence} %`}
            color={confident ? "success" : "warning"}
            variant="outlined"
          />
          <ArrowRightAltRounded
            sx={{
              fontSize: 18,
              color: "text.disabled",
              display: { xs: "none", sm: "block" },
            }}
          />
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Règlement comptabilisé
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
            {best.thirdPartyName ?? best.reference ?? "Règlement"}
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 15, mt: 0.25 }}>
            {money(best.amount)}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Button
          size="small"
          variant="contained"
          color={confident ? "success" : "warning"}
          disabled={disabled || pending}
          onClick={() => onMatch(best)}
        >
          Rapprocher
        </Button>
        <Typography variant="caption" color="text.secondary">
          {shortDate(best.paymentDate)}
          {best.reference ? ` · ${best.reference}` : ""} ·{" "}
          {best.reasons.join(" · ")}
        </Typography>
        {others.length > 0 && (
          <>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {others.length} autre{others.length > 1 ? "s" : ""} candidat
              {others.length > 1 ? "s" : ""}
            </Typography>
            {others.map((item) => (
              <Button
                key={item.paymentId}
                size="small"
                disabled={disabled || pending}
                onClick={() => onMatch(item)}
              >
                {item.thirdPartyName ?? item.reference ?? "Règlement"} ·{" "}
                {item.confidence} %
              </Button>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}
