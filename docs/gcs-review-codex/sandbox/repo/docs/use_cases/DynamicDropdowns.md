# Dynamic Dropdowns in Inspector & Dialogs

## Goal
Ensure that dropdowns in the Inspector and Action Dialogs always reflect the current state of the project (e.g., list of Tasks, Actions) and do not show stale data after deletions or renames.

## Problem
Previously, dropdowns were often populated with static lists or cached data. When a task was deleted or renamed, these lists would not update, leading to "ghost" entries and broken references.

## Solution: Dynamic Source Resolution
We introduced a `source` property in `TPropertyDef` and `TActionParam`. The `InspectorRenderer` and `JSONDialogRenderer` now dynamically resolve this source at render time using the `ProjectRegistry`.

### Key Components

1.  **InspectorRenderer.ts**
    - Method: `getOptionsFromSource(prop: TPropertyDef)`
    - Logic: Checks `prop.source` (e.g., `'tasks'`, `'actions'`) and fetches live data from `projectRegistry.getTasks()`, `projectRegistry.getActions()`, etc due to the `ProjectRegistry` being the Single Source of Truth.

2.  **JSONDialogRenderer.ts**
    - Method: `renderActionParams(actionType: string, dialogData: any)`
    - Logic: Similar to the Inspector, it checks `param.source` and populates the `TSelect` or `TDropdown` with current data.

3.  **ProjectRegistry.ts**
    - Role: Acts as the central registry for all project entities.
    - Important: `Editor.ts` must ensure `projectRegistry.setProject(project)` is called whenever the project is loaded or significantly modified to keep the registry in sync.

## Usage
To use a dynamic dropdown, define the property or parameter with a `source` field:

```typescript
// In TPropertyDef (Component Definition)
{
    name: 'targetTask',
    type: 'string', // or 'dropdown'
    source: 'tasks',
    label: 'Target Task'
}

// In Action Definition (StandardActions.ts / ActionRegistry)
{
    name: 'nextTask',
    type: 'string',
    source: 'tasks',
    label: 'Next Task'
}
```

## Supported Sources
- `'tasks'`
- `'actions'`
- `'variables'`
- `'objects'`
- `'stages'`
- `'services'`
- `'easing-functions'`
