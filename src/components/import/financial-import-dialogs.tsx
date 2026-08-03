"use client";

import {
  CsvImportDialog,
  type ImportRow,
} from "@/components/import/csv-import-dialog";
import { Badge } from "@/components/ui/table";
import {
  ASSET_LABELS,
  formatCurrencyPrecise,
  formatMonthLabel,
  LIABILITY_LABELS,
} from "@/lib/utils";

type PaycheckPreviewRow = ImportRow & {
  month: string;
  person: string;
  company: string;
  grossIncome: number;
  taxes: number;
  retirement401k: number;
  hsa: number;
  companyNew: boolean;
};

export function PaycheckImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}) {
  return (
    <CsvImportDialog<PaycheckPreviewRow>
      open={open}
      onOpenChange={onOpenChange}
      onImported={onImported}
      title="Import Paychecks"
      description="One row per person, company and month. A month already recorded is overwritten, so re-importing a corrected file is safe."
      templateHeader="Month,Person,Company,Annual Salary,Gross,Medical,Dental & Vision,401k,HSA,Taxes,Notes"
      previewUrl="/api/import/paychecks/preview"
      confirmUrl="/api/import/paychecks/confirm"
      columns={[
        {
          header: "Month",
          render: (row) => (row.error ? row.month : formatMonthLabel(row.month)),
        },
        { header: "Person", render: (row) => row.person || "—" },
        {
          header: "Company",
          render: (row) => (
            <>
              {row.company || "—"}
              {row.companyNew ? (
                <span className="ml-1 text-xs text-muted-foreground">(new)</span>
              ) : null}
            </>
          ),
        },
        {
          header: "Gross",
          align: "right",
          render: (row) => formatCurrencyPrecise(row.grossIncome),
        },
        {
          header: "Taxes",
          align: "right",
          render: (row) => formatCurrencyPrecise(row.taxes),
        },
        {
          header: "401k / HSA",
          align: "right",
          render: (row) =>
            formatCurrencyPrecise(row.retirement401k + row.hsa),
        },
      ]}
    />
  );
}

type NetWorthPreviewRow = ImportRow & {
  month: string;
  account: string;
  type: string | null;
  kind: "asset" | "liability" | null;
  person: string;
  amount: number;
};

export function NetWorthImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}) {
  return (
    <CsvImportDialog<NetWorthPreviewRow>
      open={open}
      onOpenChange={onOpenChange}
      onImported={onImported}
      title="Import Net Worth"
      description="One row per account, holder and month. Use Combined for jointly held accounts. Each month in the file replaces that month's balances outright."
      templateHeader="Month,Account,Person,Amount"
      previewUrl="/api/import/net-worth/preview"
      confirmUrl="/api/import/net-worth/confirm"
      columns={[
        {
          header: "Month",
          render: (row) => (row.error ? row.month : formatMonthLabel(row.month)),
        },
        {
          header: "Account",
          render: (row) => {
            if (!row.type) return row.account;
            const label =
              row.kind === "asset"
                ? ASSET_LABELS[row.type]
                : LIABILITY_LABELS[row.type];
            return (
              <>
                {label ?? row.account}
                {row.kind === "liability" ? (
                  <Badge variant="outline" className="ml-2">
                    liability
                  </Badge>
                ) : null}
              </>
            );
          },
        },
        { header: "Person", render: (row) => row.person || "Combined" },
        {
          header: "Amount",
          align: "right",
          render: (row) => formatCurrencyPrecise(row.amount),
        },
      ]}
    />
  );
}
