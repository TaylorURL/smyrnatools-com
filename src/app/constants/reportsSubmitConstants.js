import { AggregateProductionSubmitPlugin } from '../../views/reporting/reports/types/WeeklyAggregateProductionReport'
import { DistrictManagerSubmitPlugin } from '../../views/reporting/reports/types/WeeklyDistrictManagerReport'
import { EfficiencySubmitPlugin } from '../../views/reporting/reports/types/WeeklyEfficiencyReport'
import { GeneralManagerSubmitPlugin } from '../../views/reporting/reports/types/WeeklyGeneralManagerReport'
import { QualityControlManagerSubmitPlugin } from '../../views/reporting/reports/types/WeeklyQualityControlManagerReport'
import { ReadyMixInstructorSubmitPlugin } from '../../views/reporting/reports/types/WeeklyReadyMixInstructorReport'
import { SafetyManagerSubmitPlugin } from '../../views/reporting/reports/types/WeeklySafetyManagerReport'

/** Maps report type keys to their submit-mode plugin components. */
export const PLUGINS = {
    aggregate_production: AggregateProductionSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    general_manager: GeneralManagerSubmitPlugin,
    plant_production: EfficiencySubmitPlugin,
    quality_control_manager: QualityControlManagerSubmitPlugin,
    ready_mix_instructor: ReadyMixInstructorSubmitPlugin,
    safety_environmental_rep: SafetyManagerSubmitPlugin,
    safety_manager: SafetyManagerSubmitPlugin
}

export const EXCLUDED_REPORT_TYPES = [
    'district_manager',
    'general_manager',
    'aggregate_production',
    'quality_control_manager',
    'safety_manager',
    'safety_environmental_rep'
]

export const GM_REQUIRED_FIELD_SUFFIXES = [
    'active_operators',
    'runnable_trucks',
    'down_trucks',
    'operators_starting',
    'new_operators_training',
    'operators_leaving',
    'total_yardage',
    'total_hours'
]

/** Report types whose plugins should be passed the active `weekIso`. */
export const WEEK_ISO_PLUGIN_REPORTS = [
    'general_manager',
    'aggregate_production',
    'plant_manager',
    'plant_production',
    'ready_mix_instructor',
    'district_manager'
]
