"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FilterState = {
  /** A person id, or "COMBINED" for the whole household. */
  person: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  accountId: string;
  tag: string;
  minAmount: string;
  maxAmount: string;
  search: string;
};

export const emptyFilters: FilterState = {
  person: "COMBINED",
  startDate: "",
  endDate: "",
  categoryId: "",
  accountId: "",
  tag: "",
  minAmount: "",
  maxAmount: "",
  search: "",
};

export function DashboardFilters({
  filters,
  onChange,
  categories,
  accounts,
  people,
  showSearch = false,
}: {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  people: { id: string; name: string }[];
  showSearch?: boolean;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2">
        <Label>Person</Label>
        <Select
          value={filters.person}
          onValueChange={(value) => onChange({ ...filters, person: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMBINED">Combined</SelectItem>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input
          type="date"
          value={filters.startDate}
          onChange={(event) =>
            onChange({ ...filters, startDate: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>End Date</Label>
        <Input
          type="date"
          value={filters.endDate}
          onChange={(event) =>
            onChange({ ...filters, endDate: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={filters.categoryId || "all"}
          onValueChange={(value) =>
            onChange({ ...filters, categoryId: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Account</Label>
        <Select
          value={filters.accountId || "all"}
          onValueChange={(value) =>
            onChange({ ...filters, accountId: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tag</Label>
        <Input
          placeholder="e.g. Vacation"
          value={filters.tag}
          onChange={(event) => onChange({ ...filters, tag: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Min Amount</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={filters.minAmount}
          onChange={(event) =>
            onChange({ ...filters, minAmount: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Max Amount</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="No limit"
          value={filters.maxAmount}
          onChange={(event) =>
            onChange({ ...filters, maxAmount: event.target.value })
          }
        />
      </div>

      {showSearch ? (
        <div className="space-y-2">
          <Label>Search</Label>
          <Input
            placeholder="Description or notes"
            value={filters.search}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </div>
      ) : null}

      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange({ ...emptyFilters })}
        >
          Reset filters
        </Button>
      </div>
    </div>
  );
}

export function filtersToQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.person) params.set("person", filters.person);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.minAmount) params.set("minAmount", filters.minAmount);
  if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}
