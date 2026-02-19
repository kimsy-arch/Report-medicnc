
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  BarChart3, TrendingUp, MousePointer2, Target, Calendar, Download, 
  Layers, ChevronLeft, ChevronRight, Loader2, Sparkles
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { MetricCard } from './components/MetricCard';
import { PerformanceChart, CtrChart } from './components/Charts';
import { DataTable } from './components/DataTable';
import { INITIAL_REPORT_DATA } from './constants';
import { ReportData, AdRow } from './types';

const ClientApp: React.FC = () => {
  const [dataIndex, setDataIndex] = useState<any>(null);
  const [currentMonthRows, setCurrentMonthRows] = useState<AdRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // URL에서 client ID 추출
  const clientId = useMemo(() => new URLSearchParams(window.location.search).get('client') || 'demo', []);

  // 1. 초기 인덱스 데이터 로드
  useEffect(() => {
    const loadIndex = async () => {
      try {
        const res = await fetch(`./data/${clientId}/index.json`);
        if (!res.ok) throw new Error("데이터를 불러올 수 없습니다.");
        const json = await res.json();
        setDataIndex(json);
        // 기본적으로 전체 데이터는 index.json에 있을 수 없으므로(월별 분리), 
        // 첫 번째 월 데이터를 로드하거나 초기값 사용
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadIndex();
  }, [clientId]);

  // 2. 월 선택 시 해당 월 데이터 로드
  useEffect(() => {
    if (selectedMonth === 'all') {
      // '전체'일 경우 index에 요약 정보만 활용 (상세 데이터는 첫 로드 필요 시 로직 추가)
      setCurrentMonthRows([]); 
    } else {
      const loadMonth = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`./data/${clientId}/${selectedMonth}.json`);
          const json = await res.json();
          setCurrentMonthRows(json);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoading(false);
        }
      };
      loadMonth();
    }
  }, [selectedMonth, clientId]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#f8fafc',
        onclone: (doc) => {
          doc.getElementById('ai-insight-container')?.remove();
          doc.getElementById('month-filter-ui')?.remove();
          doc.querySelectorAll('.print-hide')?.forEach(el => (el as HTMLElement).style.display = 'none');
        }
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`Report_${dataIndex?.summary?.advertiser || 'Ad'}.pdf`);
    } catch (e) { alert("PDF 생성 실패"); } finally { setIsExporting(false); }
  };

  if (isLoading && !dataIndex) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="font-bold text-slate-400">데이터를 불러오고 있습니다...</p>
      </div>
    );
  }

  const activeData = dataIndex || INITIAL_REPORT_DATA;
  const rowsToDisplay = selectedMonth === 'all' ? activeData.rows : currentMonthRows;

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/90 border-b border-slate-200 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-20">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">R</div>
             <span className="font-black text-slate-900 uppercase tracking-tighter">Campaign Insight</span>
          </div>
          <button onClick={handleDownloadPDF} disabled={isExporting} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm shadow-sm flex items-center space-x-2">
            {isExporting ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
            <span>{isExporting ? '생성 중...' : '리포트 다운로드'}</span>
          </button>
        </div>
      </header>

      <main ref={reportRef} className="max-w-7xl mx-auto px-4 mt-12 space-y-12">
        <div className="flex justify-between items-end">
          <div className="space-y-3">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase tracking-widest">{activeData.summary.advertiser}</span>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">{activeData.summary.name}</h2>
          </div>
          <div id="month-filter-ui" className="flex items-center p-1 bg-slate-200/50 rounded-2xl">
             <button onClick={() => setSelectedMonth('all')} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedMonth === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>전체</button>
             {activeData.months?.map((m: string) => (
               <button key={m} onClick={() => setSelectedMonth(m)} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedMonth === m ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>{parseInt(m)}월</button>
             ))}
          </div>
        </div>

        {/* AI Insight (Pre-generated) */}
        {activeData.aiInsight && (
          <div id="ai-insight-container" className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <Sparkles className="absolute top-0 right-0 p-10 opacity-10 w-40 h-40" />
            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles size={18} />
                <h3 className="font-bold text-lg">AI 캠페인 진단 결과</h3>
              </div>
              <p className="text-indigo-50 leading-relaxed whitespace-pre-line">{activeData.aiInsight}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <MetricCard label="Impressions" value={rowsToDisplay.reduce((s, r) => s + r.impressions, 0).toLocaleString()} subValue="노출 성과" colorClass="bg-indigo-600" icon={<TrendingUp/>}/>
          <MetricCard label="Clicks" value={rowsToDisplay.reduce((s, r) => s + r.clicks, 0).toLocaleString()} subValue="클릭 성과" colorClass="bg-purple-600" icon={<MousePointer2/>}/>
          <MetricCard label="Efficiency" value={`${rowsToDisplay.length > 0 ? (rowsToDisplay.reduce((s, r) => s + r.clicks, 0) / rowsToDisplay.reduce((s, r) => s + r.impressions, 0) * 100).toFixed(2) : 0}%`} subValue="평균 클릭율" colorClass="bg-emerald-600" icon={<Target/>}/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"><PerformanceChart data={rowsToDisplay}/></div>
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm"><CtrChart data={rowsToDisplay}/></div>
        </div>

        <DataTable rows={rowsToDisplay}/>
      </main>

      <footer className="mt-20 py-10 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100">
        Professional Ad Intelligence Report
      </footer>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<ClientApp />);
