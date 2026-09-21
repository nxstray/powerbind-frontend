import { describe, it, expect } from 'vitest'

import {
  SERIES_COLORS,
  lineColor,
  niceNum,
  niceTicks,
  trimNum,
  fmtGrafana,
  fmtBytes,
  fmtCompact,
  formatValue,
  formatYLabel,
  fmtTick,
  fmtPrecise,
} from '@/utils/metricsFormat'

describe('lineColor', () => {
  it('mengembalikan warna Grafana sesuai urutan seri', () => {
    expect(lineColor(0)).toBe('#73BF69')
    expect(lineColor(1)).toBe('#F2CC0C')
    expect(lineColor(4)).toBe('#F2495C')
  })

  it('kembali ke awal palet setelah melewati jumlah warna (wrap-around)', () => {
    expect(SERIES_COLORS).toHaveLength(12)
    expect(lineColor(12)).toBe(SERIES_COLORS[0])
    expect(lineColor(15)).toBe(SERIES_COLORS[3])
  })
})

describe('niceNum / niceTicks — tick bulat ala Grafana/D3', () => {
  it('niceNum round membulatkan ke 1/2/2.5/5/10', () => {
    expect(niceNum(1.2, true)).toBe(1)
    expect(niceNum(1.8, true)).toBe(2)
    expect(niceNum(3, true)).toBe(2.5)
    expect(niceNum(5, true)).toBe(5)
    expect(niceNum(8, true)).toBe(10)
  })

  it('niceNum non-round memakai batas <= (1/2/2.5/5/10)', () => {
    expect(niceNum(1, false)).toBe(1)
    expect(niceNum(2, false)).toBe(2)
    expect(niceNum(2.5, false)).toBe(2.5)
    expect(niceNum(5, false)).toBe(5)
    expect(niceNum(6, false)).toBe(10)
  })

  it('skala besar: 108.000.000 → niceMax 125 Mil dengan langkah 25 Mil', () => {
    const { niceMax, step } = niceTicks(108e6)
    expect(step).toBe(25e6)
    expect(niceMax).toBe(125e6)
  })

  it('skala kecil: max 3 → tick rapi di atas 3', () => {
    const { niceMax, step } = niceTicks(3)
    expect(niceMax).toBeGreaterThanOrEqual(3)
    expect((niceMax / step) % 1).toBe(0)
  })

  it('max <= 0 memakai skala default {niceMax:1, step:1}', () => {
    expect(niceTicks(0)).toEqual({ niceMax: 1, step: 1 })
    expect(niceTicks(-5)).toEqual({ niceMax: 1, step: 1 })
  })
})

describe('trimNum — buang nol desimal gaya Grafana', () => {
  it('>= 100: tanpa desimal', () => {
    expect(trimNum(108.4)).toBe('108')
    expect(trimNum(1500)).toBe('1500')
  })

  it('10–99: satu desimal kalau ada, tanpa .0 kalau bulat', () => {
    expect(trimNum(20.5)).toBe('20.5')
    expect(trimNum(20)).toBe('20')
  })

  it('< 10: dua desimal, nol ekor dibuang', () => {
    expect(trimNum(2.5)).toBe('2.5')
    expect(trimNum(2)).toBe('2')
    expect(trimNum(1.25)).toBe('1.25')
  })
})

describe('fmtGrafana — satuan Inggris ringkas', () => {
  it('0 tetap "0"', () => {
    expect(fmtGrafana(0)).toBe('0')
  })

  it('juta jadi "Mil", ribu jadi "K"', () => {
    expect(fmtGrafana(150e6)).toBe('150 Mil')
    expect(fmtGrafana(2.5e6)).toBe('2.5 Mil')
    expect(fmtGrafana(1500)).toBe('1.5 K')
  })

  it('miliar jadi "Bil", kecil pakai toPrecision(3)', () => {
    expect(fmtGrafana(3e9)).toBe('3 Bil')
    expect(fmtGrafana(0.5)).toBe('0.500')
    expect(fmtGrafana(42)).toBe('42')
  })
})

describe('fmtBytes — satuan IEC biner (KiB/MiB/GiB)', () => {
  it('<= 0 tetap "0"', () => {
    expect(fmtBytes(0)).toBe('0')
    expect(fmtBytes(-10)).toBe('0')
  })

  it('byte kecil dibulatkan tanpa desimal', () => {
    expect(fmtBytes(512)).toBe('512B')
    expect(fmtBytes(999)).toBe('999B')
  })

  it('KiB satu desimal, MiB/GiB bulat', () => {
    expect(fmtBytes(1024)).toBe('1.0KiB')
    expect(fmtBytes(1536)).toBe('1.5KiB')
    expect(fmtBytes(108 * 1024 * 1024)).toBe('108MiB')
    expect(fmtBytes(3 * 1024 ** 3)).toBe('3GiB')
  })

  it('tidak melebihi unit terbesar (TiB)', () => {
    expect(fmtBytes(5 * 1024 ** 4)).toBe('5TiB')
    expect(fmtBytes(10 * 1024 ** 5)).toBe('10240TiB')
  })
})

describe('fmtCompact / formatValue — nilai tooltip', () => {
  it('fmtCompact pakai satuan M/k dan desimal tetap', () => {
    expect(fmtCompact(2.5e6)).toBe('2.5M')
    expect(fmtCompact(1500)).toBe('1.5k')
    expect(fmtCompact(42)).toBe('42.0')
    expect(fmtCompact(0.125)).toBe('0.125')
  })

  it('formatValue: bytes → fmtBytes, ratio → persen, default → fmtCompact', () => {
    expect(formatValue('bytes', 108 * 1024 * 1024)).toBe('108MiB')
    expect(formatValue('ratio', 0.256)).toBe('25.6%')
    expect(formatValue('number', 1500)).toBe('1.5k')
  })
})

describe('formatYLabel — label sumbu Y per tipe chart', () => {
  it('bytes memakai satuan biner, lainnya gaya Grafana', () => {
    expect(formatYLabel('bytes', 2 * 1024 * 1024)).toBe('2MiB')
    expect(formatYLabel('number', 150e6)).toBe('150 Mil')
    expect(formatYLabel('ratio', 1000)).toBe('1 K')
  })
})

describe('fmtTick / fmtPrecise — label waktu', () => {
  it('fmtTick menghasilkan HH:MM dua digit', () => {
    const d = new Date(2026, 8, 21, 9, 5)
    expect(fmtTick(d.getTime())).toBe('09:05')
  })

  it('fmtPrecise menghasilkan YYYY-MM-DD HH:MM:SS', () => {
    const d = new Date(2026, 8, 21, 14, 3, 7)
    expect(fmtPrecise(d.getTime())).toBe('2026-09-21 14:03:07')
  })
})
