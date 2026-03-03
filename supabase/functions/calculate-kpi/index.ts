import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface KPIMaster {
  id: string
  kpi_code: string
  kpi_name: string
  unit_type: string
  calculation_type: string
  direction: string
  default_cap: number | null
  // New advanced scoring fields
  score_cap_pct: number
  green_threshold_pct: number
  yellow_threshold_pct: number
  red_threshold_pct: number
  kpi_category: string | null
}

interface TemplateItem {
  kpi_id: string
  weight_pct: number
  baseline_annual_target_value: number | null
  baseline_annual_target_pct: number | null
  kpi_master: KPIMaster
}

interface MonthlyTarget {
  kpi_id: string
  target_value: number | null
  target_pct: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const targetUserId = body.user_id || null
    const targetYear = body.year || new Date().getFullYear()
    const targetMonth = body.month || new Date().getMonth() + 1

    console.log(`[KPI Engine] Starting calculation: year=${targetYear}, month=${targetMonth}, user=${targetUserId || 'ALL'}`)

    // 1. Get all users with their positions
    let profilesQuery = supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, position_id')
    
    if (targetUserId) {
      profilesQuery = profilesQuery.eq('user_id', targetUserId)
    }

    const { data: profiles, error: profileErr } = await profilesQuery
    if (profileErr) throw new Error(`Failed to fetch profiles: ${profileErr.message}`)

    const { data: allRoles } = await supabaseAdmin.from('user_roles').select('user_id, org_role')
    const roleMap = new Map((allRoles || []).map((r: any) => [r.user_id, r.org_role]))

    // 2. Get all active templates for the year with items (including new kpi_master fields)
    const { data: templates, error: tplErr } = await supabaseAdmin
      .from('kpi_templates')
      .select('*, positions(*), kpi_template_items(*, kpi_master(*))')
      .eq('year', targetYear)
      .eq('is_active', true)
    
    if (tplErr) throw new Error(`Failed to fetch templates: ${tplErr.message}`)

    // 3. Get all positions for org_role mapping
    const { data: positions } = await supabaseAdmin
      .from('positions')
      .select('id, position_code')
      .eq('is_active', true)
    
    const roleToPosition: Record<string, string> = {}
    for (const pos of (positions || [])) {
      const code = pos.position_code.toLowerCase()
      if (code.includes('tss') || code.includes('sales_person') || code.includes('salesperson')) roleToPosition['sales_person'] = pos.id
      if (code.includes('sspv') || code.includes('supervisor')) roleToPosition['supervisor'] = pos.id
      if (code.includes('manager') || code.includes('sales_manager')) roleToPosition['sales_manager'] = pos.id
      if (code.includes('adm') || code.includes('rep')) roleToPosition['representative_management'] = pos.id
    }

    // 4. Get monthly targets
    let targetsQuery = supabaseAdmin
      .from('kpi_monthly_targets')
      .select('user_id, kpi_id, target_value, target_pct')
      .eq('year', targetYear)
      .eq('month', targetMonth)
    
    if (targetUserId) {
      targetsQuery = targetsQuery.eq('user_id', targetUserId)
    }

    const { data: monthlyTargets } = await targetsQuery
    const targetMap = new Map<string, MonthlyTarget>()
    for (const t of (monthlyTargets || [])) {
      targetMap.set(`${t.user_id}::${t.kpi_id}`, t)
    }

    // 5. Get approved submissions
    let subsQuery = supabaseAdmin
      .from('kpi_submissions')
      .select('user_id, kpi_id, submitted_value')
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .eq('status', 'approved')
    
    if (targetUserId) {
      subsQuery = subsQuery.eq('user_id', targetUserId)
    }

    const { data: submissions } = await subsQuery
    const submissionMap = new Map<string, number>()
    for (const s of (submissions || [])) {
      submissionMap.set(`${s.user_id}::${s.kpi_id}`, s.submitted_value || 0)
    }

    // 6. Pre-fetch transactional data
    const monthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1
    const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const { data: invoices } = await supabaseAdmin
      .from('invoices')
      .select('sales_id, net_sales, gross_profit, account_id')
      .gte('issue_date', monthStart)
      .lt('issue_date', monthEnd)

    const { data: deals } = await supabaseAdmin
      .from('deals')
      .select('sales_id, stage, value, account_id, created_at, updated_at')

    const { data: activities } = await supabaseAdmin
      .from('sales_activities')
      .select('sales_id, type, account_id, activity_date')
      .gte('activity_date', monthStart)
      .lt('activity_date', monthEnd)

    // Pre-aggregate per user
    const userInvoiceData = new Map<string, { totalRevenue: number; totalGP: number; accountIds: Set<string> }>()
    for (const inv of (invoices || [])) {
      const existing = userInvoiceData.get(inv.sales_id) || { totalRevenue: 0, totalGP: 0, accountIds: new Set<string>() }
      existing.totalRevenue += Number(inv.net_sales || 0)
      existing.totalGP += Number(inv.gross_profit || 0)
      existing.accountIds.add(inv.account_id)
      userInvoiceData.set(inv.sales_id, existing)
    }

    const userDealData = new Map<string, { wonDeals: number; totalDeals: number; qualifiedDeals: number; totalValue: number }>()
    for (const d of (deals || [])) {
      const existing = userDealData.get(d.sales_id) || { wonDeals: 0, totalDeals: 0, qualifiedDeals: 0, totalValue: 0 }
      existing.totalDeals++
      if (d.stage === 'closed_won') existing.wonDeals++
      if (['proposal', 'negotiation', 'closed_won', 'closed_lost'].includes(d.stage)) existing.qualifiedDeals++
      existing.totalValue += Number(d.value || 0)
      userDealData.set(d.sales_id, existing)
    }

    const userActivityData = new Map<string, { count: number; accountIds: Set<string> }>()
    for (const a of (activities || [])) {
      const existing = userActivityData.get(a.sales_id) || { count: 0, accountIds: new Set<string>() }
      existing.count++
      if (a.account_id) existing.accountIds.add(a.account_id)
      userActivityData.set(a.sales_id, existing)
    }

    const teamInvoiceTotal = (invoices || []).reduce((sum, inv) => sum + Number(inv.net_sales || 0), 0)
    const teamGPTotal = (invoices || []).reduce((sum, inv) => sum + Number(inv.gross_profit || 0), 0)

    // ─── Process each user ───────────────────────────────────
    const allResults: any[] = []
    const allTotals: any[] = []
    let processedCount = 0

    for (const profile of (profiles || [])) {
      const userId = profile.user_id

      let positionId = profile.position_id
      if (!positionId) {
        const orgRole = roleMap.get(userId)
        if (orgRole && roleToPosition[orgRole]) {
          positionId = roleToPosition[orgRole]
        }
      }

      if (!positionId) {
        console.log(`[KPI Engine] Skipping user ${profile.full_name}: no position mapped`)
        continue
      }

      const template = (templates || []).find((t: any) => t.position_id === positionId)
      if (!template || !template.kpi_template_items?.length) {
        console.log(`[KPI Engine] Skipping user ${profile.full_name}: no active template`)
        continue
      }

      let totalWeightedScore = 0

      for (const item of template.kpi_template_items as TemplateItem[]) {
        const kpi = item.kpi_master
        if (!kpi) continue

        // Get target
        const mtKey = `${userId}::${item.kpi_id}`
        const monthlyTarget = targetMap.get(mtKey)

        let targetValue = monthlyTarget?.target_value ?? null
        let targetPct = monthlyTarget?.target_pct ?? null

        if (targetValue == null && item.baseline_annual_target_value != null) {
          targetValue = Math.round((item.baseline_annual_target_value / 12) * 100) / 100
        }
        if (targetPct == null && item.baseline_annual_target_pct != null) {
          targetPct = item.baseline_annual_target_pct
        }

        // Calculate actual value
        let actualValue: number | null = null

        if (kpi.calculation_type === 'AUTO') {
          actualValue = calculateAutoKPI(kpi.kpi_code, userId, {
            invoiceData: userInvoiceData.get(userId),
            dealData: userDealData.get(userId),
            activityData: userActivityData.get(userId),
            teamRevenue: teamInvoiceTotal,
            teamGP: teamGPTotal,
          })
        } else if (kpi.calculation_type === 'HYBRID') {
          const subVal = submissionMap.get(mtKey)
          if (subVal != null) {
            actualValue = subVal
          } else {
            actualValue = calculateAutoKPI(kpi.kpi_code, userId, {
              invoiceData: userInvoiceData.get(userId),
              dealData: userDealData.get(userId),
              activityData: userActivityData.get(userId),
              teamRevenue: teamInvoiceTotal,
              teamGP: teamGPTotal,
            })
          }
        } else {
          const subVal = submissionMap.get(mtKey)
          actualValue = subVal ?? 0
        }

        if (actualValue == null) actualValue = 0

        // Determine effective target
        const isPercentKPI = kpi.unit_type === '%' || kpi.unit_type === 'Score 0-100'
        const effectiveTarget = isPercentKPI ? (targetPct ?? 100) : (targetValue ?? 0)
        const actualPct = isPercentKPI ? actualValue : null

        // ─── STEP 1: Calculate base ratio ───
        let ratio = 0
        if (effectiveTarget > 0) {
          if (kpi.direction === 'lower_is_better') {
            ratio = effectiveTarget / (actualValue || 1)
          } else {
            ratio = actualValue / effectiveTarget
          }
        } else if (kpi.unit_type === 'Binary') {
          ratio = actualValue >= 1 ? 1 : 0
        }

        // ─── STEP 2: Apply score cap from kpi_master ───
        const capRatio = (kpi.score_cap_pct ?? 100) / 100
        const ratioCapped = Math.min(ratio, capRatio)
        const achievementPct = Math.round(ratioCapped * 10000) / 100

        // ─── STEP 3: Weighted score ───
        const weightedScore = Math.round(ratioCapped * item.weight_pct * 100) / 100

        // ─── STEP 4: KPI Status using per-KPI thresholds ───
        let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED'
        const greenThreshold = kpi.green_threshold_pct ?? 100
        const yellowThreshold = kpi.yellow_threshold_pct ?? 90
        if (achievementPct >= greenThreshold) status = 'GREEN'
        else if (achievementPct >= yellowThreshold) status = 'YELLOW'

        totalWeightedScore += weightedScore

        allResults.push({
          user_id: userId,
          kpi_id: item.kpi_id,
          year: targetYear,
          month: targetMonth,
          target_value: targetValue,
          target_pct: targetPct,
          actual_value: actualValue,
          actual_pct: actualPct,
          achievement_ratio: Math.round(ratioCapped * 10000) / 10000,
          achievement_pct: achievementPct,
          weight_pct: item.weight_pct,
          weighted_score: weightedScore,
          status,
          calculated_at: new Date().toISOString(),
        })
      }

      // ─── PART 4: Total KPI Score Status ───
      const totalScore = Math.round(totalWeightedScore * 100) / 100
      let totalStatus: 'EXCELLENT' | 'ON_TRACK' | 'NEED_IMPROVEMENT' = 'NEED_IMPROVEMENT'
      if (totalScore >= 100) totalStatus = 'EXCELLENT'
      else if (totalScore >= 90) totalStatus = 'ON_TRACK'

      allTotals.push({
        user_id: userId,
        year: targetYear,
        month: targetMonth,
        total_score: totalScore,
        status: totalStatus,
        calculated_at: new Date().toISOString(),
      })

      processedCount++
    }

    // 7. Upsert results
    if (allResults.length > 0) {
      const { error: resErr } = await supabaseAdmin
        .from('kpi_results_monthly')
        .upsert(allResults, { onConflict: 'user_id,kpi_id,year,month' })
      
      if (resErr) throw new Error(`Failed to upsert results: ${resErr.message}`)
    }

    if (allTotals.length > 0) {
      const { error: totErr } = await supabaseAdmin
        .from('kpi_total_score_monthly')
        .upsert(allTotals, { onConflict: 'user_id,year,month' })
      
      if (totErr) throw new Error(`Failed to upsert totals: ${totErr.message}`)
    }

    console.log(`[KPI Engine] Done. Processed ${processedCount} users, ${allResults.length} KPI results.`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Kalkulasi KPI selesai untuk ${processedCount} user, ${allResults.length} hasil KPI.`,
        processed_users: processedCount,
        total_results: allResults.length,
        year: targetYear,
        month: targetMonth,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[KPI Engine] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── AUTO KPI Calculation Functions ──────────────────────────
interface TransactionalData {
  invoiceData?: { totalRevenue: number; totalGP: number; accountIds: Set<string> }
  dealData?: { wonDeals: number; totalDeals: number; qualifiedDeals: number; totalValue: number }
  activityData?: { count: number; accountIds: Set<string> }
  teamRevenue: number
  teamGP: number
}

function calculateAutoKPI(kpiCode: string, userId: string, data: TransactionalData): number {
  const inv = data.invoiceData || { totalRevenue: 0, totalGP: 0, accountIds: new Set<string>() }
  const deal = data.dealData || { wonDeals: 0, totalDeals: 0, qualifiedDeals: 0, totalValue: 0 }
  const act = data.activityData || { count: 0, accountIds: new Set<string>() }

  switch (kpiCode) {
    case 'TSS001':
    case 'GOV001':
      return inv.totalRevenue

    case 'GOV002':
      return data.teamRevenue

    case 'GOV010':
      return inv.totalRevenue

    case 'TSS002':
    case 'GOV003':
      if (data.teamGP > 0) return Math.round((inv.totalGP / data.teamGP) * 10000) / 100
      return 0

    case 'GOV004':
      if (inv.totalRevenue > 0) return Math.round((inv.totalGP / inv.totalRevenue) * 10000) / 100
      return 0

    case 'GOV008':
      if (deal.qualifiedDeals > 0) return Math.round((deal.wonDeals / deal.qualifiedDeals) * 10000) / 100
      return 0

    case 'GOV011':
      return 0

    case 'ADM003':
    case 'ADM004':
      return 0

    case 'GOV005':
    case 'GOV006':
      return inv.accountIds.size + act.accountIds.size

    default:
      return act.count
  }
}
