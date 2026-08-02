"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/settings/color-picker";
import {
  evenSplit,
  SplitEditor,
  splitTotal,
  type Person,
  type SplitRow,
} from "@/components/people/split-editor";
import { DEFAULT_PERSON_COLOR } from "@/lib/colors";

type SaveResult = { ok: boolean; error?: string };

/**
 * Every settings dialog shares this shell: a titled modal wrapping a form that
 * reports its own errors and closes only when the save succeeds.
 */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  canSubmit = true,
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  onSubmit: () => Promise<SaveResult>;
  canSubmit?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const result = await onSubmit();

    setSaving(false);
    if (result.ok) {
      onOpenChange(false);
      return;
    }
    setError(result.error ?? "Something went wrong.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className={wide ? "max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {children}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- People -----------------------------------------------------------------

export function PersonDialog({
  open,
  onOpenChange,
  person,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null when adding. */
  person: { id: string; name: string; color: string } | null;
  onSave: (values: { name: string; color: string }) => Promise<SaveResult>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_PERSON_COLOR);
  const [seeded, setSeeded] = useState<string | null>(null);

  // Reseed the fields whenever the dialog opens on a different row.
  const key = person?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(person?.name ?? "");
    setColor(person?.color ?? DEFAULT_PERSON_COLOR);
  }
  if (!open && seeded !== null) setSeeded(null);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={person ? "Edit Person" : "Add Person"}
      description="People carry split percentages and never sign in. Their colour is used for their charts."
      submitLabel={person ? "Save Changes" : "Add Person"}
      canSubmit={name.trim().length > 0}
      onSubmit={() => onSave({ name: name.trim(), color })}
    >
      <div className="space-y-2">
        <Label htmlFor="person-name">Name</Label>
        <Input
          id="person-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label>Colour</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
    </FormDialog>
  );
}

// --- Companies ---------------------------------------------------------------

export function CompanyDialog({
  open,
  onOpenChange,
  company,
  people,
  defaultPersonId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: { id: string; name: string; personId: string } | null;
  people: { id: string; name: string }[];
  defaultPersonId?: string;
  onSave: (values: { name: string; personId: string }) => Promise<SaveResult>;
}) {
  const [name, setName] = useState("");
  const [personId, setPersonId] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = company?.id ?? `new-${defaultPersonId ?? ""}`;
  if (open && seeded !== key) {
    setSeeded(key);
    setName(company?.name ?? "");
    setPersonId(company?.personId ?? defaultPersonId ?? "");
  }
  if (!open && seeded !== null) setSeeded(null);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={company ? "Edit Company" : "Add Company"}
      description="Where a person earns. Paychecks are recorded against a company."
      submitLabel={company ? "Save Changes" : "Add Company"}
      canSubmit={name.trim().length > 0 && personId.length > 0}
      onSubmit={() => onSave({ name: name.trim(), personId })}
    >
      <div className="space-y-2">
        <Label htmlFor="company-name">Name</Label>
        <Input
          id="company-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label>Person</Label>
        <Select
          value={personId}
          onValueChange={setPersonId}
          // Moving a company between people would strand its paychecks.
          disabled={Boolean(company)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a person" />
          </SelectTrigger>
          <SelectContent>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FormDialog>
  );
}

// --- Accounts ----------------------------------------------------------------

export function AccountDialog({
  open,
  onOpenChange,
  account,
  people,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: { id: string; name: string; splits: SplitRow[] } | null;
  people: Person[];
  onSave: (values: { name: string; splits: SplitRow[] }) => Promise<SaveResult>;
}) {
  const [name, setName] = useState("");
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = account?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(account?.name ?? "");
    setSplits(account?.splits?.length ? account.splits : evenSplit(people));
  }
  if (!open && seeded !== null) setSeeded(null);

  const balanced = splitTotal(splits) === 100;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? "Edit Account" : "Add Account"}
      description="Name it exactly as it appears in your CSV exports."
      submitLabel={account ? "Save Changes" : "Add Account"}
      canSubmit={name.trim().length > 0 && balanced}
      wide
      onSubmit={() =>
        onSave({
          name: name.trim(),
          splits: splits.filter((split) => split.percent > 0),
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="account-name">Name</Label>
        <Input
          id="account-name"
          placeholder="Credit Card - 9939"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label>Default split</Label>
        <SplitEditor people={people} splits={splits} onChange={setSplits} />
      </div>
    </FormDialog>
  );
}

// --- Categories --------------------------------------------------------------

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string } | null;
  onSave: (values: { name: string }) => Promise<SaveResult>;
}) {
  const [name, setName] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = category?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(category?.name ?? "");
  }
  if (!open && seeded !== null) setSeeded(null);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Rename Category" : "Add Category"}
      submitLabel={category ? "Save Changes" : "Add Category"}
      canSubmit={name.trim().length > 0}
      onSubmit={() => onSave({ name: name.trim() })}
    >
      <div className="space-y-2">
        <Label htmlFor="category-name">Name</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
    </FormDialog>
  );
}

export function MergeCategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string } | null;
  categories: { id: string; name: string }[];
  onSave: (values: { targetCategoryId: string }) => Promise<SaveResult>;
}) {
  const [targetCategoryId, setTarget] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = category?.id ?? "none";
  if (open && seeded !== key) {
    setSeeded(key);
    setTarget("");
  }
  if (!open && seeded !== null) setSeeded(null);

  const target = categories.find((item) => item.id === targetCategoryId);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Merge ${category?.name ?? ""}`}
      description="Every transaction moves to the category you pick, and this one is deleted."
      submitLabel="Merge"
      canSubmit={targetCategoryId.length > 0}
      onSubmit={() => onSave({ targetCategoryId })}
    >
      <div className="space-y-2">
        <Label>Merge into</Label>
        <Select value={targetCategoryId} onValueChange={setTarget}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories
              .filter((item) => item.id !== category?.id)
              .map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {target ? (
        <p className="text-sm text-muted-foreground">
          {category?.name} transactions become {target.name}.
        </p>
      ) : null}
    </FormDialog>
  );
}

export function SplitCategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string } | null;
  onSave: (values: { newCategoryName: string }) => Promise<SaveResult>;
}) {
  const [newCategoryName, setName] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  const key = category?.id ?? "none";
  if (open && seeded !== key) {
    setSeeded(key);
    setName("");
  }
  if (!open && seeded !== null) setSeeded(null);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Split ${category?.name ?? ""}`}
      description="Creates a new category. Move the transactions across from the Spending page."
      submitLabel="Create Category"
      canSubmit={newCategoryName.trim().length > 0}
      onSubmit={() => onSave({ newCategoryName: newCategoryName.trim() })}
    >
      <div className="space-y-2">
        <Label htmlFor="split-name">New category name</Label>
        <Input
          id="split-name"
          value={newCategoryName}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
    </FormDialog>
  );
}

// --- Logins and profile ------------------------------------------------------

export function LoginDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    username: string;
    name: string;
    password: string;
  }) => Promise<SaveResult>;
}) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [seeded, setSeeded] = useState(false);

  if (open && !seeded) {
    setSeeded(true);
    setUsername("");
    setName("");
    setPassword("");
  }
  if (!open && seeded) setSeeded(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Login"
      description="Anyone with a login sees all of this household's finances."
      submitLabel="Create Login"
      canSubmit={
        username.trim().length > 0 && name.trim().length > 0 && password.length >= 8
      }
      onSubmit={() => onSave({ username: username.trim(), name: name.trim(), password })}
    >
      <div className="space-y-2">
        <Label htmlFor="login-username">Username</Label>
        <Input
          id="login-username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="malone"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Letters, numbers, dots, underscores, and hyphens.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-name">Display name</Label>
        <Input
          id="login-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
    </FormDialog>
  );
}

export function PasswordDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<SaveResult>;
}) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [seeded, setSeeded] = useState(false);

  if (open && !seeded) {
    setSeeded(true);
    setCurrent("");
    setNew("");
  }
  if (!open && seeded) setSeeded(false);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Password"
      submitLabel="Update Password"
      canSubmit={currentPassword.length > 0 && newPassword.length >= 8}
      onSubmit={() => onSave({ currentPassword, newPassword })}
    >
      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrent(event.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNew(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
    </FormDialog>
  );
}
