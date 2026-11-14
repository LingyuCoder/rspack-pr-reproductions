import helper from './helper.cjs';

export const loadA = helper.loadA;
export const loadB = () => import(/* webpackChunkName: "shared" */ './normal.mjs');
