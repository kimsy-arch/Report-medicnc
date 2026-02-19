
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ReportData } from '../types';
import { Sparkles, Loader2 } from 'lucide-react';

interface InsightSectionProps {
  data: ReportData;
  onInsightGenerated?: (text: string) => void;
}

export const InsightSection: React.FC<InsightSectionProps> = ({ data, onInsightGenerated }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const generateInsight = async () => {
    if (!process.env.API_KEY) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        광고 분석 보고서 요약 요청:
        광고주: ${data.summary.advertiser}
        캠페인: ${data.summary.name}
        성과: 노출 ${data.summary.totalImpressions}, 클릭 ${data.summary.totalClicks}, CTR ${data.summary.avgCtr}%
        
        전문 마케터의 시선에서 성과를 3문장으로 요약하고, **강조**를 사용하여 신뢰감 있는 한국어로 작성해주세요.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const text = response.text || '';
      setInsight(text);
      if (onInsightGenerated) onInsightGenerated(text);
    } catch (error: any) {
      setInsight('분석을 생성할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateInsight();
  }, [data]);

  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Sparkles size={100} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-100" />
          <h3 className="text-lg font-bold">AI 캠페인 실시간 진단</h3>
        </div>
        {loading ? (
          <div className="flex items-center space-x-3 py-4">
            <Loader2 className="animate-spin" />
            <span className="text-sm font-medium animate-pulse">전략 수립 중...</span>
          </div>
        ) : (
          <div className="text-indigo-50 leading-relaxed text-sm whitespace-pre-line">
             {insight}
          </div>
        )}
      </div>
    </div>
  );
};
