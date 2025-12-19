# ETAP 0 — DISCOVERY

## D0.1: Org membership i org_id

**Status: FOUND — Brak tabeli membership, org_id jest przekazywany bezpośrednio**

### Jak aplikacja trzyma org_id:

- **Hook**: `useOrganisations()` w `src/app/hooks/useSharedLists.ts`
  - Pobiera wszystkie organizacje z bazy
  - User wybiera organizację w UI (przykład: `FinanceView` ma `selectedOrgId` state)
  - Nie ma tabeli członkostwa — aplikacja pokazuje wszystkie orgs i user wybiera w UI

- **Przykład użycia org_id**:
  ```typescript
  // W FinanceView.tsx linia 34
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  // Filtrowanie transakcji po org_id:
  const data = await getTransactions({ orgId: selectedOrgId, ... });
  ```

- **Tabela organisations**:
  - Nazwa: `organisations`
  - Kolumny: `id` (UUID PK), `name`, `categories`, `status`, `priority`, itd.
  - Brak kolumny `user_id` — nie ma tabeli członkostwa
  - RLS: `CREATE POLICY "Allow all operations on organisations" ON organisations FOR ALL USING (true);`

**WNIOSEK**: 
- Nie ma tabeli membership (np. `org_members`, `memberships`, `organisations_users`)
- User wybiera org z listy w UI
- org_id jest przekazywany jako parametr do zapytań
- Wszystkie orgs są dostępne dla wszystkich (brak realnej autoryzacji na poziomie DB)

**Możliwe warianty dla Trips RLS:**
1. **Wariant A** (aktualny wzorzec): `USING (true)` — wszystkie trips dostępne dla wszystkich
2. **Wariant B** (jeśli chcesz scope po org_id): `USING (org_id = current_user_org_id)` — ale wymagałoby to dodania tabeli membership i mechanizmu autoryzacji

**Pytanie do użytkownika**: Który wariant RLS chcesz dla trips? (A czy B)

---

## D0.2: Transactions schema

**Status: FOUND**

### Typ Transaction (TypeScript):

**Lokalizacja**: `src/lib/finance/queries/getTransactions.ts` linie 16-39

```typescript
export interface Transaction {
  id: string;
  org_id: string;
  source_document_id: string;
  booking_date: string;           // DATE w DB
  value_date: string | null;      // DATE w DB, nullable
  amount: number;                 // NUMERIC w DB
  currency: string;               // TEXT w DB, default 'PLN'
  description: string;            // TEXT w DB (vendor info może być w counterparty_name)
  counterparty_name: string | null;  // TEXT w DB (vendor)
  counterparty_account: string | null;
  direction: 'in' | 'out';
  category: string;               // TEXT w DB, default 'uncategorised'
  subcategory: string | null;
  transaction_hash: string;
  raw: Record<string, any>;       // JSONB w DB
  created_at: string;
  is_recurring?: boolean;
  recurrence_pattern?: 'monthly' | 'quarterly' | 'yearly' | 'weekly' | 'one_time';
  recurrence_group_id?: string;
  project_id?: string | null;
  paid_by_company_card?: boolean;
  exclude_from_reimbursement?: boolean;
}
```

### Tabela w DB:

**Nazwa**: `finance_transactions`

**Minimalny zestaw pól dla Trip Items**:
- `id`: UUID PK
- `org_id`: UUID NOT NULL, FK do `organisations(id)`
- `booking_date`: DATE NOT NULL (data transakcji)
- `value_date`: DATE (data wartościowa, nullable)
- `amount`: NUMERIC NOT NULL
- `currency`: TEXT NOT NULL DEFAULT 'PLN'
- `description`: TEXT NOT NULL (główny opis)
- `counterparty_name`: TEXT (vendor/nazwa kontrahenta, nullable)
- `category`: TEXT NOT NULL DEFAULT 'uncategorised'
- `subcategory`: TEXT (nullable)

**Przykład zapytania**:
```typescript
// Z getTransactions.ts linia 49-51
let query = supabase
  .from('finance_transactions')
  .select('id, org_id, source_document_id, booking_date, value_date, amount, currency, description, counterparty_name, ...')
  .eq('org_id', params.orgId);
```

**WNIOSEK**: 
- Tabela `finance_transactions` istnieje
- Ma wszystkie potrzebne pola
- FK do `organisations` przez `org_id`
- Nie ma bezpośredniego FK do user/authentication — tylko org_id

---

## D0.3: Routing Finance

**Status: FOUND**

### Gdzie jest Finance w app router:

**Brak dedykowanych route'ów w `/app/finance/`** - aplikacja używa **query params**:

- **Navigation**: `src/app/components/Navigation.tsx` linia 47-51
  ```typescript
  {
    title: "Finance",
    subtitle: "",
    segments: [
      "Transactions",
    ],
  }
  ```

- **Routing przez query params**: `?dimension=Finance&segment=Transactions`
  - Obsługiwane w: `src/app/components/SegmentContent.tsx` linia 60-62
  ```typescript
  if (dimension === "Finance" && segment === "Transactions") {
    return <FinanceView />;
  }
  ```

- **Główna strona**: `src/app/page.tsx` (prawdopodobnie renderuje `SegmentContent`)

### Jak dodać /finance/trips:

**Dwa podejścia:**

1. **Wariant A** (zgodny z obecnym wzorcem - query params):
   - Dodać "Trips" do segments w Navigation.tsx
   - Dodać warunek w SegmentContent.tsx: `if (dimension === "Finance" && segment === "Trips")`
   - Nie tworzyć `/app/finance/trips/page.tsx`

2. **Wariant B** (dedykowane route'y - bardziej RESTful):
   - Utworzyć `/app/finance/trips/page.tsx` (lista)
   - Utworzyć `/app/finance/trips/[id]/page.tsx` (detail)
   - Dodać link w Navigation lub w FinanceView jako sub-navigation

**Pytanie do użytkownika**: Który wariant routing chcesz? (A - query params jak Transactions, czy B - dedykowane route'y?)

---

## PODSUMOWANIE DISCOVERY

### ✅ Znalezione:

1. **Org membership**: Brak tabeli membership, org_id wybierany w UI, RLS używa `USING (true)`
2. **Transactions**: Tabela `finance_transactions` z pełnym schematem, FK przez `org_id`
3. **Routing**: Finance używa query params (`?dimension=Finance&segment=Transactions`)

### ❓ Do wyboru (2 warianty):

1. **RLS dla trips**:
   - **A**: `USING (true)` (jak obecne tabele)
   - **B**: `USING (org_id = current_user_org_id)` (wymaga membership table)

2. **Routing dla trips**:
   - **A**: Query params (`?dimension=Finance&segment=Trips`)
   - **B**: Dedykowane route'y (`/finance/trips` i `/finance/trips/[id]`)

**AWAITING USER DECISION** — zatrzymuję się z kodowaniem do momentu wyboru wariantów.

