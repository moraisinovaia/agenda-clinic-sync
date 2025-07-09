import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, FileText, AlertTriangle, Package, Pill, Utensils } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Preparo {
  id: string;
  nome: string;
  exame: string;
  jejum_horas: number | null;
  restricoes_alimentares: string | null;
  medicacao_suspender: string | null;
  itens_levar: string | null;
  observacoes_especiais: string | null;
  instrucoes: any;
  dias_suspensao: number | null;
}

interface PreparosViewProps {
  atendimentoNome?: string;
  showAll?: boolean;
}

export function PreparosView({ atendimentoNome, showAll = false }: PreparosViewProps) {
  const [preparos, setPreparos] = useState<Preparo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreparos() {
      try {
        let query = supabase.from('preparos').select('*').order('nome');
        
        if (!showAll && atendimentoNome) {
          query = query.ilike('exame', `%${atendimentoNome}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        setPreparos(data || []);
      } catch (error) {
        console.error('Erro ao carregar preparos:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPreparos();
  }, [atendimentoNome, showAll]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-5/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (preparos.length === 0) {
    return (
      <Card className="text-center">
        <CardContent className="pt-6">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">Nenhum preparo encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {atendimentoNome 
              ? `Não há preparos específicos para "${atendimentoNome}"`
              : 'Não há preparos cadastrados no sistema'
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {preparos.map((preparo) => (
        <Card key={preparo.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{preparo.nome}</CardTitle>
                <CardDescription>{preparo.exame}</CardDescription>
              </div>
              {preparo.jejum_horas && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {preparo.jejum_horas}h jejum
                </Badge>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {preparo.restricoes_alimentares && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Utensils className="h-4 w-4" />
                  Restrições Alimentares
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {preparo.restricoes_alimentares}
                </p>
              </div>
            )}

            {preparo.medicacao_suspender && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                  <Pill className="h-4 w-4" />
                  Medicações a Suspender
                  {preparo.dias_suspensao && (
                    <Badge variant="outline" className="ml-2">
                      {preparo.dias_suspensao} dias antes
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {preparo.medicacao_suspender}
                </p>
              </div>
            )}

            {preparo.itens_levar && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Package className="h-4 w-4" />
                  Itens para Levar
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {preparo.itens_levar}
                </p>
              </div>
            )}

            {preparo.observacoes_especiais && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  Observações Especiais
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {preparo.observacoes_especiais}
                </p>
              </div>
            )}

            {preparo.instrucoes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Instruções Detalhadas
                  </div>
                  <div className="text-sm text-muted-foreground pl-6">
                    {(() => {
                      try {
                        if (Array.isArray(preparo.instrucoes)) {
                          return (
                            <ol className="list-decimal list-inside space-y-2">
                              {preparo.instrucoes.map((item: any, index: number) => {
                                if (typeof item === 'object' && item !== null) {
                                  return (
                                    <li key={index} className="space-y-1">
                                      {item.momento && (
                                        <span className="font-medium text-primary">
                                          {item.momento}:{' '}
                                        </span>
                                      )}
                                      <span>{item.instrucao || String(item)}</span>
                                    </li>
                                  );
                                }
                                return <li key={index}>{String(item)}</li>;
                              })}
                            </ol>
                          );
                        } else if (typeof preparo.instrucoes === 'object') {
                          return (
                            <ul className="space-y-1">
                              {Object.entries(preparo.instrucoes).map(([key, value]) => (
                                <li key={key} className="flex">
                                  <span className="font-medium mr-2">{key}:</span>
                                  <span>{String(value)}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        } else {
                          return <p>{String(preparo.instrucoes)}</p>;
                        }
                      } catch (error) {
                        console.error('Erro ao renderizar instruções:', error, preparo.instrucoes);
                        return <p className="text-destructive">Erro ao carregar instruções</p>;
                      }
                    })()}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}