import { VgValueRef } from '../../../vega.schema';
import { UnitModel } from '../../unit';
export { color } from './color';
export { nonPosition } from './nonposition';
export { pointPosition } from './position-point';
export { pointOrRangePosition, rangePosition } from './position-range';
export { rectPosition } from './position-rect';
export { text } from './text';
export { tooltip } from './tooltip';
export type Ignore = Record<'color' | 'size' | 'orient' | 'align' | 'baseline' | 'theta', 'ignore' | 'include'>;
export declare function baseEncodeEntry(model: UnitModel, ignore: Ignore): {
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: unknown;
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    ariaRoleDescription: unknown;
    aria: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    description: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    description: import("vega").SignalRef | {
        value: string;
    };
    ariaRoleDescription: unknown;
    aria: unknown;
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: unknown;
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: unknown;
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    ariaRoleDescription: {
        value: string | import("vega").SignalRef;
    };
    aria: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    description: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    description: import("vega").SignalRef | {
        value: string;
    };
    ariaRoleDescription: {
        value: string | import("vega").SignalRef;
    };
    aria: unknown;
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: unknown;
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: VgValueRef | (VgValueRef & {
        test?: string;
    })[] | {
        signal: string;
    };
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    ariaRoleDescription: unknown;
    aria: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    description: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    description: import("vega").SignalRef | {
        value: string;
    };
    ariaRoleDescription: unknown;
    aria: unknown;
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: VgValueRef | (VgValueRef & {
        test?: string;
    })[] | {
        signal: string;
    };
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: VgValueRef | (VgValueRef & {
        test?: string;
    })[] | {
        signal: string;
    };
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    ariaRoleDescription: {
        value: string | import("vega").SignalRef;
    };
    aria: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    description: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
} | {
    description: import("vega").SignalRef | {
        value: string;
    };
    ariaRoleDescription: {
        value: string | import("vega").SignalRef;
    };
    aria: unknown;
    fill: unknown;
    stroke: unknown;
    angle: unknown;
    height: unknown;
    width: unknown;
    url: unknown;
    clip?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    cursor: unknown;
    fillOpacity: unknown;
    font: unknown;
    fontSize: unknown;
    fontStyle: unknown;
    fontWeight: unknown;
    opacity: unknown;
    strokeOpacity: unknown;
    strokeWidth: unknown;
    x?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    dir: unknown;
    path?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    text: unknown;
    size: unknown;
    x2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    xc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    y2?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    yc?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeDash: unknown;
    strokeDashOffset: unknown;
    strokeCap: unknown;
    strokeJoin: unknown;
    strokeMiterLimit: unknown;
    tooltip: VgValueRef | (VgValueRef & {
        test?: string;
    })[] | {
        signal: string;
    };
    startAngle: unknown;
    endAngle: unknown;
    innerRadius: unknown;
    outerRadius: unknown;
    cornerRadius: unknown;
    orient: unknown;
    interpolate: unknown;
    tension: unknown;
    defined?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeForeground?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    strokeOffset: unknown;
    cornerRadiusTopLeft: unknown;
    cornerRadiusTopRight: unknown;
    cornerRadiusBottomRight: unknown;
    cornerRadiusBottomLeft: unknown;
    baseline: unknown;
    align: unknown;
    scaleX?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    scaleY?: VgValueRef | (VgValueRef & {
        test?: string;
    })[];
    shape: unknown;
    dx: unknown;
    dy: unknown;
    ellipsis: unknown;
    limit: unknown;
    radius: unknown;
    theta: unknown;
    href: unknown;
    smooth: unknown;
    lineBreak: unknown;
    lineHeight: unknown;
    blend: unknown;
    ariaRole: unknown;
    padAngle: unknown;
    aspect: unknown;
};
//# sourceMappingURL=base.d.ts.map