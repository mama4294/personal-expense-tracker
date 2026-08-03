"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ImportRow = {
  line: number;
  status: "new" | "update" | "error";
  error: string | null;
};

export type ImportSummary = {
  total: number;
  create: number;
  update: number;
  errors: number;
  warnings: string[];
};

export type ImportColumn<Row> = {
  header: string;
  align?: "right";
  render: (row: Row) => ReactNode;
};

/**
 * Preview-then-confirm shell for the CSV importers that write one record per
 * month. The transaction importer stays separate: its notion of a repeat row is
 * "already imported, skip", while these are "already recorded, overwrite".
 */
export function CsvImportDialog<Row extends ImportRow>({
  open,
  onOpenChange,
  onImported,
  title,
  description,
  templateHeader,
  previewUrl,
  confirmUrl,
  columns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
  title: string;
  description: string;
  /** Shown as the textarea placeholder and offered as a downloadable header. */
  templateHeader: string;
  previewUrl: string;
  confirmUrl: string;
  columns: ImportColumn<Row>[];
}) {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    preview: Row[];
    summary: ImportSummary;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setContent("");
    setFileName(null);
    setPreview(null);
    setMessage(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setContent(await file.text());
    setFileName(file.name);
    setPreview(null);
    setMessage(null);
  }

  async function post(url: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  }

  async function handlePreview() {
    setLoading(true);
    setMessage(null);

    const { ok, data } = await post(previewUrl);
    if (!ok) {
      setMessage(data.error ?? "Preview failed.");
      setPreview(null);
    } else {
      setPreview(data);
    }

    setLoading(false);
  }

  async function handleConfirm() {
    setLoading(true);
    setMessage(null);

    const { ok, data } = await post(confirmUrl);
    if (!ok) {
      setMessage(data.error ?? "Import failed.");
      setLoading(false);
      return;
    }

    setLoading(false);
    handleOpenChange(false);
    await onImported();
  }

  const summary = preview?.summary;
  // Nothing partially applies, so a single bad row blocks the whole file rather
  // than importing most of it and leaving the user to find the gap.
  const blocked = (summary?.errors ?? 0) > 0;
  const willWrite = (summary?.create ?? 0) + (summary?.update ?? 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">CSV file</Label>
            <input
              id="import-file"
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFile(event.target.files)}
              className="block w-full cursor-pointer rounded-lg border border-input bg-card p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {fileName ? (
              <p className="text-xs text-muted-foreground">{fileName}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-content">Or paste CSV contents</Label>
            <Textarea
              id="import-content"
              rows={5}
              placeholder={templateHeader}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setPreview(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Columns: <code>{templateHeader}</code>
            </p>
          </div>

          {summary ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{summary.total} rows</Badge>
                <Badge variant="success">{summary.create} new</Badge>
                <Badge variant="secondary">{summary.update} updated</Badge>
                {summary.errors > 0 ? (
                  <Badge variant="warning">{summary.errors} with errors</Badge>
                ) : null}
              </div>

              {summary.warnings.map((warning) => (
                <p key={warning} className="text-xs text-muted-foreground">
                  {warning}
                </p>
              ))}

              {blocked ? (
                <p className="text-sm text-destructive">
                  Fix the rows marked below and preview again. Nothing is
                  imported while any row has an error.
                </p>
              ) : null}

              <div className="max-h-[280px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      {columns.map((column) => (
                        <TableHead
                          key={column.header}
                          className={column.align === "right" ? "text-right" : undefined}
                        >
                          {column.header}
                        </TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((row) => (
                      <TableRow key={row.line}>
                        <TableCell className="text-muted-foreground">
                          {row.line}
                        </TableCell>
                        {columns.map((column) => (
                          <TableCell
                            key={column.header}
                            className={
                              column.align === "right"
                                ? "text-right tabular-nums"
                                : undefined
                            }
                          >
                            {column.render(row)}
                          </TableCell>
                        ))}
                        <TableCell>
                          {row.status === "error" ? (
                            <span className="text-xs text-destructive">
                              {row.error}
                            </span>
                          ) : (
                            <Badge
                              variant={
                                row.status === "update" ? "secondary" : "success"
                              }
                            >
                              {row.status}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {message ? <p className="text-sm text-destructive">{message}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={reset} disabled={loading || !content}>
            Clear
          </Button>
          <Button onClick={handlePreview} disabled={!content || loading}>
            Preview
          </Button>
          <Button
            variant="secondary"
            onClick={handleConfirm}
            disabled={!preview || loading || blocked || willWrite === 0}
          >
            Import {preview && !blocked ? `${willWrite} row${willWrite === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
