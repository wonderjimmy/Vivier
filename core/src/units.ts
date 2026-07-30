// Time-unit conversions ONLY.
//
// This module is the named carve-out in AC1a.13: it is permitted to hold numeric literals
// because they are definitional properties of time, not tunable simulation parameters.
// Nothing else may live here. If a constant is something an owner might ever want to change,
// it belongs in the tuning config, not in this file.

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
