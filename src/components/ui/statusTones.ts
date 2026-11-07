export type BadgeTone = 'ok' | 'info' | 'warn' | 'crit' | 'neutral';

export function riskTone(score: number): BadgeTone {
  if (score < 25) return 'ok';
  if (score < 50) return 'info';
  if (score < 75) return 'warn';
  return 'crit';
}

export function riskLabel(score: number): string {
  if (score < 25) return 'LOW';
  if (score < 50) return 'MODERATE';
  if (score < 75) return 'HIGH';
  return 'CRITICAL';
}

export function securityTone(level: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL'): BadgeTone {
  switch (level) {
    case 'NORMAL':
      return 'ok';
    case 'ELEVATED':
      return 'info';
    case 'HIGH':
      return 'warn';
    case 'CRITICAL':
      return 'crit';
  }
}

export function severityTone(sev: string): BadgeTone {
  switch (sev) {
    case 'INFO':
      return 'info';
    case 'ADVISORY':
      return 'info';
    case 'WARNING':
      return 'warn';
    case 'CRITICAL':
      return 'crit';
    case 'SUCCESS':
      return 'ok';
    default:
      return 'neutral';
  }
}
