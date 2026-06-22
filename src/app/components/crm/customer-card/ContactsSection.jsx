/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { useConfirm } from '../../../context/ConfirmContext'
import Badge from '../../common/Badge'
import { ContactEditor } from './ContactEditor'

/** Editable phone-number list. Numbers come from two places merged into
 *  a single rendered list: the parsed dispatch phone string (auto-
 *  populated default) and the `customer_contacts` overrides. Each row
 *  has Edit + Delete affordances. Deletes of dispatch-sourced numbers
 *  soft-hide them so the next dispatch import doesn't resurrect a
 *  number the user explicitly removed. */
export function ContactsSection({
    contacts,
    customerNum,
    isLoadingContacts,
    isSavingContact,
    onDeleteContact,
    onSaveContact
}) {
    const [editingKey, setEditingKey] = useState(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const confirm = useConfirm()

    const handleDelete = async (entry) => {
        if (!onDeleteContact) return
        const ok = await confirm({
            confirmLabel: 'Remove',
            message: 'This number will be removed from this customer.',
            title: `Remove ${entry.display}?`
        })
        if (!ok) return
        await onDeleteContact(customerNum, entry.phoneDigits, entry.phoneDisplay)
    }

    return (
        <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Phone numbers</div>
                {!showAddForm && (
                    <button type="button"
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer border-none bg-transparent p-0 text-text-secondary hover:underline active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    >
                        <i className="fas fa-plus text-[9px]" />
                        Add number
                    </button>
                )}
            </div>
            {isLoadingContacts && contacts.length === 0 ? (
                <div className="text-[11.5px] italic text-text-tertiary">Loading numbers…</div>
            ) : contacts.length === 0 && !showAddForm ? (
                <div className="text-[12px] text-text-tertiary inline-flex items-center gap-1.5">
                    <i className="fas fa-phone-slash text-[10px]" />
                    No phone on file. Add one to start cold-calling.
                </div>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {contacts.map((entry) =>
                        editingKey === entry.phoneDigits ? (
                            <li key={entry.phoneDigits}>
                                <ContactEditor
                                    customerNum={customerNum}
                                    initial={entry}
                                    isSaving={isSavingContact}
                                    onCancel={() => setEditingKey(null)}
                                    onSave={async (payload) => {
                                        const result = await onSaveContact(customerNum, payload)
                                        if (result) setEditingKey(null)
                                    }}
                                />
                            </li>
                        ) : (
                            <li
                                key={entry.phoneDigits}
                                className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 bg-bg-secondary border border-border-light"
                            >
                                <a
                                    href={`tel:${entry.href}`}
                                    className="flex items-baseline gap-2 min-w-0 text-[13px] font-mono tabular-nums font-semibold hover:underline text-text-primary"
                                >
                                    <i className="fas fa-phone text-[11px] text-text-tertiary shrink-0" />
                                    <span className="truncate">{entry.display}</span>
                                    {entry.label && (
                                        <span className="text-[10.5px] uppercase tracking-wider text-text-tertiary font-sans truncate">
                                            · {entry.label}
                                        </span>
                                    )}
                                    {entry.contactName && (
                                        <span className="text-[11px] text-text-secondary font-sans truncate">
                                            · {entry.contactName}
                                        </span>
                                    )}
                                    {entry.isPrimary && (
                                        <Badge
                                            tone="success"
                                            size="xs"
                                            shape="square"
                                            weight="bold"
                                            title="Primary number"
                                        >
                                            Primary
                                        </Badge>
                                    )}
                                </a>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button type="button"
                                        onClick={() => setEditingKey(entry.phoneDigits)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer bg-transparent text-text-tertiary hover:text-text-primary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                        title="Edit name / label"
                                        aria-label="Edit contact"
                                    >
                                        <i className="fas fa-pen text-[10px]" />
                                    </button>
                                    <button type="button"
                                        onClick={() => handleDelete(entry)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer bg-transparent text-text-tertiary hover:text-text-primary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                        title="Remove this number"
                                        aria-label="Remove contact"
                                    >
                                        <i className="fas fa-trash text-[10px]" />
                                    </button>
                                </div>
                            </li>
                        )
                    )}
                </ul>
            )}
            {showAddForm && (
                <div className="mt-2">
                    <ContactEditor
                        customerNum={customerNum}
                        initial={null}
                        isSaving={isSavingContact}
                        onCancel={() => setShowAddForm(false)}
                        onSave={async (payload) => {
                            const result = await onSaveContact(customerNum, payload)
                            if (result) setShowAddForm(false)
                        }}
                    />
                </div>
            )}
        </div>
    )
}
