
const obj = {
    isVariable: true,
    value: 5,
    className: 'TVariable'
};

function resolveValue(val) {
    if (val && typeof val === 'object') {
        const isVarLike = val.isVariable === true || 
                         (val.className && (val.className.includes('Variable') || val.className === 'TStringMap'));
                         
        if (isVarLike) {
            if (val.value !== undefined) return val.value;
        }
    }
    return val;
}

function getPropertyValue(obj, propPath) {
    const parts = propPath.split('.');
    let current = obj;

    for (const part of parts) {
        let target = current;
        const isVarLike = current.isVariable === true || 
                         (current.className && (current.className.includes('Variable') || current.className === 'TStringMap'));
                         
        if (isVarLike) {
            target = resolveValue(current);
        }

        const hasInContent = (target !== null && typeof target === 'object' && (part in target)) ||
            (target !== undefined && target !== null && target[part] !== undefined);

        if (hasInContent) {
            current = target[part];
        } else if (current !== target && current[part] !== undefined) {
            current = current[part];
        } else if (target === current) {
            current = current[part];
        } else {
            current = undefined;
        }
    }

    return resolveValue(current);
}

console.log(getPropertyValue(obj, 'value'));

