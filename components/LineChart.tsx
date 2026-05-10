// components/LineChart.tsx — shared SVG line chart used by weight, measurements, and exercise progress screens
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { formatShortDate } from '../lib/utils';

export interface ChartPoint {
  date: string;
  value: number;
}

interface Props {
  points: ChartPoint[];
  color: string;
  height?: number;
  /** Formats a Y-axis value into a display string. Default: one decimal place. */
  yFormat?: (v: number) => string;
  gridCount?: number;
}

const PAD = { top: 16, bottom: 28, left: 38, right: 12 };

export default function LineChart({
  points,
  color,
  height = 180,
  yFormat = v => v.toFixed(1),
  gridCount = 4,
}: Props) {
  // State must precede any conditional return per React Hooks rules
  const [w, setW] = useState(0);

  if (points.length < 2) return null;

  const values = points.map(p => p.value);
  const dates  = points.map(p => new Date(p.date).getTime());
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);
  const vRange = maxV - minV || 1;
  const dRange = maxD - minD || 1;

  const plotW = w - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const toX = (ts: number) => PAD.left + ((ts - minD) / dRange) * plotW;
  const toY = (v: number)  => PAD.top  + (1 - (v - minV) / vRange) * plotH;

  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const v = minV + (vRange * i) / gridCount;
    return { y: toY(v) };
  });

  const polyPts = w > 0
    ? points.map(p => `${toX(new Date(p.date).getTime())},${toY(p.value)}`).join(' ')
    : '';

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {gridLines.map((g, i) => (
            <Line key={i} x1={PAD.left} y1={g.y} x2={w - PAD.right} y2={g.y}
              stroke="rgba(150,150,150,0.18)" strokeWidth={1} />
          ))}

          <SvgText x={PAD.left - 4} y={toY(maxV) + 4} textAnchor="end" fontSize={9} fill="rgba(150,150,150,0.8)">
            {yFormat(maxV)}
          </SvgText>
          <SvgText x={PAD.left - 4} y={toY(minV) + 4} textAnchor="end" fontSize={9} fill="rgba(150,150,150,0.8)">
            {yFormat(minV)}
          </SvgText>

          <SvgText x={PAD.left} y={height - 4} textAnchor="start" fontSize={9} fill="rgba(150,150,150,0.8)">
            {formatShortDate(points[0].date)}
          </SvgText>
          <SvgText x={w - PAD.right} y={height - 4} textAnchor="end" fontSize={9} fill="rgba(150,150,150,0.8)">
            {formatShortDate(points[points.length - 1].date)}
          </SvgText>

          <Polyline points={polyPts} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.85} />

          {points.map((p, i) => (
            <Circle key={i} cx={toX(new Date(p.date).getTime())} cy={toY(p.value)} r={4} fill={color} />
          ))}
        </Svg>
      )}
    </View>
  );
}
