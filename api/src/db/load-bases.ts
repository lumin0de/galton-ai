/**
 * load-bases.ts
 * Carrega os CSVs de /bases/ para o schema galton no Supabase.
 * Uso: npm run load-bases (a partir de api/)
 */

import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'
import { db } from './supabase'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const BASES_DIR = path.resolve(__dirname, '../../../bases')

// ─── Mapa de nomes fictícios ──────────────────────────────────────────────────

const FIRST_NAMES = [
  'Ana Paula', 'Beatriz', 'Carla', 'Daniela', 'Fernanda',
  'Gabriela', 'Helena', 'Isabela', 'Juliana', 'Larissa',
  'Mariana', 'Natália', 'Patrícia', 'Renata', 'Silvia',
  'Tatiana', 'Valéria', 'Amanda', 'Cláudia', 'Débora',
  'André', 'Bruno', 'Carlos', 'Diego', 'Eduardo',
  'Fábio', 'Guilherme', 'Henrique', 'Igor', 'João',
  'Lucas', 'Marcelo', 'Nicolas', 'Otávio', 'Pedro',
  'Rafael', 'Sérgio', 'Thiago', 'Victor', 'William',
]

const LAST_NAMES = [
  'Alves', 'Barbosa', 'Carvalho', 'Costa', 'Ferreira',
  'Gomes', 'Lima', 'Martins', 'Oliveira', 'Pereira',
  'Ribeiro', 'Santos', 'Silva', 'Souza', 'Teixeira',
  'Vieira', 'Rocha', 'Rodrigues', 'Araújo', 'Nascimento',
  'Medeiros', 'Freitas', 'Campos', 'Correia', 'Mendes',
]

const CLINIC_PREFIXES = [
  'Clínica', 'Centro Médico', 'Instituto', 'Consultório', 'Espaço',
  'Núcleo', 'Polo', 'Centro de Estética', 'Dermoclinic', 'Skin',
]

const CLINIC_SUFFIXES = [
  'Estética', 'Dermatologia', 'Saúde', 'Bem-Estar', 'Beauty',
  'Medicina Estética', 'Prime', 'Excellence', 'Avançada', 'Integrada',
  'Vita', 'Estetica Avançada', 'Plus', 'Clinic', 'Health',
]

const CLINIC_CNPJ_TERMS = ['LTDA', 'SS LTDA', 'EIRELI', 'MÉDICA SS LTDA', 'CLÍNICA LTDA']

let nameMapPath = path.join(BASES_DIR, 'name-map.json')
let nameMap: Record<string, string> = {}

function loadOrCreateNameMap(): void {
  if (fs.existsSync(nameMapPath)) {
    nameMap = JSON.parse(fs.readFileSync(nameMapPath, 'utf-8'))
    console.log(`✓ Mapa de nomes carregado: ${Object.keys(nameMap).length} entradas`)
  }
}

let nameCounter = 0
let clinicCounter = 0

function getFictionalName(realName: string, isPJ: boolean): string {
  if (!realName || realName.trim() === '') return realName

  const key = realName.trim().toUpperCase()
  if (nameMap[key]) return nameMap[key]

  let fictName: string

  if (isPJ || looksLikeClinic(realName)) {
    const prefix = CLINIC_PREFIXES[clinicCounter % CLINIC_PREFIXES.length] ?? 'Clínica'
    const suffix = CLINIC_SUFFIXES[clinicCounter % CLINIC_SUFFIXES.length] ?? 'Estética'
    const cnpjTerm = CLINIC_CNPJ_TERMS[clinicCounter % CLINIC_CNPJ_TERMS.length] ?? 'LTDA'
    fictName = `${prefix} ${suffix} ${cnpjTerm}`
    clinicCounter++
  } else {
    const first = FIRST_NAMES[nameCounter % FIRST_NAMES.length] ?? 'Ana'
    const last1 = LAST_NAMES[nameCounter % LAST_NAMES.length] ?? 'Silva'
    const last2 = LAST_NAMES[(nameCounter + 7) % LAST_NAMES.length] ?? 'Santos'
    fictName = `${first} ${last1} ${last2}`
    nameCounter++
  }

  nameMap[key] = fictName
  return fictName
}

function looksLikeClinic(name: string): boolean {
  const upper = name.toUpperCase()
  return (
    upper.includes('CLÍNICA') || upper.includes('CLINICA') ||
    upper.includes('LTDA') || upper.includes('EIRELI') ||
    upper.includes('CENTRO') || upper.includes('INSTITUTO') ||
    upper.includes('SAÚDE') || upper.includes('CONSULTÓRIO') ||
    upper.includes(' SS ') || upper.includes(' SC ')
  )
}

function saveNameMap(): void {
  fs.writeFileSync(nameMapPath, JSON.stringify(nameMap, null, 2), 'utf-8')
  console.log(`✓ Mapa de nomes salvo: ${Object.keys(nameMap).length} entradas`)
}

// ─── Encoding fix ─────────────────────────────────────────────────────────────

function fixEncoding(str: string): string {
  if (!str) return str
  return str
    .replace(/Ã©/g, 'é').replace(/Ã¢/g, 'â').replace(/Ã£/g, 'ã')
    .replace(/Ã§/g, 'ç').replace(/Ã¡/g, 'á').replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú').replace(/Ã­/g, 'í').replace(/Ã"/g, 'Ó')
    .replace(/Ã‰/g, 'É').replace(/Ã‚/g, 'Â').replace(/Ãƒ/g, 'Ã')
    .replace(/Ã•/g, 'Õ').replace(/Ãµ/g, 'õ').replace(/Ã€/g, 'À')
}

function parseNumber(val: string): number {
  if (!val || val.trim() === '' || val === '---') return 0
  return parseFloat(val.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')) || 0
}

const PT_MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', marco: '03',
  abril: '04', maio: '05', junho: '06', julho: '07',
  agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === '' || val === '---') return null
  // ISO format: 2024-08-27
  const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  // Portuguese format: "terça-feira, 27 de agosto de 2024"
  // Note: [^\s]+ instead of \w+ to capture accented chars like "março"
  const ptMatch = val.match(/(\d{1,2})\s+de\s+([^\s,]+)\s+de\s+(\d{4})/)
  if (ptMatch) {
    const day = ptMatch[1]!.padStart(2, '0')
    const monthKey = ptMatch[2]!.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const year = ptMatch[3]
    const month = PT_MONTHS[monthKey] ?? PT_MONTHS[ptMatch[2]!.toLowerCase()]
    if (month) return `${year}-${month}-${day}`
  }
  return null
}

function computeQuarter(year: number, month: number): string | null {
  if (!year || !month) return null
  return `Q${Math.ceil(month / 3)}_${year}`
}

function normalizeBrand(brand: string): string {
  const b = brand.toUpperCase().trim()
  if (b.startsWith('RESTYLANE')) return 'RESTYLANE'
  if (b.startsWith('DYSPORT')) return 'DYSPORT'
  if (b.startsWith('SCULPTRA')) return 'SCULPTRA'
  return b
}

function readCsv(filename: string): Record<string, string>[] {
  const filePath = path.join(BASES_DIR, filename)
  const raw = fs.readFileSync(filePath, 'utf-8')
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[]
}

// ─── 1. Insert representative ─────────────────────────────────────────────────

async function insertRepresentative(): Promise<string> {
  console.log('\n→ Inserindo representante CARLOS JUNIOR...')

  const { data, error } = await db
    .from('representatives')
    .upsert(
      {
        name: 'CARLOS JUNIOR',
        territory_code: 'BRAX110301MS',
        email: 'carlos@galton.ai',
        manager_district: 'CAIO SAMPAIO DANTAS',
        manager_regional: 'CAMILA DUARTE ACHUR',
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (error) throw new Error(`Erro ao inserir rep: ${error.message}`)
  const repId = (data as { id: string }).id
  console.log(`✓ Representante inserido. ID: ${repId}`)
  return repId
}

// ─── 2. Load painel.csv → doctors ────────────────────────────────────────────

async function loadDoctors(repId: string): Promise<void> {
  console.log('\n→ Carregando painel.csv → doctors...')
  const rows = readCsv('painel.csv')

  // Build name map from painel first pass
  for (const row of rows) {
    const realName = fixEncoding(row['0.Nome HCP'] || '')
    const pfPj = row['0.PF/PJ'] || ''
    const isPJ = pfPj.toUpperCase() === 'PJ'
    if (realName) getFictionalName(realName, isPJ)

    const oneName = fixEncoding(row['0.ONE NAME'] || '')
    if (oneName) getFictionalName(oneName, looksLikeClinic(oneName))
  }

  const BATCH = 50
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const records = batch.map((row) => {
      const realName = fixEncoding(row['0.Nome HCP'] || '')
      const pfPj = row['0.PF/PJ'] || ''
      const isPJ = pfPj.toUpperCase() === 'PJ'
      const oneName = fixEncoding(row['0.ONE NAME'] || '')

      return {
        id: row['account_vod__c'] || '',
        name: getFictionalName(realName, isPJ),
        cpf: row['0.CPF'] || null,
        cnpj: row['0.CNPJ'] || null,
        crm: row['0.CRM'] || null,
        type: fixEncoding(row['0.Categoria'] || ''),
        pf_pj: pfPj,
        one_id: row['0.ONE ID'] || null,
        one_name: oneName ? getFictionalName(oneName, looksLikeClinic(oneName)) : null,
        rep_id: repId,
        territory_code: 'BRAX110301MS',
        seg_dysport: row['0.Seg_Dys'] || null,
        seg_restylane: row['0.Seg_Res'] || null,
        seg_sculptra: row['0.Seg_Scu'] || null,
      }
    }).filter(r => r.id)

    const { error } = await db.from('doctors').upsert(records, { onConflict: 'id' })
    if (error) {
      console.error(`Erro ao inserir doctors batch ${i}: ${error.message}`)
    } else {
      inserted += records.length
    }
  }

  console.log(`✓ Doctors inseridos: ${inserted}`)
}

// ─── 3. Load vendas.csv → sales ──────────────────────────────────────────────

async function loadSales(): Promise<void> {
  console.log('\n→ Carregando vendas.csv → sales...')
  const rows = readCsv('vendas.csv')

  const BATCH = 200
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const records = batch.map((row) => {
      // MES_COMPETENCIA format: "2024/08" → year=2024, month=8
      const mesRaw = row['MES_COMPETENCIA'] || ''
      let yearRef = parseInt(row['ANO'] || '0', 10) || null
      let monthNum = 0
      if (mesRaw.includes('/')) {
        const parts = mesRaw.split('/')
        yearRef = parseInt(parts[0] || '0', 10) || yearRef
        monthNum = parseInt(parts[1] || '0', 10)
      } else {
        monthNum = parseInt(mesRaw, 10)
      }
      const monthRef = isNaN(monthNum) || monthNum === 0 ? null : monthNum

      const oneName = fixEncoding(row['ONEID_NAME'] || '')
      const cliente = fixEncoding(row['CLIENTE'] || '')

      return {
        // id omitted — uuid generated by DB (NRO_PEDIDO não é único: 1 pedido = N produtos)
        order_id: row['NRO_PEDIDO'] || null,
        order_status: row['STS_PEDIDO'] || null,
        month_ref: monthRef,
        year_ref: yearRef,
        created_at: parseDate(row['DT_CRIACAO'] || ''),
        billed_at: parseDate(row['DT_FATURAMENTO'] || ''),
        territory_code: row['TERRITORIO'] || null,
        distributor: row['DISTRIBUIDOR'] || null,
        doctor_id: row['ACCOUNT_ID_FATURADO_POR'] || null,
        one_id: row['ONEID_ID'] || null,
        one_name: oneName ? getFictionalName(oneName, looksLikeClinic(oneName)) : (
          cliente ? getFictionalName(cliente, looksLikeClinic(cliente)) : null
        ),
        brand: normalizeBrand(row['MARCA'] || ''),
        product_code: row['COD_PRODUTO'] || null,
        product_name: row['PRODUTO'] || null,
        qty: parseInt(row['QTD'] || '0', 10) || 0,
        qty_equiv: parseNumber(row['QTD_EQUIV'] || '0'),
        value: parseNumber(row['VALOR'] || '0'),
        segmentation: row['SEGMENTACAO'] || null,
        is_bonus: (row['BONIFICACAO'] || '') !== 'NÃO BONIFICADO',
        // Derive quarter from year + month (TRIMESTRE column has "mar.-24" format, not useful)
        quarter: yearRef && monthRef ? computeQuarter(yearRef, monthRef) : null,
      }
    })

    const { error } = await db.from('sales').insert(records)
    if (error) {
      console.error(`Erro ao inserir sales batch ${i}: ${error.message}`)
    } else {
      inserted += records.length
    }
  }

  console.log(`✓ Sales inseridas: ${inserted}`)
}

// ─── 4. Load ativo_positivado.csv → active_positivated ───────────────────────

async function loadActivoPositivado(): Promise<void> {
  console.log('\n→ Carregando ativo_positivado.csv → active_positivated...')
  const rows = readCsv('ativo_positivado.csv')

  const BATCH = 200
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const records = batch.map((row) => {
      const doctorName = fixEncoding(row['NOME'] || '')
      const oneName = fixEncoding(row['ONEID_NAME'] || '')

      return {
        doctor_id: row['ACCOUNT_ID'] || null,
        one_id: row['ONEID'] || null,
        one_name: oneName ? getFictionalName(oneName, looksLikeClinic(oneName)) : null,
        doctor_name: doctorName ? getFictionalName(doctorName, looksLikeClinic(doctorName)) : null,
        period: row['PERIODO'] || null,
        product_family: row['FAMILIA'] || null,
        is_active: parseInt(row['CONTA_ATIVA'] || '0', 10),
        is_positivated: parseInt(row['CONTA_POSITIVADA'] || '0', 10),
        is_active_label: row['CONTA_ATIVA_FILTRO'] || null,
        is_positivated_label: row['CONTA_POSITIVADA_FILTRO'] || null,
        qty_equiv: parseNumber(row['QUANTIDADE_EQV'] || '0'),
      }
    })

    const { error } = await db.from('active_positivated').insert(records)
    if (error) {
      console.error(`Erro ao inserir active_positivated batch ${i}: ${error.message}`)
    } else {
      inserted += records.length
    }
  }

  console.log(`✓ Active/Positivated inseridos: ${inserted}`)
}

// ─── 5. Load cota.csv → quotas ───────────────────────────────────────────────

async function loadQuotas(repId: string): Promise<void> {
  console.log('\n→ Carregando cota.csv → quotas...')
  const rows = readCsv('cota.csv')

  const records = rows.map((row) => ({
    rep_id: repId,
    territory_code: row['TERRITORIO'] || 'BRAX110301MS',
    product_family: normalizeBrand(row['PRODUTO'] || ''),
    mth1: parseNumber(row['MTH 1 FINAL QUOTA - UND'] || '0'),
    mth2: parseNumber(row['MTH 2 FINAL QUOTA - UND'] || '0'),
    mth3: parseNumber(row['MTH 3 FINAL QUOTA - UND'] || '0'),
    ref_quarter: 'Q4_2024',
  }))

  const { error } = await db.from('quotas').insert(records)
  if (error) {
    console.error(`Erro ao inserir quotas: ${error.message}`)
  } else {
    console.log(`✓ Quotas inseridas: ${records.length}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Galton AI — Carga de Dados         ║')
  console.log('╚══════════════════════════════════════╝')

  loadOrCreateNameMap()

  try {
    // Truncate tables that use INSERT (not upsert) to ensure idempotency
    // .not('id', 'is', null) matches all rows (id is always NOT NULL)
    console.log('\n→ Limpando dados anteriores...')
    await db.from('sales').delete().not('id', 'is', null)
    await db.from('active_positivated').delete().not('id', 'is', null)
    await db.from('quotas').delete().not('id', 'is', null)
    console.log('✓ Tabelas limpas')

    const repId = await insertRepresentative()
    await loadDoctors(repId)
    saveNameMap()
    await loadSales()
    await loadActivoPositivado()
    await loadQuotas(repId)

    // Final count verification
    console.log('\n─── Contagem final ───')
    const tables = ['representatives', 'doctors', 'sales', 'quotas', 'active_positivated'] as const
    for (const table of tables) {
      const { count } = await db.from(table).select('*', { count: 'exact', head: true })
      console.log(`  ${table}: ${count} registros`)
    }

    console.log('\n✅ Carga concluída com sucesso!')
  } catch (err) {
    console.error('\n❌ Erro durante a carga:', err)
    process.exit(1)
  }
}

main()
