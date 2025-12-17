import { useMemo } from 'react';
import { HealthScoreResult } from '@/hooks/useClinicHealthScore';
import { cn } from '@/lib/utils';

interface ClinicHealthScoreGaugeProps {
  health: HealthScoreResult;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ClinicHealthScoreGauge({ 
  health, 
  size = 'md',
  showLabel = true 
}: ClinicHealthScoreGaugeProps) {
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm': return { width: 60, height: 60, strokeWidth: 6, fontSize: 14, gradeSize: 10 };
      case 'lg': return { width: 120, height: 120, strokeWidth: 10, fontSize: 28, gradeSize: 16 };
      default: return { width: 80, height: 80, strokeWidth: 8, fontSize: 20, gradeSize: 12 };
    }
  }, [size]);

  const { width, height, strokeWidth, fontSize, gradeSize } = dimensions;
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (health.score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke={health.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Score text */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span 
            className="font-bold leading-none"
            style={{ fontSize, color: health.color }}
          >
            {health.score}
          </span>
          <span 
            className="font-semibold text-muted-foreground"
            style={{ fontSize: gradeSize }}
          >
            {health.grade}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {health.passedCount}/{health.totalCount} checks
        </span>
      )}
    </div>
  );
}
