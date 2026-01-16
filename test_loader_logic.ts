
// Mock Classes to avoid DOM dependencies
class MockComponent {
    public id: string = "mock_id";
    public name: string;
    public Tasks?: Record<string, string>;

    constructor(name: string) {
        this.name = name;
    }
}

class MockWindow extends MockComponent {
    public x: number = 0;
    public y: number = 0;
    public width: number = 0;
    public height: number = 0;
    public style: any = {};
}

class MockButton extends MockWindow {
    public caption: string = "";
    constructor(name: string, x: number, y: number, w: number, h: number, caption?: string) {
        super(name);
        this.x = x; this.y = y; this.width = w; this.height = h;
        if (caption) this.caption = caption;
    }
}

// Mimic hydrateObjects logic from Editor.ts
function hydrateObjects(objectsData: any[]): MockWindow[] {
    const objects: MockWindow[] = [];

    objectsData.forEach((objData: any) => {
        let newObj: MockWindow | null = null;

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
