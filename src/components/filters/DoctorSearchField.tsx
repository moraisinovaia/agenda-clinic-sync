import { useState, useRef, useEffect } from 'react';
import { Stethoscope, Search, X, Clock, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAdvancedDoctorSearch } from '@/hooks/useAdvancedDoctorSearch';
import { useDebounce } from '@/hooks/useDebounce';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';

interface DoctorSearchFieldProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
  selectedDoctorId?: string;
  onDoctorSelect: (doctorId: string) => void;
  placeholder?: string;
  className?: string;
  simpleMode?: boolean;
}

export const DoctorSearchField = ({
  doctors,
  appointments,
  selectedDoctorId,
  onDoctorSelect,
  placeholder = "Buscar médico por nome ou especialidade...",
  className = "",
  simpleMode = false,
}: DoctorSearchFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Use advanced search only when not in simple mode
  const advancedSearch = useAdvancedDoctorSearch(doctors, appointments);
  
  // Simple doctor filter for simple mode
  const simpleFilteredDoctors = doctors
    .filter(doctor => doctor.ativo)
    .filter(doctor => 
      !debouncedSearchTerm || 
      doctor.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      doctor.especialidade.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Choose which filter to use based on mode
  const filteredDoctors = simpleMode ? simpleFilteredDoctors : advancedSearch.filteredDoctors;
  const filteredCount = simpleMode ? simpleFilteredDoctors.length : advancedSearch.filteredCount;
  
  // Advanced search features (only used in complex mode)
  const {
    selectedSpecialty,
    setSelectedSpecialty,
    showOnlyWithAppointments,
    setShowOnlyWithAppointments,
    mostUsedDoctors,
    doctorsWithTodayAppointments,
    specialties,
    clearSearch,
  } = advancedSearch;

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setInputFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDoctorSelect = (doctor: Doctor) => {
    onDoctorSelect(doctor.id);
    setIsOpen(false);
    setInputFocused(false);
    if (!simpleMode) {
      clearSearch();
    } else {
      setSearchTerm('');
    }
  };

  const handleClearSelection = () => {
    onDoctorSelect('all');
    if (!simpleMode) {
      clearSearch();
    } else {
      setSearchTerm('');
    }
    inputRef.current?.focus();
  };

  const showDropdown = isOpen || inputFocused || searchTerm.length > 0;

  return (
    <div className={`relative ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Médico
        </label>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          
          <Input
            ref={inputRef}
            placeholder={selectedDoctor ? `Dr(a). ${selectedDoctor.nome}` : placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              setInputFocused(true);
              setIsOpen(true);
            }}
            className="pl-10 pr-10"
          />
          
          {(selectedDoctor || searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Selected Doctor Badge */}
        {selectedDoctor && !inputFocused && (
          <Badge variant="secondary" className="gap-2">
            <Stethoscope className="h-3 w-3" />
            Dr(a). {selectedDoctor.nome} - {selectedDoctor.especialidade}
            <X 
              className="h-3 w-3 cursor-pointer hover:text-destructive" 
              onClick={handleClearSelection}
            />
          </Badge>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-hidden" ref={dropdownRef}>
          <CardContent className="p-0">
            {simpleMode ? (
              /* Simple Mode - Just doctors list */
              <div className="max-h-64 overflow-y-auto">
                {filteredDoctors.length > 0 ? (
                  <div className="p-1">
                    {searchTerm && (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        {filteredCount} médico(s) encontrado(s)
                      </div>
                    )}
                    {filteredDoctors.map(doctor => (
                      <Button
                        key={doctor.id}
                        variant="ghost"
                        onClick={() => handleDoctorSelect(doctor)}
                        className="w-full justify-start h-auto p-2 hover:bg-accent"
                      >
                        <div className="flex flex-col items-start w-full">
                          <span className="font-medium">Dr(a). {doctor.nome}</span>
                          <span className="text-sm text-muted-foreground">{doctor.especialidade}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum médico encontrado</p>
                    {searchTerm && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="mt-1"
                      >
                        Limpar busca
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Complex Mode - All filters and sections */
              <>
                {/* Quick Filters */}
                <div className="p-3 border-b bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOnlyWithAppointments(!showOnlyWithAppointments)}
                      className={showOnlyWithAppointments ? "bg-primary text-primary-foreground" : ""}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Com agendamentos hoje
                    </Button>
                  </div>
                  
                  {/* Specialty Filter */}
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant={selectedSpecialty === 'all' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSpecialty('all')}
                    >
                      Todas
                    </Button>
                    {specialties.slice(0, 3).map(specialty => (
                      <Button
                        key={specialty}
                        variant={selectedSpecialty === specialty ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSpecialty(specialty)}
                      >
                        {specialty}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Quick Access - Doctors with today's appointments */}
                {doctorsWithTodayAppointments.length > 0 && !searchTerm && (
                  <div className="p-3 border-b">
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Com agendamentos hoje
                    </div>
                    <div className="space-y-1">
                      {doctorsWithTodayAppointments.slice(0, 3).map(doctor => (
                        <Button
                          key={doctor.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDoctorSelect(doctor)}
                          className="w-full justify-start h-auto p-2"
                        >
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span>Dr(a). {doctor.nome}</span>
                              <Badge variant="secondary" className="text-xs">
                                {doctor.todayAppointments} hoje
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{doctor.especialidade}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Most Used Doctors */}
                {mostUsedDoctors.length > 0 && !searchTerm && (
                  <div className="p-3 border-b">
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Mais utilizados
                    </div>
                    <div className="space-y-1">
                      {mostUsedDoctors.slice(0, 3).map(doctor => (
                        <Button
                          key={doctor.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDoctorSelect(doctor)}
                          className="w-full justify-start h-auto p-2"
                        >
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span>Dr(a). {doctor.nome}</span>
                              {doctor.recentlyUsed && (
                                <Badge variant="outline" className="text-xs">
                                  Recente
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{doctor.especialidade}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                <div className="max-h-64 overflow-y-auto">
                  {filteredDoctors.length > 0 ? (
                    <div className="p-1">
                      {searchTerm && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">
                          {filteredCount} médico(s) encontrado(s)
                        </div>
                      )}
                       {filteredDoctors.map(doctor => (
                        <Button
                          key={doctor.id}
                          variant="ghost"
                          onClick={() => handleDoctorSelect(doctor)}
                          className="w-full justify-start h-auto p-2 hover:bg-accent"
                        >
                          <div className="flex flex-col items-start w-full">
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">Dr(a). {doctor.nome}</span>
                              {!simpleMode && (
                                <div className="flex gap-1">
                                  {(doctor as any).todayAppointments > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {(doctor as any).todayAppointments} hoje
                                    </Badge>
                                  )}
                                  {(doctor as any).recentlyUsed && (
                                    <Badge variant="outline" className="text-xs">
                                      Recente
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">{doctor.especialidade}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum médico encontrado</p>
                      {searchTerm && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => simpleMode ? setSearchTerm('') : clearSearch()}
                          className="mt-1"
                        >
                          Limpar busca
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};