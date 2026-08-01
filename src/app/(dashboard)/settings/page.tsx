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
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  describeSplitRows,
  evenSplit,
  SplitEditor,
  splitTotal,
  type Person,
  type SplitRow,
} from "@/components/people/split-editor";

type Account = {
  id: string;
  name: string;
  splits: SplitRow[];
};

type Category = {
  id: string;
  name: string;
  excludedFromFi: boolean;
};

type Login = {
  id: string;
  username: string;
  name: string;
  createdAt: string;
};

type Company = {
  id: string;
  name: string;
  personId: string;
  isActive: boolean;
  person: { id: string; name: string };
};

type Message = { tone: "error" | "ok"; text: string } | null;

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

  // Draft copies so a row can be edited and then saved explicitly.
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [accountSplits, setAccountSplits] = useState<Record<string, SplitRow[]>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [personNames, setPersonNames] = useState<Record<string, string>>({});
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [newCompany, setNewCompany] = useState<Record<string, string>>({});

  const [newAccount, setNewAccount] = useState({ name: "" });
  const [newAccountSplits, setNewAccountSplits] = useState<SplitRow[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [newLogin, setNewLogin] = useState({ username: "", name: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  const activePeople = people.filter((person) => person.isActive);

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

    const accountData: Account[] = await accountResponse.json();
    const settingsData = await settingsResponse.json();
    const peopleData: Person[] = await peopleResponse.json();
    const loginData: Login[] = await loginResponse.json();

    setAccounts(accountData);
    setAccountNames(
      Object.fromEntries(accountData.map((account) => [account.id, account.name])),
    );
    setAccountSplits(
      Object.fromEntries(accountData.map((account) => [account.id, account.splits])),
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
    setCurrentUserId(settingsData.user?.id ?? null);

    const companyData: Company[] = await companyResponse.json();

    setPeople(peopleData);
    setPersonNames(
      Object.fromEntries(peopleData.map((person) => [person.id, person.name])),
    );
    setCompanies(companyData);
    setCompanyNames(
      Object.fromEntries(companyData.map((company) => [company.id, company.name])),
    );
    setLogins(loginData);

    setNewAccountSplits(evenSplit(peopleData.filter((person) => person.isActive)));
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

  // --- People ---------------------------------------------------------------

  async function addPerson() {
    const created = await mutate(
      "/api/people",
      { method: "POST", body: JSON.stringify({ name: newPerson }) },
      `${newPerson} added.`,
    );
    if (created) setNewPerson("");
  }

  async function renamePerson(person: Person) {
    const name = personNames[person.id]?.trim();
    if (!name || name === person.name) return;
    await mutate(
      `/api/people/${person.id}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
      "Person renamed.",
    );
  }

  async function togglePerson(person: Person) {
    await mutate(
      `/api/people/${person.id}`,
      { method: "PATCH", body: JSON.stringify({ isActive: !person.isActive }) },
      person.isActive ? `${person.name} deactivated.` : `${person.name} reactivated.`,
    );
  }

  async function deletePerson(person: Person) {
    if (!window.confirm(`Delete ${person.name}?`)) return;
    await mutate(
      `/api/people/${person.id}`,
      { method: "DELETE" },
      `${person.name} deleted.`,
    );
  }

  // --- Companies ------------------------------------------------------------

  async function addCompany(person: Person) {
    const name = (newCompany[person.id] ?? "").trim();
    if (!name) return;

    const created = await mutate(
      "/api/companies",
      { method: "POST", body: JSON.stringify({ name, personId: person.id }) },
      `${name} added for ${person.name}.`,
    );

    if (created) setNewCompany({ ...newCompany, [person.id]: "" });
  }

  async function renameCompany(company: Company) {
    const name = companyNames[company.id]?.trim();
    if (!name || name === company.name) return;
    await mutate(
      `/api/companies/${company.id}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
      "Company renamed.",
    );
  }

  async function toggleCompany(company: Company) {
    await mutate(
      `/api/companies/${company.id}`,
      { method: "PATCH", body: JSON.stringify({ isActive: !company.isActive }) },
      company.isActive
        ? `${company.name} marked as a past employer.`
        : `${company.name} reactivated.`,
    );
  }

  async function deleteCompany(company: Company) {
    if (!window.confirm(`Delete ${company.name}?`)) return;
    await mutate(
      `/api/companies/${company.id}`,
      { method: "DELETE" },
      `${company.name} deleted.`,
    );
  }

  // --- Logins ---------------------------------------------------------------

  async function addLogin() {
    const created = await mutate(
      "/api/users",
      { method: "POST", body: JSON.stringify(newLogin) },
      `Login "${newLogin.username}" created.`,
    );
    if (created) setNewLogin({ username: "", name: "", password: "" });
  }

  async function deleteLogin(login: Login) {
    if (!window.confirm(`Delete the login "${login.username}"?`)) return;
    await mutate(`/api/users/${login.id}`, { method: "DELETE" }, "Login deleted.");
  }

  // --- Accounts -------------------------------------------------------------

  async function addAccount() {
    if (splitTotal(newAccountSplits) !== 100) {
      setMessage({ tone: "error", text: "Account shares must add up to 100%." });
      return;
    }

    const created = await mutate(
      "/api/accounts",
      {
        method: "POST",
        body: JSON.stringify({
          name: newAccount.name,
          splits: newAccountSplits.filter((split) => split.percent > 0),
        }),
      },
      "Account added.",
    );

    if (created) setNewAccount({ name: "" });
  }

  async function saveAccount(account: Account) {
    const splits = accountSplits[account.id] ?? [];
    if (splitTotal(splits) !== 100) {
      setMessage({ tone: "error", text: "Account shares must add up to 100%." });
      return;
    }

    await mutate(
      `/api/accounts/${account.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: accountNames[account.id],
          splits: splits.filter((split) => split.percent > 0),
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

  // --- Categories -----------------------------------------------------------

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
        body: JSON.stringify({
          action: "split",
          newCategoryName: newCategoryName.trim(),
        }),
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

  // --- FI + profile ---------------------------------------------------------

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage people, logins, accounts, categories, and FI assumptions.
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
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="fi">FI Settings</TabsTrigger>
          <TabsTrigger value="logins">Logins</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
              <p className="text-sm text-muted-foreground">
                Everyone expenses are split between. People don&apos;t sign in — they
                only carry shares. Deactivate someone to keep their history while
                removing them from new splits.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell>
                        <Input
                          value={personNames[person.id] ?? person.name}
                          onChange={(event) =>
                            setPersonNames({
                              ...personNames,
                              [person.id]: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.isActive ? "success" : "secondary"}>
                          {person.isActive ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={saving}
                            onClick={() => renamePerson(person)}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => togglePerson(person)}
                          >
                            {person.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${person.name}`}
                            disabled={saving}
                            onClick={() => deletePerson(person)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {people.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No people yet. Add one below to start splitting expenses.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
              <p className="text-sm text-muted-foreground">
                Where each person earns. Paychecks are recorded against a company,
                so someone working two jobs gets two paychecks a month. Left a job?
                Mark it past — the pay history stays.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {people.map((person) => {
                const owned = companies.filter(
                  (company) => company.personId === person.id,
                );

                return (
                  <div key={person.id} className="space-y-3 rounded-xl border p-4">
                    <p className="font-medium">{person.name}</p>

                    {owned.length > 0 ? (
                      <div className="space-y-2">
                        {owned.map((company) => (
                          <div
                            key={company.id}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <Input
                              className="max-w-xs"
                              value={companyNames[company.id] ?? company.name}
                              onChange={(event) =>
                                setCompanyNames({
                                  ...companyNames,
                                  [company.id]: event.target.value,
                                })
                              }
                            />
                            <Badge
                              variant={company.isActive ? "success" : "secondary"}
                            >
                              {company.isActive ? "current" : "past"}
                            </Badge>
                            <span className="ml-auto flex gap-2">
                              <Button
                                size="sm"
                                disabled={saving}
                                onClick={() => renameCompany(company)}
                              >
                                Rename
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={saving}
                                onClick={() => toggleCompany(company)}
                              >
                                {company.isActive ? "Mark past" : "Reactivate"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${company.name}`}
                                disabled={saving}
                                onClick={() => deleteCompany(company)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No companies yet for {person.name}.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="max-w-xs"
                        placeholder={`Add a company for ${person.name}`}
                        value={newCompany[person.id] ?? ""}
                        onChange={(event) =>
                          setNewCompany({
                            ...newCompany,
                            [person.id]: event.target.value,
                          })
                        }
                      />
                      <Button
                        variant="outline"
                        disabled={saving || !(newCompany[person.id] ?? "").trim()}
                        onClick={() => addCompany(person)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
              {people.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a person first, then give them companies.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Add Person</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Input
                className="max-w-xs"
                placeholder="Name"
                value={newPerson}
                onChange={(event) => setNewPerson(event.target.value)}
              />
              <Button onClick={addPerson} disabled={saving || !newPerson.trim()}>
                Add
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Each account carries a default split. Imported transactions inherit it,
                so changing an account&apos;s shares re-attributes its history.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="space-y-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      className="max-w-sm"
                      value={accountNames[account.id] ?? account.name}
                      onChange={(event) =>
                        setAccountNames({
                          ...accountNames,
                          [account.id]: event.target.value,
                        })
                      }
                    />
                    <Badge variant="outline">
                      {describeSplitRows(accountSplits[account.id] ?? [], people)}
                    </Badge>
                    <span className="ml-auto flex gap-2">
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => saveAccount(account)}
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
                  </div>
                  <SplitEditor
                    people={activePeople}
                    splits={accountSplits[account.id] ?? []}
                    onChange={(splits) =>
                      setAccountSplits({ ...accountSplits, [account.id]: splits })
                    }
                  />
                </div>
              ))}
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accounts yet. Add the cards and bank accounts your CSV exports use.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Add Account</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  className="max-w-sm"
                  placeholder="Credit Card - 9939"
                  value={newAccount.name}
                  onChange={(event) => setNewAccount({ name: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Must match the Account column in your CSV exports exactly.
                </p>
              </div>
              <SplitEditor
                people={activePeople}
                splits={newAccountSplits}
                onChange={setNewAccountSplits}
              />
              <Button
                onClick={addAccount}
                disabled={saving || !newAccount.name.trim() || activePeople.length === 0}
              >
                Add Account
              </Button>
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

        <TabsContent value="logins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logins</CardTitle>
              <p className="text-sm text-muted-foreground">
                Anyone with a login sees all of this household&apos;s finances. Logins
                are separate from People — one login can cover everybody.
              </p>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${login.username}`}
                          disabled={saving || login.id === currentUserId}
                          onClick={() => deleteLogin(login)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Create Login</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="malone"
                  value={newLogin.username}
                  onChange={(event) =>
                    setNewLogin({ ...newLogin, username: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Letters, numbers, dots, underscores, and hyphens.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input
                  placeholder="Malone Household"
                  value={newLogin.name}
                  onChange={(event) =>
                    setNewLogin({ ...newLogin, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newLogin.password}
                  onChange={(event) =>
                    setNewLogin({ ...newLogin, password: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addLogin}
                  disabled={
                    saving ||
                    !newLogin.username.trim() ||
                    !newLogin.name.trim() ||
                    newLogin.password.length < 8
                  }
                >
                  Create Login
                </Button>
              </div>
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
