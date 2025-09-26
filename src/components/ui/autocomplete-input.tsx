import * as React from "react"
import { Input } from "./input"
import { cn } from "@/lib/utils"

export interface AutocompleteInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  className?: string
  suggestions?: string[]
  onValueChange?: (value: string) => void
  onSuggestionSelect?: (suggestion: string) => void
}

const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(
  ({ className, suggestions = [], onValueChange, onSuggestionSelect, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([])
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
    const [inputValue, setInputValue] = React.useState(props.value as string || "")
    
    const containerRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLUListElement>(null)

    React.useEffect(() => {
      if (inputValue && inputValue.length > 0) {
        const filtered = suggestions.filter(suggestion =>
          suggestion.toLowerCase().includes(inputValue.toLowerCase())
        )
        setFilteredSuggestions(filtered)
        setIsOpen(filtered.length > 0)
      } else {
        setIsOpen(false)
        setFilteredSuggestions([])
      }
      setHighlightedIndex(-1)
    }, [inputValue, suggestions])

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)
      onValueChange?.(value)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (highlightedIndex >= 0) {
            selectSuggestion(filteredSuggestions[highlightedIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          setHighlightedIndex(-1)
          break
      }
    }

    const selectSuggestion = (suggestion: string) => {
      setInputValue(suggestion)
      setIsOpen(false)
      setHighlightedIndex(-1)
      onValueChange?.(suggestion)
      onSuggestionSelect?.(suggestion)
    }

    return (
      <div ref={containerRef} className="relative">
        <Input
          {...props}
          ref={ref}
          className={className}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        
        {isOpen && filteredSuggestions.length > 0 && (
          <ul
            ref={listRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                  index === highlightedIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => selectSuggestion(suggestion)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{suggestion}</span>
                  {suggestion.includes('@') && (
                    <span className="text-xs text-muted-foreground">
                      {suggestion.split('@')[0]}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
)

AutocompleteInput.displayName = "AutocompleteInput"

export { AutocompleteInput }