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
  let s = input
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, "")
    .replace(/PLN|EUR|USD|GBP/gi, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // usuń kropki tysięcy
    .replace(",", ".")
  // zostaw tylko cyfry, minus, kropkę
  s = s.replace(/[^0-9\.\-]/g, "")
  const n = Number.parseFloat(s)
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

function normKey(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "") // usuń znaki typu /()-
}

function buildKeyMap(headers: string[]) {
  const map = new Map<string, string>() // normalised -> original
  for (const h of headers) map.set(normKey(h), h)
  return map
}

function findHeader(keyMap: Map<string, string>, candidates: string[]) {
  for (const c of candidates) {
    const hit = keyMap.get(normKey(c))
    if (hit) return hit
  }
  // fallback: partial match
  const candNorm = candidates.map(normKey)
  for (const [nk, orig] of keyMap.entries()) {
    if (candNorm.some(cn => nk.includes(cn) || cn.includes(nk))) return orig
  }
  return null
}

function getVal(row: Record<string, any>, header: string | null) {
  if (!header) return null
  const v = row[header]
  return v == null ? null : String(v).trim()
}

function stripBom(s: string) {
  return s.replace(/^\uFEFF/, "")
}

function normaliseLines(csvText: string) {
  return stripBom(csvText)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
}

function findMbankHeaderIndex(lines: string[]) {
  // mBank: header zawsze ma #Data operacji i #Opis operacji
  return lines.findIndex(
    (l) => l.includes("#Data operacji") && l.includes("#Opis operacji")
  )
}

function stripHashHeader(h: string) {
  return h.replace(/^#/, "").trim()
}

function parseMbankTable(csvText: string) {
  const lines = normaliseLines(csvText)

  const headerIdx = findMbankHeaderIndex(lines)
  if (headerIdx < 0) {
    return {
      ok: false as const,
      step: "find_header",
      error: "mBank header not found (#Data operacji / #Opis operacji)",
      extra: { firstLines: lines.slice(0, 40) },
    }
  }

  const headerLine = lines[headerIdx]
  const delimiter = ";" // ten plik jest na średnikach
  const rawHeaders = headerLine.split(delimiter).map((h) => h.trim())
  const headers = rawHeaders
    .map(stripHashHeader)
    .filter((h) => h !== "") // usuń pusty ogon po ostatnim ;

  const dataText = lines.slice(headerIdx + 1).join("\n")

  // parsuj jako tablica pól, potem mapuj ręcznie → ignorujesz puste trailing pola
  const rows: string[][] = parse(dataText, {
    columns: false,
    delimiter,
    quote: '"',
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  })

  const records: Record<string, string>[] = rows.map((r) => {
    // usuń trailing puste kolumny
    const rr = [...r]
    while (rr.length > 0 && String(rr[rr.length - 1] ?? "").trim() === "") rr.pop()

    // utnij/padnij do długości headers
    const fixed = rr.slice(0, headers.length)
    while (fixed.length < headers.length) fixed.push("")

    const obj: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = String(fixed[i] ?? "").trim()
    return obj
  })

  return {
    ok: true as const,
    headers,
    records,
    headerIdx,
  }
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

  const parsed = parseMbankTable(csvText)

  if (!parsed.ok) {
    console.error("[BANK_STATEMENT] parse failed", parsed)
    return { ok: false, step: parsed.step, error: parsed.error, extra: parsed.extra }
  }

  console.info("[BANK_STATEMENT] mbank header", {
    headerIdx: parsed.headerIdx,
    headers: parsed.headers,
  })

  const records = parsed.records
  console.info("[BANK_STATEMENT] parsed rows", { rows: records.length })
  console.info("[BANK_STATEMENT] first row preview", records[0])

  const mapped: any[] = []
  let invalid = 0

  for (const row of records) {
    const bookingDateRaw = row["Data operacji"] ?? ""
    const bookingDate = parseDateToISO(bookingDateRaw)
    const valueDate = null // mBank format nie ma osobnej daty wartości

    const amountRaw = row["Kwota"] ?? ""
    const currencyMatch = amountRaw.match(/([A-Z]{3})\s*$/)
    const currency = (currencyMatch?.[1] ?? "PLN").toUpperCase()
    const amount = parseAmount(amountRaw)

    const description = row["Opis operacji"] ?? ""

    const categoryFromBank = row["Kategoria"]?.trim() || ""
    const category = categoryFromBank || "uncategorised"

    if (!bookingDate || amount == null || !description) {
      invalid += 1
      continue
    }

    const direction = amount < 0 ? "out" : "in"

    const counterpartyName = row["Rachunek"] ?? null
    const counterpartyAccount = null

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

  // Detect recurring patterns after import
  if (upserted > 0) {
    try {
      const { detectAndUpdateRecurring } = await import('./detectAndUpdateRecurring');
      const detectResult = await detectAndUpdateRecurring(orgId);
      console.info("[BANK_STATEMENT] recurring detection complete", detectResult);
    } catch (detectError: any) {
      console.error("[BANK_STATEMENT] recurring detection failed", detectError);
      // Don't fail the import if detection fails
    }
  }

  return { ok: true, parsed: records.length, valid: mapped.length, invalid, upserted }
}

