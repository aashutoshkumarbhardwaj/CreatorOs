/**
 * Zustag - A lightweight, Zustand-inspired state management library for vanilla JavaScript.
 */
(function(global) {
    'use strict';

    function createStore(createState) {
        let state;
        const listeners = new Set();

        const setState = (partial, replace) => {
            const nextState = typeof partial === 'function' ? partial(state) : partial;
            if (!Object.is(nextState, state)) {
                const previousState = state;
                state = (replace ?? (typeof nextState !== 'object' || nextState === null))
                    ? nextState
                    : Object.assign({}, state, nextState);
                listeners.forEach((listener) => listener(state, previousState));
            }
        };

        const getState = () => state;

        const subscribe = (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        };

        const destroy = () => {
            listeners.clear();
        };

        const api = { setState, getState, subscribe, destroy };
        state = createState(setState, getState, api);
        return api;
    }

    global.zustag = {
        createStore
    };
})(typeof window !== 'undefined' ? window : globalThis);
