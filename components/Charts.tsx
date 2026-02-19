
import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell 
} from 'recharts';
import { AdRow } from '../types';

interface ChartsProps {
  data: AdRow[];
}

// 날짜 포맷터: "2026.02.06" -> "02.06 (26)"
const formatXAxis = (val: string) => {
  if (!val) return '';
  const datePart = val.split(' ')[0]; // "2026.02.06"
  const parts = datePart.split(/[\.\-]/);
  if (parts.length >= 3) {
    const yearShort = parts[0].substring(2);
    return `${parts[1]}.${parts[2]} (${yearShort})`;
  }
  return val;
};

export const PerformanceChart: React.FC<ChartsProps> = ({ data }) => {
  return (
    <div className="h-80 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 10, fontWeight: 600}} 
            axisLine={false} 
            tickLine={false} 
            tickFormatter={formatXAxis}
            minTickGap={20}
          />
          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            labelFormatter={formatXAxis}
          />
          <Area 
            type="monotone" 
            dataKey="impressions" 
            stroke="#6366f1" 
            fillOpacity={1} 
            fill="url(#colorImp)" 
            strokeWidth={3}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CtrChart: React.FC<ChartsProps> = ({ data }) => {
  return (
    <div className="h-80 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 10, fontWeight: 600}} 
            axisLine={false} 
            tickLine={false}
            tickFormatter={formatXAxis}
            minTickGap={20}
          />
          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
          <Tooltip 
             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
             labelFormatter={formatXAxis}
          />
          <Bar dataKey="ctr" radius={[4, 4, 0, 0]} animationDuration={1500}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.ctr > 0.1 ? '#10b981' : '#f59e0b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
