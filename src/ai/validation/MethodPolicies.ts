/**
 * MethodPolicies
 *
 * Regelt erlaubte Parameteranzahlen und führt Runtime-Validierungs-Sets
 * für Actions, Events und Variablen-Typen.
 */

export interface MethodPolicy {
    minParams: number;
    maxParams: number;
    mutating: boolean;
    destructive: boolean;
}

export const METHOD_POLICIES: Record<string, MethodPolicy> = {
    createStage: { minParams: 2, maxParams: 4, mutating: true, destructive: false },
    addObject: { minParams: 2, maxParams: 2, mutating: true, destructive: false },
    addVariable: { minParams: 3, maxParams: 5, mutating: true, destructive: false },
    createTask: { minParams: 2, maxParams: 3, mutating: true, destructive: false },
    addAction: { minParams: 3, maxParams: 4, mutating: true, destructive: false },
    addTaskCall: { minParams: 2, maxParams: 2, mutating: true, destructive: false },
    connectEvent: { minParams: 4, maxParams: 4, mutating: true, destructive: false },
    setProperty: { minParams: 4, maxParams: 4, mutating: true, destructive: false },
    bindVariable: { minParams: 4, maxParams: 4, mutating: true, destructive: false },
};

export const VALID_ACTION_TYPES = new Set<string>([
    'property', 'action', 'set_child_property', 'increment', 'negate',
    'variable', 'set_variable', 'calculate', 'call_method', 'navigate', 'navigate_stage', 'restart_game',
    'play_audio', 'stop_audio', 'spawn_object', 'destroy_object', 'move_to', 'animate', 'sprite_animate',
    'toggle_dialog', 'show_toast', 'bind_event', 'unbind_event',
    'list_push', 'list_pop', 'list_get', 'list_set', 'list_remove', 'list_clear', 'list_shuffle',
    'list_contains', 'list_length', 'map_get', 'map_set', 'map_delete', 'map_has', 'map_keys',
    'http', 'respond_http', 'execute_login_request', 'data_action', 'handle_api_request',
    'load_theme_map', 'store_token', 'create_room', 'join_room', 'service'
]);

export const VALID_VARIABLE_TYPES = new Set<string>([
    'integer', 'real', 'string', 'boolean', 'timer', 'random', 'list', 'object', 'object_list',
    'threshold', 'trigger', 'range', 'keystore', 'any', 'json', 'number'
]);

export const VALID_OBJECT_EVENTS = new Set<string>([
    'onClick', 'onTap', 'onPointerDown', 'onPointerUp', 'onHover', 'onDoubleClick', 'onContextMenu',
    'onMouseEnter', 'onMouseLeave', 'onMouseMove', 'onMouseDown', 'onMouseUp', 'onTouchStart', 'onTouchEnd', 'onTouchMove',
    'onDragStart', 'onDrag', 'onDragEnd', 'onDrop', 'onKeyDown', 'onKeyUp', 'onFocus', 'onBlur', 'onChange', 'onInput', 'onSubmit',
    'onCollisionEnter', 'onCollisionExit', 'onBoundaryHit', 'onScreenEnter', 'onScreenExit',
    'onLoad', 'onError', 'onPlay', 'onPause', 'onEnded', 'onTimeUpdate', 'onVolumeChange', 'onSeeking', 'onSeeked', 'onProgress',
    'onWaiting', 'onPlaying', 'onCanPlay', 'onCanPlayThrough', 'onLoadedData', 'onLoadedMetadata', 'onDurationChange', 'onRateChange',
    'onResize', 'onScroll', 'onWheel', 'onAnimationStart', 'onAnimationEnd', 'onAnimationIteration', 'onTransitionEnd',
    'onFinished', 'onTick', 'onThresholdReached', 'onThresholdLeft', 'onTriggerEnter', 'onTriggerExit',
    'onMinReached', 'onMaxReached', 'onInside', 'onOutside', 'onItemAdded', 'onItemRemoved', 'onContains', 'onNotContains',
    'onCleared', 'onGenerated', 'onItemCreated', 'onItemUpdated', 'onItemDeleted', 'onItemRead', 'onNotFound',
    'onHour', 'onMinute', 'onSecond', 'onValueChanged', 'onValueEmpty'
]);

export const VALID_STAGE_TYPES = new Set<string>(['standard', 'splash', 'main', 'template', 'blueprint']);
