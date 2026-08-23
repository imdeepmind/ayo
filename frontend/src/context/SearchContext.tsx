import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface SearchContextType {
  query: string;
  setQuery: (query: string) => void;
  clear: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');

  const value = useMemo<SearchContextType>(
    () => ({
      query,
      setQuery,
      clear: () => setQuery(''),
    }),
    [query]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
