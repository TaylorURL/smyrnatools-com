import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// --- Mocks ---

const mockOnSubmit = jest.fn()
const mockOnBack = jest.fn()

jest.mock('../../app/context/PreferencesContext', () => ({
    usePreferences: () => ({
        preferences: { accentColor: '#1e3a5f' }
    })
}))

jest.mock('../../app/hooks/useSubmitData', () => ({
    useSubmitData: () => ({
        fetchHoursReceived: jest.fn(),
        fetchOperatorsAndMixers: jest.fn(() => Promise.resolve({ activeOperators: [], mixers: [] })),
        forcedReportDate: null,
        hoursReceivedFromOtherPlants: 0,
        isCompleted: false,
        loadingPlants: false,
        maintenanceItems: [],
        mixers: [],
        nextForcedReportDate: null,
        operatorOptions: [],
        plants: [{ plant_code: 'ATL', plant_name: 'Atlanta' }],
        targetUserId: 'user-1',
        userPlantCode: 'ATL',
        weekVerbose: 'Week 24, 2025'
    })
}))

jest.mock('../../app/hooks/useSubmitForm', () => ({
    useSubmitForm: () => ({
        addOperatorRow: jest.fn(),
        carouselIndex: 0,
        clearRows: jest.fn(),
        excludedOperators: [],
        form: { total_hours: '', yardage: '' },
        handleChange: jest.fn(),
        hasUnsavedChanges: false,
        initializeRows: jest.fn(),
        lost: 0,
        lostGrade: 'A',
        lostLabel: 'Excellent',
        removeOperatorRow: jest.fn(),
        reportDateVerbose: 'June 15, 2025',
        setCarouselIndex: jest.fn(),
        setForm: jest.fn(),
        setHasUnsavedChanges: jest.fn(),
        setInitialFormSnapshot: jest.fn(),
        yph: 0,
        yphGrade: 'A',
        yphLabel: 'Excellent'
    })
}))

jest.mock('../../utils/ErrorReporterUtility', () => ({
    __esModule: true,
    default: { reportError: jest.fn() }
}))

jest.mock('../../utils/ExportUtility', () => ({
    exportGeneralManagerReport: jest.fn()
}))

jest.mock('../../utils/ReportUtility', () => ({
    ReportUtility: {
        formatDate: (d) => d || '',
        getTruckNumberForOperator: () => null,
        validatePlantProduction: jest.fn(() => Promise.resolve(null))
    }
}))

jest.mock(
    '../../app/components/reports/SubmitHeader',
    () =>
        function MockSubmitHeader({ report, onBack }) {
            return (
                <div data-testid="submit-header">
                    <span>{report.title}</span>
                    <button onClick={onBack}>Back</button>
                </div>
            )
        }
)

jest.mock(
    '../../app/components/reports/ConfirmationModal',
    () =>
        function MockConfirmationModal() {
            return <div data-testid="confirmation-modal" />
        }
)

jest.mock(
    '../../app/components/reports/ErrorModal',
    () =>
        function MockErrorModal({ error }) {
            return <div data-testid="error-modal">{error}</div>
        }
)

jest.mock(
    '../../app/components/reports/OperatorExclusionReasonModal',
    () =>
        function MockExclusionModal() {
            return <div data-testid="exclusion-modal" />
        }
)

// Mock all report type plugins to simple stubs
jest.mock('../reporting/reports/types/WeeklyAggregateProductionReport', () => ({
    AggregateProductionSubmitPlugin: () => null
}))
jest.mock('../reporting/reports/types/WeeklyDistrictManagerReport', () => ({ DistrictManagerSubmitPlugin: () => null }))
jest.mock('../reporting/reports/types/WeeklyEfficiencyReport', () => ({ EfficiencySubmitPlugin: () => null }))
jest.mock('../reporting/reports/types/WeeklyGeneralManagerReport', () => ({ GeneralManagerSubmitPlugin: () => null }))
jest.mock('../reporting/reports/types/WeeklyPlantManagerReport', () => ({ PlantManagerSubmitPlugin: () => null }))
jest.mock('../reporting/reports/types/WeeklyQualityControlManagerReport', () => ({
    QualityControlManagerSubmitPlugin: () => null
}))
jest.mock('../reporting/reports/types/WeeklyReadyMixInstructorReport', () => ({
    ReadyMixInstructorSubmitPlugin: () => null
}))
jest.mock('../reporting/reports/types/WeeklySafetyManagerReport', () => ({ SafetyManagerSubmitPlugin: () => null }))

import ReportsSubmitView from '../reporting/reports/ReportsSubmitView'

const DEFAULT_REPORT = {
    fields: [
        { label: 'Total Yardage', name: 'yardage', required: true, type: 'number' },
        { label: 'Total Hours', name: 'total_hours', required: true, type: 'number' }
    ],
    name: 'ready_mix_instructor',
    title: 'Weekly Ready Mix Instructor Report',
    weekIso: '2025-W24'
}

const DEFAULT_USER = { id: 'user-1', plant_code: 'ATL' }

describe('ReportsSubmitView', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the report header with title', () => {
        render(
            <ReportsSubmitView
                report={DEFAULT_REPORT}
                onSubmit={mockOnSubmit}
                onBack={mockOnBack}
                user={DEFAULT_USER}
            />
        )

        expect(screen.getByTestId('submit-header')).toBeInTheDocument()
        expect(screen.getByText(DEFAULT_REPORT.title)).toBeInTheDocument()
    })

    it('renders form fields from report.fields', () => {
        render(
            <ReportsSubmitView
                report={DEFAULT_REPORT}
                onSubmit={mockOnSubmit}
                onBack={mockOnBack}
                user={DEFAULT_USER}
            />
        )

        expect(screen.getByText('Total Yardage')).toBeInTheDocument()
        expect(screen.getByText('Total Hours')).toBeInTheDocument()
    })

    it('renders Submit and Save Changes buttons when not readOnly', () => {
        render(
            <ReportsSubmitView
                report={DEFAULT_REPORT}
                onSubmit={mockOnSubmit}
                onBack={mockOnBack}
                user={DEFAULT_USER}
            />
        )

        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })

    it('hides submit/save buttons when readOnly', () => {
        render(
            <ReportsSubmitView
                report={DEFAULT_REPORT}
                onSubmit={mockOnSubmit}
                onBack={mockOnBack}
                user={DEFAULT_USER}
                readOnly
            />
        )

        expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
    })

    it('shows validation error when required fields are empty on submit', async () => {
        render(
            <ReportsSubmitView
                report={DEFAULT_REPORT}
                onSubmit={mockOnSubmit}
                onBack={mockOnBack}
                user={DEFAULT_USER}
            />
        )

        const submitButton = screen.getByRole('button', { name: /submit/i })
        await userEvent.click(submitButton)

        await waitFor(() => {
            expect(screen.getByTestId('error-modal')).toBeInTheDocument()
            expect(screen.getByText(/required fields/i)).toBeInTheDocument()
        })

        expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('calls onBack when back button is clicked', async () => {
        render(
            <ReportsSubmitView
                report={DEFAULT_REPORT}
                onSubmit={mockOnSubmit}
                onBack={mockOnBack}
                user={DEFAULT_USER}
            />
        )

        const backButton = screen.getByRole('button', { name: /back/i })
        await userEvent.click(backButton)

        expect(mockOnBack).toHaveBeenCalled()
    })
})
