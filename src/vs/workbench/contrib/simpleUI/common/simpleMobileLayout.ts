/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SIMPLE_UI_MOBILE_LAYOUT = 'workbench.simpleUI.mobileLayout';

/** Width-only hysteresis: opening the virtual keyboard must not change layout mode. */
export function isSimpleMobileLayout(mode: string, width: number, active: boolean): boolean {
	return mode === 'on' || (mode !== 'off' && width < (active ? 800 : 768));
}
