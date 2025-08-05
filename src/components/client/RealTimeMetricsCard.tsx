import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RealTimeMetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  progress?: {
    value: number;
    max?: number;
  };
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  className?: string;
  onClick?: () => void;
}

const RealTimeMetricsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  progress,
  badge,
  className,
  onClick
}: RealTimeMetricsCardProps) => {
  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl",
        "border-border/40 bg-gradient-to-br from-card via-card/95 to-card/90",
        "hover:border-primary/20 hover:-translate-y-1",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          {title}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {badge && (
            <Badge 
              variant={badge.variant || "default"} 
              className="text-xs transition-all duration-200 group-hover:scale-105"
            >
              {badge.text}
            </Badge>
          )}
          <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-all duration-200">
            <Icon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform duration-200" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-200">
              {value}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          
          {trend && (
            <div className={cn(
              "flex items-center text-xs font-semibold px-2 py-1 rounded-full transition-all duration-200",
              trend.isPositive 
                ? "text-emerald-700 bg-emerald-50 border border-emerald-200" 
                : "text-red-700 bg-red-50 border border-red-200"
            )}>
              <span className="flex items-center gap-1">
                {trend.isPositive ? "↗" : "↘"}
                {Math.abs(trend.value)}%
              </span>
            </div>
          )}
        </div>
        
        {progress && (
          <div className="space-y-2">
            <Progress 
              value={(progress.value / (progress.max || 100)) * 100} 
              className="h-2.5 bg-muted/50"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="font-medium">{progress.value}</span>
              <span>{progress.max || 100}</span>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Enhanced gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Subtle border glow on hover */}
      <div className="absolute inset-0 rounded-lg ring-1 ring-primary/0 group-hover:ring-primary/20 transition-all duration-300 pointer-events-none" />
    </Card>
  );
};

export default RealTimeMetricsCard;