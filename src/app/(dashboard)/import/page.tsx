"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatCard } from "@/components/charts/dashboard-charts";
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
  const blocks = files
    .map((file) => file.trim())
    .filter((file) => file.length > 0);

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

export default function ImportPage() {
  const [content, setContent] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const contents = await Promise.all(files.map((file) => file.text()));

    setContent(combineCsvFiles(contents));
    setFileNames(files.map((file) => file.name));
    setPreview(null);
    setMessage({
      tone: "ok",
      text: `Loaded ${files.length} file${files.length === 1 ? "" : "s"}. Review below, then preview the import.`,
    });
  }

  function reset() {
    setContent("");
    setFileNames([]);
    setPreview(null);
    setMessage(null);
    if (fileInput.current) fileInput.current.value = "";
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
    } else {
      reset();
      setMessage({
        tone: "ok",
        text: `Imported ${data.created} transactions. Skipped ${data.skipped} duplicates.`,
      });
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">CSV Import</h2>
        <p className="text-sm text-muted-foreground">
          Upload monthly expense CSVs, review what is new versus duplicate, then
          confirm.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSVs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-files">Choose one or more CSV files</Label>
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
              <p className="text-xs text-muted-foreground">
                {fileNames.join(", ")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-content">CSV contents (editable)</Label>
            <Textarea
              id="csv-content"
              rows={10}
              placeholder="Date,Account,Description,Category,Tags,Amount"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePreview} disabled={!content || loading}>
              Preview Import
            </Button>
            <Button
              variant="secondary"
              onClick={handleConfirm}
              disabled={!preview || loading || preview.summary.new === 0}
            >
              Confirm Import
            </Button>
            <Button variant="outline" onClick={reset} disabled={loading || !content}>
              Clear
            </Button>
          </div>

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
        </CardContent>
      </Card>

      {preview ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Rows" value={String(preview.summary.total)} />
            <StatCard label="New" value={String(preview.summary.new)} />
            <StatCard label="Duplicates" value={String(preview.summary.duplicates)} />
            <StatCard
              label="Unknown Accounts"
              value={String(preview.summary.unknownAccounts.length)}
            />
          </div>

          {preview.summary.unknownAccounts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Unknown Accounts</CardTitle>
                <p className="text-sm text-muted-foreground">
                  These names have no matching account. Their transactions import as
                  shared with no card attached — add the accounts in Settings first if
                  you want them attributed.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {preview.summary.unknownAccounts.map((account) => (
                  <Badge key={account} variant="warning">
                    {account}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Tags</TableHead>
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
                          <p className="text-xs text-muted-foreground">will be created</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {row.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(row.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "duplicate" ? "secondary" : "success"}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
