/** Menu items visible only for Office-type regions. */
export const OFFICE_VISIBLE_ITEMS = ['Reports', 'Dashboard', 'Managers', 'Plants', 'Regions']
/** Items hidden for Aggregate-type regions. */
export const AGGREGATE_HIDDEN_ITEMS = ['Mixers', 'Plants', 'Regions', 'Calculators', 'Maintenance']
/** Items hidden by default for standard regions. */
export const DEFAULT_HIDDEN_ITEMS = ['Plants', 'Regions']
/** Items exclusively available to Office regions. */
export const OFFICE_ONLY_ITEMS = ['Roles']

/** FontAwesome icon class mapping for each navigation item ID. */
export const ICONS = {
    Archive: 'fa-archive',
    Assets: 'fa-truck',
    Calculators: 'fa-calculator',
    CRM: 'fa-address-book',
    Dashboard: 'fa-tachometer-alt',
    'Heavy Equipment': 'fa-snowplow',
    List: 'fa-list',
    Logout: 'fa-sign-out-alt',
    Maintenance: 'fa-wrench',
    Managers: 'fa-user-tie',
    Mixers: 'fa-truck',
    MyAccount: 'fa-user',
    NRMCA: 'fa-certificate',
    Operators: 'fa-users',
    People: 'fa-users',
    'Pickup Trucks': 'fa-truck-pickup',
    Plan: 'fa-calendar-alt',
    Plants: 'fa-industry',
    Regions: 'fa-map-marker-alt',
    Reporting: 'fa-file-alt',
    Reports: 'fa-file-alt',
    Roles: 'fa-lock',
    Tools: 'fa-toolbox',
    Tractors: 'fa-tractor',
    Trailers: 'fa-trailer'
}

/** Permission-gated menu item definitions for the primary navigation. */
export const MENU_ITEMS = [
    { id: 'Dashboard', permission: 'dashboard.view', text: 'Dashboard' },
    { id: 'Mixers', permission: 'mixers.view', text: 'Mixers' },
    { id: 'Tractors', permission: 'tractors.view', text: 'Tractors' },
    { id: 'Trailers', permission: 'trailers.view', text: 'Trailers' },
    { id: 'Heavy Equipment', permission: 'equipment.view', text: 'Heavy Equipment' },
    { id: 'Pickup Trucks', permission: 'pickup_trucks.view', text: 'Pickup Trucks' },
    { id: 'Operators', permission: 'operators.view', text: 'Operators' },
    { id: 'Managers', permission: 'managers.view', text: 'Managers' },
    { id: 'Reports', permission: 'reports.view', text: 'Reports' },
    { id: 'List', permission: 'list.view', text: 'List' },
    { id: 'CRM', permission: 'plan.view', text: 'Customer Relations' },
    { id: 'Plan', permission: 'plan.view', text: 'Operations' },
    { id: 'Plants', permission: 'plants.view', text: 'Plants' },
    { id: 'Regions', permission: 'regions.view', text: 'Regions' },
    { id: 'Roles', permission: 'roles.view', text: 'Roles' },
    { id: 'Calculators', permission: 'calculator.view', text: 'Calculators' },
    { id: 'Maintenance', permission: 'maintenance.view', text: 'Maintenance' },
    { id: 'NRMCA', permission: 'nrmca.view', text: 'Calibrations & Certifications' }
]

/** Navigation item IDs grouped under the "Assets" dropdown. */
export const ASSET_ITEMS = ['Mixers', 'Tractors', 'Trailers', 'Heavy Equipment', 'Pickup Trucks']
/** Navigation item IDs grouped under the "People" dropdown. */
export const PEOPLE_ITEMS = ['Operators', 'Managers']
/** Navigation item IDs grouped under the "Reporting" dropdown. */
export const REPORTING_ITEMS = ['Reports', 'List', 'Maintenance', 'NRMCA']
/** Navigation item IDs grouped under the "Tools" dropdown. */
export const TOOLS_ITEMS = ['Plan', 'CRM', 'Calculators']
/** Navigation item IDs grouped under the "Admin" category (two-level mode). */
export const ADMIN_ITEMS = ['Plants', 'Regions', 'Roles']

/** Category definitions for the two-level tab nav row. */
export const CATEGORIES = [
    { icon: 'fa-tachometer-alt', id: 'dashboard', items: [], label: 'Dashboard' },
    { icon: 'fa-toolbox', id: 'tools', items: TOOLS_ITEMS, label: 'Tools' },
    { icon: 'fa-truck', id: 'assets', items: ASSET_ITEMS, label: 'Assets' },
    { icon: 'fa-users', id: 'people', items: PEOPLE_ITEMS, label: 'People' },
    { icon: 'fa-file-alt', id: 'reporting', items: REPORTING_ITEMS, label: 'Reporting' },
    { icon: 'fa-cog', id: 'admin', items: ADMIN_ITEMS, label: 'Admin' }
]

/** Resolves which category a view ID belongs to. */
export const getCategoryForView = (viewId) => {
    if (!viewId || viewId === 'Dashboard') return 'dashboard'
    if (ASSET_ITEMS.includes(viewId)) return 'assets'
    if (PEOPLE_ITEMS.includes(viewId)) return 'people'
    if (REPORTING_ITEMS.includes(viewId)) return 'reporting'
    if (TOOLS_ITEMS.includes(viewId)) return 'tools'
    if (ADMIN_ITEMS.includes(viewId)) return 'admin'
    return 'dashboard'
}

/** Widths used to render the loading-skeleton pills inside the nav header. */
export const NAV_SKELETON_WIDTHS = [72, 56, 52, 64, 48]

/** Background style shared across all desktop/mobile header bars. */
export const buildHeaderStyle = (accentColor) => ({
    backgroundColor: accentColor,
    backgroundImage: `
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
        radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, transparent 50%)
    `,
    backgroundPosition: '0 0, 0 0, 0 0',
    backgroundSize: '20px 20px, 20px 20px, 40px 40px'
})
