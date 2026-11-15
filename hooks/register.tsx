import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { WeekLimit } from '../types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const RESET_DAY = 3 // среда (0 = воскресенье)
const RESET_HOUR = 10

const limitAtom = atom({ plugin: 'weekly-pace', key: 'limit' } as const, null)
const nowAtom = atom({ plugin: 'weekly-pace', key: 'now' } as const, 0)

function pickWeek(limits: SessionRateLimit[]): WeekLimit | null {
  const w = limits.find(l => l.kind === 'seven_day')
  return w ? { percentUsed: w.percentUsed, resetsAt: w.resetsAt } : null
}

/** Начало недели: последняя среда 10:00 по местному времени не позже now. */
function weekStartLocal(now: number): number {
  const d = new Date(now)
  d.setHours(RESET_HOUR, 0, 0, 0)
  const back = (d.getDay() - RESET_DAY + 7) % 7
  d.setDate(d.getDate() - back)
  if (d.getTime() > now) d.setDate(d.getDate() - 7)
  return d.getTime()
}

function weekBounds(now: number, limit: WeekLimit | null): { start: number; end: number } {
  const reset = limit?.resetsAt ? Date.parse(limit.resetsAt) : NaN
  if (Number.isFinite(reset) && reset > now && reset - now <= WEEK_MS) {
    return { start: reset - WEEK_MS, end: reset }
  }
  const start = weekStartLocal(now)
  return { start, end: start + WEEK_MS }
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))
const fmt = (n: number) => (Math.round(n * 10) / 10).toString()

function fmtLeft(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  return d > 0 ? `${d}д ${h % 24}ч` : `${h}ч ${Math.floor((ms % 3_600_000) / 60_000)}м`
}

const BAR_H = 16
const CAP_W = BAR_H / 2
const TRACK = '#8884'
const DASH = '#666'

function fillColor(plan: number, used: number | null): string {
  if (used === null) return TRACK
  return used > plan ? (used - plan > 10 ? '#e5484d' : '#f5a524') : '#30a46c'
}

/** Полукруглый торец шкалы, фиксированные 8×16 px — не растягивается. */
function capSvg(side: 'left' | 'right', color: string): string {
  const H = BAR_H
  const R = CAP_W
  const d =
    side === 'left'
      ? `M${R} 0 A${R} ${R} 0 0 0 ${R} ${H} Z`
      : `M0 0 A${R} ${R} 0 0 1 0 ${H} Z`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${H}" viewBox="0 0 ${R} ${H}">` +
    `<path d="${d}" fill="${color}"/></svg>`
  )
}

/** Середина шкалы: растягивается по ширине (viewBox 100 = 100%). */
function barSvg(plan: number, used: number | null): string {
  const H = BAR_H
  const usedRect =
    used === null || used <= 0
      ? ''
      : `<rect x="0" y="0" width="${clamp(used).toFixed(2)}" height="${H}" fill="${fillColor(plan, used)}"/>`
  const px = clamp(plan).toFixed(2)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${H}" viewBox="0 0 100 ${H}" preserveAspectRatio="none">` +
    `<rect x="0" y="0" width="100" height="${H}" fill="${TRACK}"/>` +
    usedRect +
    `<line x1="${px}" y1="0" x2="${px}" y2="${H}" stroke="${DASH}" stroke-width="2" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  )
}

function barText(plan: number, used: number | null, cells = 16): string {
  const u = used === null ? 0 : Math.round((clamp(used) / 100) * cells)
  const p = Math.min(cells - 1, Math.floor((clamp(plan) / 100) * cells))
  let s = ''
  for (let i = 0; i < cells; i++) s += i === p ? '┊' : i < u ? '█' : '░'
  return s
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, limitAtom, () => pickWeek(usage.rateLimits))
    const tick = async () => {
      const now = await $.clock.now()
      await update($, nowAtom, () => now)
    }
    await tick()
    $.clock.every(5 * 60 * 1000, () => void tick())
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const week = pickWeek(e.rateLimits)
      const now = await $.clock.now()
      await update($, limitAtom, () => week)
      await update($, nowAtom, () => now)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const limit = await read($, limitAtom)
    const now = (await read($, nowAtom)) || (await $.clock.now())
    const { start, end } = weekBounds(now, limit)
    const plan = clamp(((now - start) / (end - start)) * 100)
    const used = limit ? limit.percentUsed : null
    const delta = used === null ? null : used - plan

    const label =
      used === null
        ? `План ${fmt(plan)}% · сброс ${fmtLeft(end - now)}`
        : `${fmt(used)}% / план ${fmt(plan)}% (${delta! >= 0 ? "+" : ""}${fmt(delta!)}) · сброс ${fmtLeft(end - now)}`
    const color = delta === null ? undefined : delta > 10 ? 'error' : delta > 0 ? 'warning' : 'success'

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box gap={1}>
          <Text color={color}>{barText(plan, used)}</Text>
          <Text dimColor>{label}</Text>
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" alignItems="center" gap={1} width="100%">
        <Box flexGrow={1} flexShrink={1} minWidth={0} flexDirection="row" alignItems="center">
          <Box flexShrink={0}>
            <Svg
              source={capSvg('left', used !== null && used > 0 ? fillColor(plan, used) : TRACK)}
              alt="край шкалы"
              width={CAP_W}
              height={BAR_H}
            />
          </Box>
          <Box flexGrow={1} flexShrink={1} minWidth={0}>
            <Svg source={barSvg(plan, used)} alt={label} height={BAR_H} />
          </Box>
          <Box flexShrink={0}>
            <Svg
              source={capSvg('right', used !== null && used >= 100 ? fillColor(plan, used) : TRACK)}
              alt="край шкалы"
              width={CAP_W}
              height={BAR_H}
            />
          </Box>
        </Box>
        <Box flexShrink={0}>
          <Text dimColor>{label}</Text>
        </Box>
      </Box>
    )
  })
}
