import React, { useState } from 'react'

import RoleModal, {
    RoleFormField,
    RoleModalBody,
    RoleModalFooter,
    RoleTextInput
} from '../../../../app/components/ui/RoleModal'

const EditWeightModal = ({ role, onClose, onSave }) => {
    const [weight, setWeight] = useState(role?.weight || 0)
    if (!role) return null
    return (
        <RoleModal isOpen={true} onClose={onClose} eyebrow={role.name} title="Edit weight" maxWidth="max-w-sm">
            <RoleModalBody>
                <RoleFormField label="Weight" hint="Roles with a weight above 75 are elevated to admin.">
                    <RoleTextInput value={weight} onChange={(v) => setWeight(Number(v) || 0)} type="number" autoFocus />
                </RoleFormField>
            </RoleModalBody>
            <RoleModalFooter
                onCancel={onClose}
                onSubmit={() => {
                    onSave(role.id, weight)
                    onClose()
                }}
                submitText="Save"
            />
        </RoleModal>
    )
}

export default EditWeightModal
