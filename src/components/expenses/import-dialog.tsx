"use client";

import { useRef, useState } from "react";
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
import { formatCurrencyPrecise } from "@/lib/utils";

type PreviewRow = {
  date: string;
  account: string;
  description: string;
  category: string | null;
  tags: string[];
  amount: number;
  status: "new" | "duplicate";
  accountKnown: boolean;
  matchedCategory: string | null;
};

type PreviewResponse = {
  preview: PreviewRow[];
  summary: {
    total: number;
    new: number;
    duplicates: number;
    unknownAccounts: string[];
  };
};

/**
 * Joins several exports into one CSV body, dropping the repeated header row so
 * a month's worth of cards can be imported in a single pass.
 */
function combineCsvFiles(files: string[]): string {
  const blocks = files.map((file) => file.trim()).filter((file) => file.length > 0);
  if (blocks.length === 0) return "";

  const [first, ...rest] = blocks;
  const header = first.split(/\r?\n/)[0]?.trim().toLowerCase();

  const tails = rest.map((block) => {
    const lines = block.split(/\r?\n/);
    if (lines[0]?.trim().toLowerCase() === header) {
      return lines.slice(1).join("\n");
    }
    return block;
  });

  return [first, ...tails].filter(Boolean).join("\n");
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /** Clearing on close means the next open always starts blank. */
  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function reset() {
    setContent("");
    setFileNames([]);
    setPreview(null);
    setMessage(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const contents = await Promise.all(files.map((file) => file.text()));

    setContent(combineCsvFiles(contents));
    setFileNames(files.map((file) => file.name));
    setPreview(null);
    setMessage(null);
  }

  async function handlePreview() {
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage({ tone: "error", text: data.error ?? "Preview failed." });
      setPreview(null);
    } else {
      setPreview(data);
    }

    setLoading(false);
  }

  async function handleConfirm() {
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage({ tone: "error", text: data.error ?? "Import failed." });
      setLoading(false);
      return;
    }

    setLoading(false);
    handleOpenChange(false);
    await onImported();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Upload one or more card exports. Duplicates are detected by date,
            account, description, and amount — importing the same file twice is
            safe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-files">CSV files</Label>
            <input
              id="csv-files"
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
              className="block w-full cursor-pointer rounded-lg border border-input bg-card p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {fileNames.length > 0 ? (
              <p className="text-xs text-muted-foreground">{fileNames.join(", ")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-content">Or paste CSV contents</Label>
            <Textarea
              id="csv-content"
              rows={6}
              placeholder="Date,Account,Description,Category,Tags,Amount"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>

          {preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{preview.summary.total} rows</Badge>
                <Badge variant="success">{preview.summary.new} new</Badge>
                <Badge variant="secondary">
                  {preview.summary.duplicates} duplicate
                </Badge>
                {preview.summary.unknownAccounts.length > 0 ? (
                  <Badge variant="warning">
                    {preview.summary.unknownAccounts.length} unknown account
                    {preview.summary.unknownAccounts.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>

              {preview.summary.unknownAccounts.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  No account matches {preview.summary.unknownAccounts.join(", ")}.
                  Those rows import with no account, which means they split evenly
                  across everyone. Add the accounts in Settings first to attribute
                  them properly.
                </p>
              ) : null}

              <div className="max-h-[280px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((row, index) => (
                      <TableRow key={`${row.date}-${row.description}-${index}`}>
                        <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                        <TableCell>
                          {row.account}
                          {row.accountKnown ? null : (
                            <Badge variant="warning" className="ml-2">
                              unknown
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          {row.category ?? "—"}
                          {row.category && !row.matchedCategory ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (new)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyPrecise(row.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "duplicate" ? "secondary" : "success"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {message ? (
            <p
              className={
                message.tone === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-primary"
              }
            >
              {message.text}
            </p>
          ) : null}
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
            disabled={!preview || loading || preview.summary.new === 0}
          >
            Import {preview ? `${preview.summary.new} new` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
