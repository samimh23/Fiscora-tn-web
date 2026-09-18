import { Autocomplete, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  size = "medium",
  helperText,
  error = false,
  placeholder = "Rechercher…",
  sx,
}: {
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  helperText?: string;
  error?: boolean;
  placeholder?: string;
  sx?: SxProps<Theme>;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_, option) => onChange(option?.value ?? "")}
      getOptionLabel={(option) => option.label}
      getOptionDisabled={(option) => Boolean(option.disabled)}
      isOptionEqualToValue={(option, candidate) =>
        option.value === candidate.value
      }
      autoHighlight
      openOnFocus
      clearOnEscape
      disabled={disabled}
      noOptionsText="Aucun résultat"
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          size={size}
          helperText={helperText}
          error={error}
          placeholder={placeholder}
        />
      )}
    />
  );
}
