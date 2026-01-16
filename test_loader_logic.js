
// Mock Classes to avoid DOM dependencies
class MockComponent {
    constructor(name) {
        this.id = "mock_id";
        this.name = name;
        this.Tasks = undefined;
    }
}

class MockWindow extends MockComponent {
    constructor(name) {
        super(name);
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.style = {};
    }
}

class MockButton extends MockWindow {
    constructor(name, x, y, w, h, caption) {
        super(name);
        this.x = x; this.y = y; this.width = w; this.height = h;
        this.caption = "";
        if (caption) this.caption = caption;
    }
}

// Mimic hydrateObjects logic from Editor.ts
function hydrateObjects(objectsData) {
    const objects = [];

    objectsData.forEach((objData) => {
        let newObj = null;

        // Factory based on className
        switch (objData.className) {
            case 'TButton':
                newObj = new MockButton(objData.name, objData.x, objData.y, objData.width, objData.height, objData.caption);
                break;
            default:
                console.warn("Unknown class:", objData.className);
                break;
        }

        if (newObj) {
            newObj.id = objData.id;
            if (objData.style) Object.assign(newObj.style, objData.style);

            // Restore Tasks
            if (objData.Tasks) {
                console.log(`Restoring Tasks for ${newObj.name}:`, objData.Tasks);
                newObj.Tasks = objData.Tasks;
            } else {
                console.log(`No Tasks found for ${newObj.name}`);
            }

            objects.push(newObj);
        }
    });

    return objects;
}

// Test Case
const jsonFromUser = {
    "className": "TButton",
    "id": "obj_test",
    "name": "Button_With_Task",
    "x": 22,
    "y": 14,
    "width": 6,
    "height": 2,
    "style": { "visible": true },
    "caption": "Click Me",
    "Tasks": {
        "onClick": "MyTask"
    }
};

const jsonWithoutTask = {
    "className": "TButton",
    "name": "Button_No_Task",
    "x": 0, "y": 0, "width": 10, "height": 10
};

console.log("--- Starting Test ---");
const results = hydrateObjects([jsonFromUser, jsonWithoutTask]);

console.log("--- Results ---");
results.forEach(obj => {
    console.log(`Object: ${obj.name}`);
    console.log(`  Tasks:`, obj.Tasks);
});

if (results[0].Tasks && results[0].Tasks.onClick === "MyTask") {
    console.log("SUCCESS: Tasks restored correctly.");
} else {
    console.log("FAILURE: Tasks NOT restored.");
}
