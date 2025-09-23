import { useClientTables } from '@/hooks/useClientTables';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export const ClientSelector = () => {
  const { isSuperAdmin, selectedClient, setSelectedClient } = useClientTables();

  if (!isSuperAdmin) return null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs">
        Super Admin
      </Badge>
      <Select 
        value={selectedClient || ''} 
        onValueChange={(value) => setSelectedClient(value as 'INOVAIA' | 'IPADO' | null)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Selecionar Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INOVAIA">InovAIA</SelectItem>
          <SelectItem value="IPADO">IPADO</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};