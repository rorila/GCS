---
description: How to create a physics calculation task (e.g., paddle bounce with angle)
---

# Workflow: Creating a Physics Calculation Task

This workflow documents the steps to create a Task that performs physics calculations using standard action blocks. Example: Ball bouncing off a paddle with angle based on hit position.

## Prerequisites
- The `ActionExecutor.ts` must support dynamic source resolution (`self`, `other`) in `handleVariableAction`. (Already implemented.)

## Steps

### 1. Define the Logic
Before writing JSON, plan the calculation steps:
1. **Get coordinates** from both objects (`self.y`, `other.y`, `self.height`, `other.height`)
2. **Calculate centers** (e.g., `paddleCenterY = paddleY + paddleH / 2`)
3. **Calculate difference** (e.g., `diffY = ballCenterY - paddleCenterY`)
4. **Normalize** to a factor between -1 and 1 (e.g., `factor = diffY / (paddleH / 2)`)
5. **Apply to velocity** (e.g., `velocityY = factor * maxBounceAngle`)
6. **Reverse direction** (e.g., negate `velocityX`)

### 2. Create the actionSequence
Build the `actionSequence` array with these action types:

```json
[
  // Step 1: Read properties using "variable" actions
  { "type": "variable", "source": "other", "sourceProperty": "y", "variableName": "paddleY" },
  { "type": "variable", "source": "other", "sourceProperty": "height", "variableName": "paddleH" },
  { "type": "variable", "source": "self", "sourceProperty": "y", "variableName": "ballY" },
  { "type": "variable", "source": "self", "sourceProperty": "height", "variableName": "ballH" },

  // Step 2-4: Math using "calculate" actions
  { "type": "calculate", "resultVariable": "paddleHalfH", "calcSteps": [
      { "operandType": "variable", "variable": "paddleH" },
      { "operator": "/", "constant": 2 }
  ]},
  // ... more calculate steps for centers, diff, factor ...

  // Step 5: Set velocity using "property" action
  { "type": "property", "target": "self", "changes": { "velocityY": "${newVY}" } },

  // Step 6: Reverse direction using "negate" action
  { "type": "negate", "target": "self", "changes": { "velocityX": 1 } }
]
```

### 3. Create the flowGraph (Visual Representation)
For each action, create a corresponding visual node:

```json
"flowGraph": {
  "elements": [
    { "id": "task-start", "type": "Task", "x": 50, "y": 50, "width": 200, "height": 60,
      "properties": { "name": "TaskName", "details": "" }, "data": {} },
    { "id": "act-1", "type": "Action", "x": 300, "y": 50, "width": 200, "height": 80,
      "properties": { "name": "Get Paddle Y", "details": "paddleY = other.y" },
      "data": { /* copy of the action from actionSequence */ } },
    // ... more nodes ...
  ],
  "connections": [
    { "startTargetId": "task-start", "endTargetId": "act-1", ... },
    // ... chain all nodes sequentially ...
  ]
}
```

**Layout Tips:**
- Use 3-4 nodes per row, wrap to next row for readability
- Node spacing: ~250px horizontal, ~150px vertical
- First node (Task) at x=50, y=50

### 4. Add Task to Project JSON
Insert the complete task object into the `tasks` array in the project JSON file.

### 5. Assign to Object Event
Add the task to the triggering object's `Tasks` property:

```json
{
  "className": "TSprite",
  "name": "BallSprite",
  "Tasks": {
    "onCollision": "HandlePaddleHit"  // <-- Add this
  }
}
```

## Key Action Types

| Type | Purpose | Key Properties |
|------|---------|----------------|
| `variable` | Read property into variable | `source`, `sourceProperty`, `variableName` |
| `calculate` | Math operations | `resultVariable`, `calcSteps[]` |
| `property` | Set object property | `target`, `changes{}` |
| `negate` | Multiply by -1 | `target`, `changes{}` |

## Reference: HandlePaddleHit Example
See `project_NewTennis29.json` for the complete working implementation.
