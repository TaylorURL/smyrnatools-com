import { createContext } from 'react'

/**
 * Links a DetailViewSection shell to the cards rendered inside it: each card
 * calls `registerSection` on mount so the shell's sidebar can list every
 * section, and `activeSection` / `setActiveSection` track which one the
 * sidebar highlights. The defaults below only apply to a card rendered
 * outside a provider, where registration is a no-op.
 */
export const DetailViewContext = createContext({
    activeSection: '',
    registerSection: () => {},
    sections: [],
    setActiveSection: () => {}
})
