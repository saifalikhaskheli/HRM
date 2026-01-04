import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

interface StrengthResult {
  level: StrengthLevel;
  score: number;
  label: string;
}

function calculateStrength(password: string): StrengthResult {
  if (!password) {
    return { level: 'weak', score: 0, label: '' };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // Normalize score to 0-4 range
  const normalizedScore = Math.min(Math.floor(score / 2), 4);

  if (normalizedScore <= 1) {
    return { level: 'weak', score: normalizedScore, label: 'Weak' };
  } else if (normalizedScore === 2) {
    return { level: 'fair', score: normalizedScore, label: 'Fair' };
  } else if (normalizedScore === 3) {
    return { level: 'good', score: normalizedScore, label: 'Good' };
  } else {
    return { level: 'strong', score: normalizedScore, label: 'Strong' };
  }
}

const strengthColors: Record<StrengthLevel, string> = {
  weak: 'bg-destructive',
  fair: 'bg-orange-500',
  good: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const strengthTextColors: Record<StrengthLevel, string> = {
  weak: 'text-destructive',
  fair: 'text-orange-500',
  good: 'text-yellow-500',
  strong: 'text-green-500',
};

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = useMemo(() => calculateStrength(password), [password]);

  if (!password) {
    return null;
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              index <= strength.score
                ? strengthColors[strength.level]
                : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className={cn('text-xs font-medium', strengthTextColors[strength.level])}>
        {strength.label}
      </p>
    </div>
  );
}
