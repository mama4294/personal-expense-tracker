"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  RowActions,
} from "@/components/ui/dropdown-menu";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColorDot } from "@/components/settings/color-picker";
import {
  AccountDialog,
  CategoryDialog,
  CompanyDialog,
  LoginDialog,
  MergeCategoryDialog,
  PasswordDialog,
  PersonDialog,
  SplitCategoryDialog,
} from "@/components/settings/settings-dialogs";
import {
  describeSplitRows,
  type Person,
  type SplitRow,
} from "@/components/people/split-editor";
import { colorLabel, personColor } from "@/lib/colors";
import { accountLabel } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  nickname: string | null;
  splits: SplitRow[];
};
type Category = { id: string; name: string; excludedFromFi: boolean };
type Login = { id: string; username: string; name: string; createdAt: string };
type Company = {
  id: string;
  name: string;
  personId: string;
  isActive: boolean;
  person: { id: string; name: string };
};

type Message = { tone: "error" | "ok"; text: string } | null;

/** Which dialog is open, and on what. */
type DialogState =
  | { kind: "none" }
  | { kind: "person"; person: Person | null }
  | { kind: "company"; company: Company | null; defaultPersonId?: string }
  | { kind: "account"; account: Account | null }
  | { kind: "category"; category: Category | null }
  | { kind: "merge"; category: Category }
  | { kind: "split"; category: Category }
  | { kind: "login" }
  | { kind: "password" };

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [logins, setLogins] = useState<Login[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [withdrawalRate, setWithdrawalRate] = useState("0.04");
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

  const activePeople = people.filter((person) => person.isActive);
  const close = () => setDialog({ kind: "none" });

  const loadSettings = useCallback(async () => {
    const [
      accountResponse,
      settingsResponse,
      peopleResponse,
      loginResponse,
      companyResponse,
    ] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/settings"),
      fetch("/api/people"),
      fetch("/api/users"),
      fetch("/api/companies"),
    ]);

    if (
      !accountResponse.ok ||
      !settingsResponse.ok ||
      !peopleResponse.ok ||
      !loginResponse.ok ||
      !companyResponse.ok
    ) {
      setMessage({ tone: "error", text: "Could not load settings." });
      return;
    }

    const settingsData = await settingsResponse.json();

    setAccounts(await accountResponse.json());
    setCategories(settingsData.categories ?? []);
    setWithdrawalRate(String(settingsData.settings?.withdrawalRate ?? 0.04));
    setCurrentUserId(settingsData.user?.id ?? null);
    setPeople(await peopleResponse.json());
    setLogins(await loginResponse.json());
    setCompanies(await companyResponse.json());
  }, []);

  useEffect(() => {
    async function run() {
      await loadSettings();
    }
    run();
  }, [loadSettings]);

  /**
   * Shared mutation path. Dialogs need the error back to display inline, while
   * row actions just want the banner — so it returns the result either way.
   */
  async function mutate(
    url: string,
    init: RequestInit,
    successText: string,
  ): Promise<{ ok: boolean; error?: string }> {
    setSaving(true);
    setMessage(null);

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = data.error ?? "Something went wrong.";
      setMessage({ tone: "error", text: error });
      setSaving(false);
      return { ok: false, error };
    }

    setMessage({ tone: "ok", text: successText });
    await loadSettings();
    setSaving(false);
    return { ok: true };
  }

  const confirmThen = (question: string, run: () => Promise<unknown>) => {
    if (window.confirm(question)) void run();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage people, companies, logins, accounts, categories, and FI
          assumptions.
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

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="fi">FI Settings</TabsTrigger>
          <TabsTrigger value="logins">Logins</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        {/* --- People --- */}
        <TabsContent value="people">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>People</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Everyone expenses are split between. People don&apos;t sign in —
                  they carry shares and a colour used across the charts.
                </p>
              </div>
              <Button onClick={() => setDialog({ kind: "person", person: null })}>
                <Plus className="h-4 w-4" />
                Add Person
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Colour</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <ColorDot color={personColor(person.color)} />
                          {person.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-10 rounded"
                            style={{
                              backgroundColor: personColor(person.color),
                            }}
                            aria-hidden
                          />
                          {/* The swatch alone leaves this column empty for
                              screen readers. */}
                          <span className="text-sm text-muted-foreground">
                            {colorLabel(person.color)}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.isActive ? "success" : "secondary"}>
                          {person.isActive ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions label={`Actions for ${person.name}`} disabled={saving}>
                          <DropdownMenuItem
                            onSelect={() => setDialog({ kind: "person", person })}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              void mutate(
                                `/api/people/${person.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({ isActive: !person.isActive }),
                                },
                                person.isActive
                                  ? `${person.name} deactivated.`
                                  : `${person.name} reactivated.`,
                              )
                            }
                          >
                            {person.isActive ? "Deactivate" : "Reactivate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              confirmThen(`Delete ${person.name}?`, () =>
                                mutate(
                                  `/api/people/${person.id}`,
                                  { method: "DELETE" },
                                  `${person.name} deleted.`,
                                ),
                              )
                            }
                          >
                            Delete
                          </DropdownMenuItem>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                  {people.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No people yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Companies --- */}
        <TabsContent value="companies">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Companies</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Where each person earns. Left a job? Mark it past — the pay
                  history stays.
                </p>
              </div>
              <Button
                disabled={activePeople.length === 0}
                onClick={() =>
                  setDialog({
                    kind: "company",
                    company: null,
                    defaultPersonId: activePeople[0]?.id,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add Company
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.person.name}</TableCell>
                      <TableCell>
                        <Badge variant={company.isActive ? "success" : "secondary"}>
                          {company.isActive ? "current" : "past"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          label={`Actions for ${company.name}`}
                          disabled={saving}
                        >
                          <DropdownMenuItem
                            onSelect={() => setDialog({ kind: "company", company })}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              void mutate(
                                `/api/companies/${company.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({ isActive: !company.isActive }),
                                },
                                company.isActive
                                  ? `${company.name} marked as past.`
                                  : `${company.name} reactivated.`,
                              )
                            }
                          >
                            {company.isActive ? "Mark past" : "Reactivate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              confirmThen(`Delete ${company.name}?`, () =>
                                mutate(
                                  `/api/companies/${company.id}`,
                                  { method: "DELETE" },
                                  `${company.name} deleted.`,
                                ),
                              )
                            }
                          >
                            Delete
                          </DropdownMenuItem>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                  {companies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No companies yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Accounts --- */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Accounts</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Each account carries a default split. Imported transactions
                  inherit it, so changing the shares re-attributes its history.
                </p>
              </div>
              <Button
                disabled={activePeople.length === 0}
                onClick={() => setDialog({ kind: "account", account: null })}
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nickname</TableHead>
                    <TableHead>CSV Name</TableHead>
                    <TableHead>Split</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {accountLabel(account)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.name}
                      </TableCell>
                      <TableCell>
                        {describeSplitRows(account.splits, people)}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {account.splits.map((split) => {
                            const owner = people.find(
                              (person) => person.id === split.personId,
                            );
                            return (
                              <Badge key={split.personId} variant="outline">
                                <ColorDot
                                  color={personColor(owner?.color)}
                                  className="mr-1"
                                />
                                {owner?.name ?? "Unknown"} {split.percent}%
                              </Badge>
                            );
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          label={`Actions for ${accountLabel(account)}`}
                          disabled={saving}
                        >
                          <DropdownMenuItem
                            onSelect={() => setDialog({ kind: "account", account })}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              confirmThen(`Delete ${account.name}?`, () =>
                                mutate(
                                  `/api/accounts/${account.id}`,
                                  { method: "DELETE" },
                                  "Account deleted.",
                                ),
                              )
                            }
                          >
                            Delete
                          </DropdownMenuItem>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No accounts yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Categories --- */}
        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Categories</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Rename, merge one into another, or split off a new one and
                  reassign transactions from the Spending page.
                </p>
              </div>
              <Button onClick={() => setDialog({ kind: "category", category: null })}>
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Excluded from FI</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        {category.excludedFromFi ? (
                          <Badge variant="warning">excluded</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          label={`Actions for ${category.name}`}
                          disabled={saving}
                        >
                          <DropdownMenuItem
                            onSelect={() => setDialog({ kind: "category", category })}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDialog({ kind: "merge", category })}
                          >
                            Merge into…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDialog({ kind: "split", category })}
                          >
                            Split off…
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              confirmThen(
                                `Delete ${category.name}? Its transactions become uncategorized.`,
                                () =>
                                  mutate(
                                    `/api/categories/${category.id}`,
                                    { method: "DELETE" },
                                    "Category deleted.",
                                  ),
                              )
                            }
                          >
                            Delete
                          </DropdownMenuItem>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- FI settings --- */}
        <TabsContent value="fi">
          <Card>
            <CardHeader><CardTitle>FI Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawal-rate">Withdrawal Rate</Label>
                <Input
                  id="withdrawal-rate"
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
                  Excluded categories are left out of the trailing 12-month
                  spending used for the FI number.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 text-sm"
                    >
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
              <Button
                disabled={saving}
                onClick={() =>
                  void mutate(
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
                  )
                }
              >
                Save FI Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Logins --- */}
        <TabsContent value="logins">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Logins</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Anyone with a login sees all of this household&apos;s finances.
                  Logins are separate from People.
                </p>
              </div>
              <Button onClick={() => setDialog({ kind: "login" })}>
                <Plus className="h-4 w-4" />
                Create Login
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logins.map((login) => (
                    <TableRow key={login.id}>
                      <TableCell className="font-medium">
                        {login.username}
                        {login.id === currentUserId ? (
                          <Badge variant="outline" className="ml-2">
                            you
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{login.name}</TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          label={`Actions for ${login.username}`}
                          disabled={saving || login.id === currentUserId}
                        >
                          <DropdownMenuItem
                            destructive
                            onSelect={() =>
                              confirmThen(
                                `Delete the login "${login.username}"?`,
                                () =>
                                  mutate(
                                    `/api/users/${login.id}`,
                                    { method: "DELETE" },
                                    "Login deleted.",
                                  ),
                              )
                            }
                          >
                            Delete
                          </DropdownMenuItem>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Profile --- */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Profile</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-medium">
                    {logins.find((login) => login.id === currentUserId)?.username ??
                      "—"}
                  </span>
                  .
                </p>
              </div>
              <Button onClick={() => setDialog({ kind: "password" })}>
                Change Password
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- Dialogs --- */}
      <PersonDialog
        open={dialog.kind === "person"}
        onOpenChange={(open) => (open ? null : close())}
        person={dialog.kind === "person" ? dialog.person : null}
        onSave={(values) =>
          dialog.kind === "person" && dialog.person
            ? mutate(
                `/api/people/${dialog.person.id}`,
                { method: "PATCH", body: JSON.stringify(values) },
                `${values.name} updated.`,
              )
            : mutate(
                "/api/people",
                { method: "POST", body: JSON.stringify(values) },
                `${values.name} added.`,
              )
        }
      />

      <CompanyDialog
        open={dialog.kind === "company"}
        onOpenChange={(open) => (open ? null : close())}
        company={dialog.kind === "company" ? dialog.company : null}
        defaultPersonId={
          dialog.kind === "company" ? dialog.defaultPersonId : undefined
        }
        people={activePeople}
        onSave={(values) =>
          dialog.kind === "company" && dialog.company
            ? mutate(
                `/api/companies/${dialog.company.id}`,
                { method: "PATCH", body: JSON.stringify({ name: values.name }) },
                `${values.name} updated.`,
              )
            : mutate(
                "/api/companies",
                { method: "POST", body: JSON.stringify(values) },
                `${values.name} added.`,
              )
        }
      />

      <AccountDialog
        open={dialog.kind === "account"}
        onOpenChange={(open) => (open ? null : close())}
        account={dialog.kind === "account" ? dialog.account : null}
        people={activePeople}
        onSave={(values) =>
          dialog.kind === "account" && dialog.account
            ? mutate(
                `/api/accounts/${dialog.account.id}`,
                { method: "PATCH", body: JSON.stringify(values) },
                "Account updated.",
              )
            : mutate(
                "/api/accounts",
                { method: "POST", body: JSON.stringify(values) },
                "Account added.",
              )
        }
      />

      <CategoryDialog
        open={dialog.kind === "category"}
        onOpenChange={(open) => (open ? null : close())}
        category={dialog.kind === "category" ? dialog.category : null}
        onSave={(values) =>
          dialog.kind === "category" && dialog.category
            ? mutate(
                `/api/categories/${dialog.category.id}`,
                { method: "PATCH", body: JSON.stringify(values) },
                "Category renamed.",
              )
            : mutate(
                "/api/categories",
                { method: "POST", body: JSON.stringify(values) },
                "Category added.",
              )
        }
      />

      <MergeCategoryDialog
        open={dialog.kind === "merge"}
        onOpenChange={(open) => (open ? null : close())}
        category={dialog.kind === "merge" ? dialog.category : null}
        categories={categories}
        onSave={(values) =>
          dialog.kind === "merge"
            ? mutate(
                `/api/categories/${dialog.category.id}`,
                {
                  method: "PATCH",
                  body: JSON.stringify({ action: "merge", ...values }),
                },
                "Categories merged.",
              )
            : Promise.resolve({ ok: false })
        }
      />

      <SplitCategoryDialog
        open={dialog.kind === "split"}
        onOpenChange={(open) => (open ? null : close())}
        category={dialog.kind === "split" ? dialog.category : null}
        onSave={(values) =>
          dialog.kind === "split"
            ? mutate(
                `/api/categories/${dialog.category.id}`,
                {
                  method: "PATCH",
                  body: JSON.stringify({ action: "split", ...values }),
                },
                `${values.newCategoryName} created.`,
              )
            : Promise.resolve({ ok: false })
        }
      />

      <LoginDialog
        open={dialog.kind === "login"}
        onOpenChange={(open) => (open ? null : close())}
        onSave={(values) =>
          mutate(
            "/api/users",
            { method: "POST", body: JSON.stringify(values) },
            `Login "${values.username}" created.`,
          )
        }
      />

      <PasswordDialog
        open={dialog.kind === "password"}
        onOpenChange={(open) => (open ? null : close())}
        onSave={(values) =>
          mutate(
            "/api/settings",
            {
              method: "PATCH",
              body: JSON.stringify({ action: "change-password", ...values }),
            },
            "Password updated.",
          )
        }
      />
    </div>
  );
}
