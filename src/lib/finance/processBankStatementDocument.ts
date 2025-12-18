import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { parse } from "csv-parse/sync"

type ImportResult =
  | { ok: true; parsed: number; valid: number; invalid: number; upserted: number }
  | { ok: false; step: string; error: string; extra?: any }

const BUCKET = "mb-cockpit"

function pick(row: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return null
}

function parseAmount(input: string | null): number | null {
  if (!input) return null
  const cleaned = input
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, "")
    .replace("PLN", "")
    .replace(",", ".")
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseDateToISO(input: string | null): string | null {
  if (!input) return null
  const s = input.trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD.MM.YYYY
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s)
  if (m) {
    const dd = m[1]
    const mm = m[2]
    const yyyy = m[3]
    return `${yyyy}-${mm}-${dd}`
  }

  return null
}

function extractOrgIdFromStoragePath(storagePath: string): string | null {
  // expected: documents/<orgUuid>/YYYY/MM/<uuid>-file.csv
  const m = /^documents\/([0-9a-fA-F-]{36})\//.exec(storagePath)
  return m?.[1] ?? null
}

function normaliseLines(csvText: string): string[] {
  return csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(l => l.replace(/^\uFEFF/, "")) // strip BOM if present
}

function detectDelimiterAndHeaderIndex(lines: string[]) {
  const sample = lines.slice(0, 60).filter(l => l.trim() !== "")
  const score = (delim: string) =>
    Math.max(0, ...sample.map(l => l.split(delim).length))

  const semiScore = score(";")
  const commaScore = score(",")

  const delimiter = semiScore >= commaScore ? ";" : ","

  let headerIdx = 0
  let bestCols = 0
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const l = lines[i]
    if (!l || l.trim() === "") continue
    const cols = l.split(delimiter).length
    if (cols > bestCols) {
      bestCols = cols
      headerIdx = i
    }
  }

  return { delimiter, headerIdx, bestCols }
}

function parseBankCsvTolerant(lines: string[], delimiter: string, headerIdx: number) {
  const headerLine = lines[headerIdx] ?? ""
  const headers = headerLine.split(delimiter).map(h => h.trim()).filter(Boolean)

  const descKeys = ["Opis operacji", "Tytuł", "Tytul", "Opis", "Description"]
  let descIdx = headers.findIndex(h => descKeys.includes(h))
  if (descIdx < 0) descIdx = headers.length - 1

  const records: Record<string, string>[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.trim() === "") continue

    let parts = line.split(delimiter)

    // pad or merge to exactly headers.length
    if (parts.length > headers.length) {
      const leftCount = descIdx
      const rightCount = headers.length - descIdx - 1

      const left = parts.slice(0, leftCount)
      const right = rightCount > 0 ? parts.slice(parts.length - rightCount) : []
      const middle = parts.slice(leftCount, parts.length - rightCount).join(delimiter)

      parts = [
        ...left,
        middle,
        ...right,
      ]
    } else if (parts.length < headers.length) {
      parts = parts.concat(Array(headers.length - parts.length).fill(""))
    }

    const obj: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = (parts[c] ?? "").trim()

    records.push(obj)
  }

  return { headers, records }
}

export async function processBankStatementDocument(params: { documentId: string }): Promise<ImportResult> {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return { ok: false, step: "env", error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", params.documentId)
    .single()

  if (docErr || !doc) {
    return { ok: false, step: "load_document", error: docErr?.message ?? "Document not found" }
  }

  console.info("[BANK_STATEMENT] doc loaded", {
    id: doc.id,
    doc_type: doc.doc_type,
    organisation_id: doc.organisation_id,
    storage_path: doc.storage_path,
    file_url: doc.file_url,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
  })

  if (doc.doc_type !== "BANK_CONFIRMATION") {
    return { ok: false, step: "wrong_doc_type", error: `Expected BANK_CONFIRMATION got ${doc.doc_type}` }
  }

  const storagePath: string = doc.storage_path
  if (!storagePath) {
    return { ok: false, step: "missing_storage_path", error: "documents.storage_path is empty" }
  }

  const orgId: string | null = doc.organisation_id ?? extractOrgIdFromStoragePath(storagePath)
  if (!orgId) {
    return { ok: false, step: "missing_org", error: "documents.organisation_id is null and orgId cannot be derived from storage_path", extra: { storagePath } }
  }

  let csvText: string | null = null

  // 1) Prefer download from Storage
  const dl = await supabase.storage.from(BUCKET).download(storagePath)
  if (!dl.error && dl.data) {
    csvText = await new Response(dl.data).text()
    console.info("[BANK_STATEMENT] storage.download ok", { bytes: csvText.length })
  } else {
    console.warn("[BANK_STATEMENT] storage.download failed", { error: dl.error?.message, storagePath })
  }

  // 2) Fallback: fetch public URL
  if (!csvText) {
    const fileUrl: string = doc.file_url
    if (!fileUrl) return { ok: false, step: "missing_file_url", error: "documents.file_url is empty" }

    const resp = await fetch(fileUrl)
    console.info("[BANK_STATEMENT] fetch(file_url)", { status: resp.status })
    if (!resp.ok) return { ok: false, step: "fetch_failed", error: `Fetch failed with ${resp.status}` }
    csvText = await resp.text()
    console.info("[BANK_STATEMENT] fetch ok", { bytes: csvText.length })
  }

  console.info("[BANK_STATEMENT] csv preview", csvText.slice(0, 200))

  const lines = normaliseLines(csvText)

  const { delimiter, headerIdx, bestCols } = detectDelimiterAndHeaderIndex(lines)

  console.info("[BANK_STATEMENT] header detect", { delimiter, headerIdx, bestCols, headerLine: (lines[headerIdx] ?? "").slice(0, 200) })

  // First try strict csv-parse starting AFTER header line
  let records: Record<string, any>[] = []
  let headers: string[] = []

  try {
    headers = (lines[headerIdx] ?? "").split(delimiter).map(h => h.trim()).filter(Boolean)

    const dataText = lines.slice(headerIdx + 1).join("\n")

    records = parse(dataText, {
      columns: headers,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      delimiter,
      relax_quotes: true,
      relax_column_count: true,
    })

    console.info("[BANK_STATEMENT] parsed csv-parse", { rows: records.length, headers })
  } catch (e: any) {
    console.warn("[BANK_STATEMENT] csv-parse failed, falling back tolerant", { error: e?.message })

    const tolerant = parseBankCsvTolerant(lines, delimiter, headerIdx)
    headers = tolerant.headers
    records = tolerant.records

    console.info("[BANK_STATEMENT] parsed tolerant", { rows: records.length, headers })
  }

  if (records.length === 0) {
    return { ok: false, step: "parsed_0_rows", error: "Parsed 0 rows", extra: { delimiter, headerIdx, headers } }
  }

  const mapped: any[] = []
  let invalid = 0

  for (const row of records) {
    const bookingDate = parseDateToISO(
      pick(row, ["Data księgowania", "Data ksiegowania", "Data operacji", "Data"])
    )
    const valueDate = parseDateToISO(
      pick(row, ["Data waluty", "Data wartości", "Data wartosci"])
    )

    const amount = parseAmount(pick(row, ["Kwota", "Kwota operacji", "Amount"]))
    const currency = (pick(row, ["Waluta", "Currency"]) ?? "PLN").toUpperCase()

    const description =
      pick(row, ["Opis operacji", "Tytuł", "Tytul", "Opis"]) ??
      pick(row, ["Szczegóły", "Szczegoly"])

    const counterpartyName = pick(row, ["Kontrahent", "Nadawca/Odbiorca", "Odbiorca", "Nadawca", "Nazwa kontrahenta"])
    const counterpartyAccount = pick(row, ["Rachunek kontrahenta", "Numer rachunku", "Nr rachunku", "Konto"])

    if (!bookingDate || amount == null || !description) {
      invalid += 1
      continue
    }

    const direction = amount < 0 ? "out" : "in"
    const category = "uncategorised"

    const hashBase = [
      bookingDate,
      String(amount),
      currency,
      description,
      counterpartyAccount ?? "",
      counterpartyName ?? "",
    ].join("|")

    const transactionHash = crypto.createHash("sha256").update(hashBase).digest("hex")

    mapped.push({
      org_id: orgId,
      source_document_id: params.documentId,
      booking_date: bookingDate,
      value_date: valueDate,
      amount,
      currency,
      description,
      counterparty_name: counterpartyName,
      counterparty_account: counterpartyAccount,
      direction,
      category,
      subcategory: null,
      transaction_hash: transactionHash,
      raw: row,
      created_at: new Date().toISOString(),
    })
  }

  console.info("[BANK_STATEMENT] mapped", { valid: mapped.length, invalid })

  if (mapped.length === 0) {
    return { ok: false, step: "map_0_valid", error: "Mapped 0 valid transactions", extra: { invalid } }
  }

  // Upsert in batches to avoid payload limits
  const batchSize = 200
  let upserted = 0

  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize)

    const { error: upsertErr, data } = await supabase
      .from("finance_transactions")
      .upsert(batch, { onConflict: "org_id,transaction_hash" })
      .select("id")

    if (upsertErr) {
      console.error("[BANK_STATEMENT] upsert failed", { error: upsertErr.message })
      return { ok: false, step: "upsert", error: upsertErr.message }
    }

    upserted += (data?.length ?? 0)
  }

  console.info("[BANK_STATEMENT] import complete", { parsed: records.length, valid: mapped.length, invalid, upserted })

  return { ok: true, parsed: records.length, valid: mapped.length, invalid, upserted }
}

