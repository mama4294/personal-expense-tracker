"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OWNER_LABELS } from "@/lib/utils";

type AccountOwner = "MATTHEW" | "GENEVIEVE" | "SHARED";

type Account = {
  id: string;
  name: string;
  owner: AccountOwner;
  matthewSplitPercent: number;
  genevieveSplitPercent: number;
};

type Category = {
  id: string;
  name: string;
  excludedFromFi: boolean;
};

type Message = { tone: "error" | "ok"; text: string } | null;

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [withdrawalRate, setWithdrawalRate] = useState("0.04");
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);

  // Draft copies so a row can be edited and then saved explicitly.
  const [accountDrafts, setAccountDrafts] = useState<Record<string, Account>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});

  const [newAccount, setNewAccount] = useState({
    name: "",
    owner: "SHARED" as AccountOwner,
    matthewSplitPercent: "50",
  });
  const [newCategory, setNewCategory] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  const loadSettings = useCallback(async () => {
    const [accountResponse, settingsResponse] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/settings"),
    ]);

    if (!accountResponse.ok || !settingsResponse.ok) {
      setMessage({ tone: "error", text: "Could not load settings." });
      return;
    }

    const accountData: Account[] = await accountResponse.json();
    const settingsData = await settingsResponse.json();

    setAccounts(accountData);
    setAccountDrafts(
      Object.fromEntries(accountData.map((account) => [account.id, account])),
    );
    setCategories(settingsData.categories ?? []);
    setCategoryDrafts(
      Object.fromEntries(
        (settingsData.categories ?? []).map((category: Category) => [
          category.id,
          category.name,
        ]),
      ),
    );
    setWithdrawalRate(String(settingsData.settings?.withdrawalRate ?? 0.04));
  }, []);

  useEffect(() => {
    async function run() {
      await loadSettings();
    }
    run();
  }, [loadSettings]);

  /** Runs a mutation, surfaces the server's message, and refreshes on success. */
  async function mutate(
    url: string,
    init: RequestInit,
    successText: string,
  ): Promise<boolean> {
    setSaving(true);
    setMessage(null);

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage({ tone: "error", text: data.error ?? "Something went wrong." });
      setSaving(false);
      return false;
    }

    setMessage({ tone: "ok", text: successText });
    await loadSettings();
    setSaving(false);
    return true;
  }

  async function addAccount() {
    const matthew = Math.min(
      Math.max(Number(newAccount.matthewSplitPercent) || 0, 0),
      100,
    );
    const created = await mutate(
      "/api/accounts",
      {
        method: "POST",
        body: JSON.stringify({
          name: newAccount.name,
          owner: newAccount.owner,
          matthewSplitPercent:
            newAccount.owner === "SHARED"
              ? matthew
              : newAccount.owner === "MATTHEW"
                ? 100
                : 0,
          genevieveSplitPercent:
            newAccount.owner === "SHARED"
              ? 100 - matthew
              : newAccount.owner === "GENEVIEVE"
                ? 100
                : 0,
        }),
      },
      "Account added.",
    );

    if (created) {
      setNewAccount({ name: "", owner: "SHARED", matthewSplitPercent: "50" });
    }
  }

  async function saveAccount(draft: Account) {
    await mutate(
      `/api/accounts/${draft.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          owner: draft.owner,
          matthewSplitPercent: draft.matthewSplitPercent,
          genevieveSplitPercent: draft.genevieveSplitPercent,
        }),
      },
      "Account updated.",
    );
  }

  async function deleteAccount(account: Account) {
    if (!window.confirm(`Delete ${account.name}?`)) return;
    await mutate(
      `/api/accounts/${account.id}`,
      { method: "DELETE" },
      "Account deleted.",
    );
  }

  async function addCategory() {
    const created = await mutate(
      "/api/categories",
      { method: "POST", body: JSON.stringify({ name: newCategory }) },
      "Category added.",
    );
    if (created) setNewCategory("");
  }

  async function renameCategory(category: Category) {
    const name = categoryDrafts[category.id]?.trim();
    if (!name || name === category.name) return;
    await mutate(
      `/api/categories/${category.id}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
      "Category renamed.",
    );
  }

  async function mergeCategory(category: Category) {
    const targetCategoryId = mergeTargets[category.id];
    if (!targetCategoryId) {
      setMessage({ tone: "error", text: "Pick a category to merge into." });
      return;
    }

    const target = categories.find((item) => item.id === targetCategoryId);
    if (
      !window.confirm(
        `Move every ${category.name} transaction into ${target?.name} and delete ${category.name}?`,
      )
    ) {
      return;
    }

    await mutate(
      `/api/categories/${category.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "merge", targetCategoryId }),
      },
      `Merged into ${target?.name}.`,
    );
  }

  async function splitCategory(category: Category) {
    const newCategoryName = window.prompt(
      `Split ${category.name}: name the new category to move transactions into.`,
    );
    if (!newCategoryName?.trim()) return;

    await mutate(
      `/api/categories/${category.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "split", newCategoryName: newCategoryName.trim() }),
      },
      `Created ${newCategoryName.trim()}. Reassign transactions from the Expenses page.`,
    );
  }

  async function deleteCategory(category: Category) {
    if (
      !window.confirm(
        `Delete ${category.name}? Its transactions become uncategorized.`,
      )
    ) {
      return;
    }

    await mutate(
      `/api/categories/${category.id}`,
      { method: "DELETE" },
      "Category deleted.",
    );
  }

  async function saveFiSettings() {
    await mutate(
      "/api/settings",
      {
        method: "PATCH",
        body: JSON.stringify({
          withdrawalRate: Number(withdrawalRate),
          categoryFiExclusions: categories.map((category) => ({
            id: category.id,
            excludedFromFi: category.excludedFromFi,
          })),
        }),
      },
      "FI settings saved.",
    );
  }

  async function savePassword() {
    const updated = await mutate(
      "/api/settings",
      {
        method: "PATCH",
        body: JSON.stringify({ action: "change-password", ...passwordForm }),
      },
      "Password updated.",
    );
    if (updated) setPasswordForm({ currentPassword: "", newPassword: "" });
  }

  const byOwner = (owner: AccountOwner) =>
    accounts.filter((account) => account.owner === owner);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage accounts, categories, FI assumptions, and your profile.
        </p>
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

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="fi">FI Settings</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            {(["MATTHEW", "GENEVIEVE", "SHARED"] as AccountOwner[]).map((owner) => (
              <Card key={owner}>
                <CardHeader>
                  <CardTitle>
                    {owner === "SHARED"
                      ? "Shared Cards"
                      : `${OWNER_LABELS[owner]}'s Cards`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {byOwner(owner).map((account) => (
                    <div key={account.id} className="rounded-lg border p-3 text-sm">
                      {account.name}
                      {owner === "SHARED" ? (
                        <p className="text-xs text-muted-foreground">
                          Split {account.matthewSplitPercent}/
                          {account.genevieveSplitPercent}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {byOwner(owner).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No accounts yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Edit Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Matthew %</TableHead>
                    <TableHead>Genevieve %</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const draft = accountDrafts[account.id] ?? account;
                    const isShared = draft.owner === "SHARED";

                    return (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Input
                            value={draft.name}
                            onChange={(event) =>
                              setAccountDrafts({
                                ...accountDrafts,
                                [account.id]: { ...draft, name: event.target.value },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={draft.owner}
                            onValueChange={(value) => {
                              const owner = value as AccountOwner;
                              setAccountDrafts({
                                ...accountDrafts,
                                [account.id]: {
                                  ...draft,
                                  owner,
                                  matthewSplitPercent:
                                    owner === "MATTHEW"
                                      ? 100
                                      : owner === "GENEVIEVE"
                                        ? 0
                                        : draft.matthewSplitPercent,
                                  genevieveSplitPercent:
                                    owner === "GENEVIEVE"
                                      ? 100
                                      : owner === "MATTHEW"
                                        ? 0
                                        : draft.genevieveSplitPercent,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="min-w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MATTHEW">Matthew</SelectItem>
                              <SelectItem value="GENEVIEVE">Genevieve</SelectItem>
                              <SelectItem value="SHARED">Shared</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="max-w-[100px]"
                            disabled={!isShared}
                            value={draft.matthewSplitPercent}
                            onChange={(event) => {
                              const matthew = Math.min(
                                Math.max(Number(event.target.value) || 0, 0),
                                100,
                              );
                              setAccountDrafts({
                                ...accountDrafts,
                                [account.id]: {
                                  ...draft,
                                  matthewSplitPercent: matthew,
                                  genevieveSplitPercent: 100 - matthew,
                                },
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {draft.genevieveSplitPercent}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={saving}
                              onClick={() => saveAccount(draft)}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${account.name}`}
                              disabled={saving}
                              onClick={() => deleteAccount(account)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Add Account</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Credit Card - 9939"
                  value={newAccount.name}
                  onChange={(event) =>
                    setNewAccount({ ...newAccount, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select
                  value={newAccount.owner}
                  onValueChange={(value) =>
                    setNewAccount({ ...newAccount, owner: value as AccountOwner })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATTHEW">Matthew</SelectItem>
                    <SelectItem value="GENEVIEVE">Genevieve</SelectItem>
                    <SelectItem value="SHARED">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newAccount.owner === "SHARED" ? (
                <div className="space-y-2">
                  <Label>Matthew split %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newAccount.matthewSplitPercent}
                    onChange={(event) =>
                      setNewAccount({
                        ...newAccount,
                        matthewSplitPercent: event.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Genevieve takes the remaining{" "}
                    {100 - (Number(newAccount.matthewSplitPercent) || 0)}%.
                  </p>
                </div>
              ) : null}
              <div className="flex items-end">
                <Button onClick={addAccount} disabled={saving || !newAccount.name}>
                  Add Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rename in place, merge one category into another, or split off a new
                category and reassign transactions from the Expenses page.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Excluded from FI</TableHead>
                    <TableHead>Merge into</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Input
                          value={categoryDrafts[category.id] ?? category.name}
                          onChange={(event) =>
                            setCategoryDrafts({
                              ...categoryDrafts,
                              [category.id]: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{category.excludedFromFi ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Select
                          value={mergeTargets[category.id] ?? "none"}
                          onValueChange={(value) =>
                            setMergeTargets({
                              ...mergeTargets,
                              [category.id]: value === "none" ? "" : value,
                            })
                          }
                        >
                          <SelectTrigger className="min-w-[160px]">
                            <SelectValue placeholder="Choose category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {categories
                              .filter((option) => option.id !== category.id)
                              .map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={saving}
                            onClick={() => renameCategory(category)}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving || !mergeTargets[category.id]}
                            onClick={() => mergeCategory(category)}
                          >
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => splitCategory(category)}
                          >
                            Split
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${category.name}`}
                            disabled={saving}
                            onClick={() => deleteCategory(category)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Add Category</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Input
                className="max-w-xs"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Category name"
              />
              <Button onClick={addCategory} disabled={saving || !newCategory}>
                Add
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fi" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>FI Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Withdrawal Rate</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.01"
                  max="0.2"
                  className="max-w-[160px]"
                  value={withdrawalRate}
                  onChange={(event) => setWithdrawalRate(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  0.04 is the standard 4% rule. FI number = annual spending ÷ rate.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Excluded Categories</Label>
                <p className="text-xs text-muted-foreground">
                  Excluded categories are left out of the trailing 12-month spending
                  used for the FI number.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={category.excludedFromFi}
                        onChange={(event) =>
                          setCategories((current) =>
                            current.map((item) =>
                              item.id === category.id
                                ? { ...item, excludedFromFi: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={saveFiSettings} disabled={saving}>
                Save FI Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: event.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={savePassword}
                  disabled={
                    saving ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword
                  }
                >
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
