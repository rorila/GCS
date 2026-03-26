const projectVariables = { score: 0 };
const stageVariables = {};

const p = new Proxy({}, {
    get: (_target, prop) => {
        if (prop === 'global') return projectVariables;
        if (prop === 'stage') return stageVariables;
        if (prop in stageVariables) return stageVariables[prop];
        if (prop in projectVariables) return projectVariables[prop];
        return undefined;
    },
    ownKeys: () => {
        const keys = new Set([
            'global', 'stage',
            ...Object.keys(projectVariables),
            ...Object.keys(stageVariables)
        ]);
        return Array.from(keys);
    },
    has: (_target, prop) => {
        return (prop === 'global' || prop === 'stage' || prop in stageVariables) || (prop in projectVariables);
    },
    getOwnPropertyDescriptor: (_target, prop) => {
        let val;
        if (prop === 'global') val = projectVariables;
        else if (prop === 'stage') val = stageVariables;
        else val = stageVariables[prop] !== undefined ? stageVariables[prop] : projectVariables[prop];

        if (val !== undefined) {
            return { configurable: true, enumerable: true, value: val };
        }
        return undefined;
    }
});

console.log("spread:", { ...p });
console.log("has score:", "score" in p);
console.log("keys:", Object.keys(p));
