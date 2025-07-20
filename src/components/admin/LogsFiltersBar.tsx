import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw } from "lucide-react";

interface LogsFiltersBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  levelFilter: string;
  onLevelChange: (value: string) => void;
  componentFilter: string;
  onComponentChange: (value: string) => void;
  sourceFilter: string;
  onSourceChange: (value: string) => void;
  onReset: () => void;
  components: string[];
}

const LogsFiltersBar = ({
  searchTerm,
  onSearchChange,
  levelFilter,
  onLevelChange,
  componentFilter,
  onComponentChange,
  sourceFilter,
  onSourceChange,
  onReset,
  components
}: LogsFiltersBarProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-end">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Buscar nos logs..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Level Filter */}
      <Select value={levelFilter} onValueChange={onLevelChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Nível" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="error">Erro</SelectItem>
          <SelectItem value="warning">Aviso</SelectItem>
          <SelectItem value="info">Info</SelectItem>
          <SelectItem value="success">Sucesso</SelectItem>
          <SelectItem value="debug">Debug</SelectItem>
        </SelectContent>
      </Select>

      {/* Component Filter */}
      <Select value={componentFilter} onValueChange={onComponentChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Componente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {components.map((component) => (
            <SelectItem key={component} value={component}>
              {component}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Source Filter */}
      <Select value={sourceFilter} onValueChange={onSourceChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="frontend">Frontend</SelectItem>
          <SelectItem value="yumer">YUMER</SelectItem>
          <SelectItem value="supabase">Supabase</SelectItem>
          <SelectItem value="system">Sistema</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Button */}
      <Button variant="outline" onClick={onReset} size="sm">
        <RotateCcw className="w-4 h-4 mr-2" />
        Limpar
      </Button>
    </div>
  );
};

export default LogsFiltersBar;