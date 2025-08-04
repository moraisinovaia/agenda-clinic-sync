import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

interface NavigationHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onHome?: () => void;
  showHome?: boolean;
  showBack?: boolean;
  className?: string;
}

export function NavigationHeader({ 
  title, 
  subtitle, 
  onBack, 
  onHome, 
  showHome = true,
  showBack = false,
  className = ""
}: NavigationHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-4">
        {showBack && onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        )}
        
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      
      {showHome && onHome && (
        <Button
          variant="outline"
          size="sm"
          onClick={onHome}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>
      )}
    </div>
  );
}