
import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  BarChart3, TrendingUp, MousePointer2, Target, Calendar, Download, 
  Plus, X, FileSpreadsheet, Upload, Loader2, Edit3, Check, Layers, Archive, Sparkles,
  Database, ShieldCheck, Globe
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MetricCard } from './components/MetricCard';
import { PerformanceChart, CtrChart } from './components/Charts';
import { DataTable } from './components/DataTable';
import { InsightSection } from './components/InsightSection';
import { INITIAL_REPORT_DATA } from './constants';
import { ReportData, AdRow } from './types';

const BUILD_VERSION = "2024.03.25.V1_INTERNAL";

const InternalApp: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData>(INITIAL_REPORT_DATA);
  const [clientKey, setClientKey] = useState<string>("snow"); // 고정 링크용 ID
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [aiInsightText, setAiInsightText] = useState<string>(''); 
  
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const reportRef = useRef<HTMLDivElement>(null);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    reportData.rows.forEach(row => {
      const match = row.date.match(/\d{4}[\.\-](\d{2})/) || row.date.match(/(\d{2})\./);
      if (match) months.add(match[1]);
    });
    return Array.from(months).sort((a, b) => parseInt(a) - parseInt(b));
  }, [reportData.rows]);

  const filteredRows = useMemo(() => {
    if (selectedMonth === 'all') return reportData.rows;
    return reportData.rows.filter(row => {
      const match = row.date.match(/\d{4}[\.\-](\d{2})/) || row.date.match(/(\d{2})\./);
      return match && match[1] === selectedMonth;
    });
  }, [reportData.rows, selectedMonth]);

  // JSON 데이터 패키지 내보내기 (data/{clientKey}/ 구조 생성)
  const handleExportJSON = async () => {
    if (!clientKey.trim()) {
      alert("Client Key를 입력해주세요.");
      return;
    }

    const JSZip = (window as any).JSZip;
    if (!JSZip) {
      alert("JSZip 라이브러리가 로드되지 않았습니다.");
      return;
    }

    setIsExporting(true);
    try {
      const zip = new JSZip();
      // data/{clientKey}/ 폴더 구조 생성
      const dataFolder = zip.folder("data");
      const clientFolder = dataFolder.folder(clientKey.trim().toLowerCase());

      const monthsList = availableMonths.map(m => ({
        label: `2026-${m}`,
        file: `${m}.json`
      }));

      // 1. index.json 생성
      const indexData = {
        summary: reportData.summary,
        aiInsight: aiInsightText,
        months: monthsList,
        version: BUILD_VERSION
      };
      clientFolder.file("index.json", JSON.stringify(indexData, null, 2));

      // 2. 각 월별 JSON 생성
      availableMonths.forEach(month => {
        const monthRows = reportData.rows.filter(row => {
          const match = row.date.match(/\d{4}[\.\-](\d{2})/) || row.date.match(/(\d{2})\./);
          return match && match[1] === month;
        });
        clientFolder.file(`${month}.json`, JSON.stringify(monthRows, null, 2));
      });

      // 3. 압축 및 다운로드
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Report_Package_${clientKey}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("패키지 생성 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const normalize = (val: any) => String(val || '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase();
  const extractNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    const cleanStr = String(val || '').split('(')[0].replace(/,/g, '').replace('%', '').trim();
    const match = cleanStr.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const parseExcel = async () => {
    if (!excelFile) return;
    setIsParsing(true);
    try {
      const arrayBuffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

      const impKeywords = ['노출', 'IMPRESSION', 'IMP'];
      const clickKeywords = ['클릭', 'CLICK'];
      let hIdx = -1;
      for (let i = 0; i < Math.min(aoa.length, 50); i++) {
        const rStr = aoa[i].map(c => normalize(c)).join('|');
        if (impKeywords.some(k => rStr.includes(k)) && clickKeywords.some(k => rStr.includes(k))) {
          hIdx = i; break;
        }
      }

      if (hIdx === -1) throw new Error("헤더를 찾을 수 없습니다.");
      const headerRow = aoa[hIdx].map(h => normalize(h));
      const colMapping = {
        imp: headerRow.findIndex(h => impKeywords.some(k => h.includes(k))),
        click: headerRow.findIndex(h => clickKeywords.some(k => h.includes(k))),
        product: headerRow.findIndex(h => h.includes('상품') || h.includes('광고')),
        date: headerRow.findIndex(h => h.includes('날짜') || h.includes('DATE'))
      };

      const mappedRows: AdRow[] = aoa.slice(hIdx + 1)
        .filter(row => extractNumber(row[colMapping.imp]) > 0)
        .map((row, idx) => {
          const imp = extractNumber(row[colMapping.imp]);
          const click = extractNumber(row[colMapping.click]);
          return {
            no: idx + 1,
            product: String(row[colMapping.product] || '기본배너'),
            date: String(row[colMapping.date] || '-'),
            impressions: imp,
            clicks: click,
            ctr: imp > 0 ? Number(((click / imp) * 100).toFixed(2)) : 0
          };
        });

      setReportData(prev => ({
        summary: { 
          ...prev.summary, 
          advertiser: clientKey.toUpperCase(),
          totalImpressions: mappedRows.reduce((s, r) => s + r.impressions, 0),
          totalClicks: mappedRows.reduce((s, r) => s + r.clicks, 0),
          avgCtr: Number(((mappedRows.reduce((s, r) => s + r.clicks, 0) / mappedRows.reduce((s, r) => s + r.impressions, 0)) * 100).toFixed(2))
        },
        rows: mappedRows
      }));
      setIsModalOpen(false);
    } catch (e: any) { alert(e.message); } finally { setIsParsing(false); }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="text-indigo-600" size={28} />
          <h1 className="font-black text-slate-900 tracking-tighter text-xl uppercase italic">Internal Manager</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-400 uppercase leading-none">System Version</p>
            <p className="text-xs font-mono font-bold text-slate-600">{BUILD_VERSION}</p>
          </div>
          <span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-indigo-100">Administrator Mode</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10 space-y-10">
        {/* Data Management Panel */}
        <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-widest">데이터 관리 및 배포 패널</h2>
            </div>
            <span className="text-[9px] font-mono text-slate-500 uppercase">Ops Engine Active</span>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            {/* Client Key Input */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase ml-1 flex items-center gap-1">
                <Globe size={12} /> Client Key (URL Identifier)
              </label>
              <input 
                type="text" 
                value={clientKey} 
                onChange={(e) => setClientKey(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 ring-indigo-500/10 outline-none transition-all focus:border-indigo-300" 
                placeholder="예: snow"
              />
            </div>

            {/* Upload Trigger */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center space-x-2 px-6 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm border border-slate-200 shadow-sm"
            >
              <FileSpreadsheet size={18} />
              <span>엑셀 데이터 업로드</span>
            </button>

            {/* Export Trigger */}
            <button 
              onClick={handleExportJSON}
              disabled={isExporting || reportData.rows.length === 0}
              className="flex items-center justify-center space-x-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm group"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} className="group-hover:scale-110 transition-transform" />}
              <span>거래처용 패키지 (.zip) 내보내기</span>
            </button>

            {/* Info Message */}
            <div className="flex flex-col justify-center h-full p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-[10px] text-indigo-700 font-bold leading-relaxed">
                * 내보낸 ZIP 파일을 /data/ 폴더에 압축 해제하면 <br/>
                <span className="underline italic">client.html?client={clientKey}</span> 링크가 자동 갱신됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* Dashboard Preview Section */}
        <div className="pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-8">
             <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
             <h3 className="text-xl font-black text-slate-800">리포트 미리보기 (Internal Preview)</h3>
          </div>

          <div className="space-y-10">
            <div className="flex justify-between items-end">
              <div className="space-y-2">
                <span className="text-indigo-600 font-black text-xs uppercase tracking-widest">{reportData.summary.advertiser}</span>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{reportData.summary.name}</h2>
              </div>
              <div id="month-filter-ui" className="flex items-center p-1 bg-slate-200/50 rounded-2xl">
                <button onClick={() => setSelectedMonth('all')} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedMonth === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>전체</button>
                {availableMonths.map(m => (
                  <button key={m} onClick={() => setSelectedMonth(m)} className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedMonth === m ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>{parseInt(m)}월</button>
                ))}
              </div>
            </div>

            <div id="ai-insight-container">
              <InsightSection data={reportData} onInsightGenerated={setAiInsightText} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <MetricCard label="Impressions" value={filteredRows.reduce((s, r) => s + r.impressions, 0).toLocaleString()} subValue="노출량" colorClass="bg-indigo-600" icon={<TrendingUp size={24}/>} />
              <MetricCard label="Clicks" value={filteredRows.reduce((s, r) => s + r.clicks, 0).toLocaleString()} subValue="클릭량" colorClass="bg-purple-600" icon={<MousePointer2 size={24}/>} />
              <MetricCard label="Efficiency" value={`${filteredRows.length > 0 ? (filteredRows.reduce((s, r) => s + r.clicks, 0) / filteredRows.reduce((s, r) => s + r.impressions, 0) * 100).toFixed(2) : 0}%`} subValue="평균 클릭율" colorClass="bg-emerald-600" icon={<Target size={24}/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"><PerformanceChart data={filteredRows} /></div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"><CtrChart data={filteredRows} /></div>
            </div>

            <DataTable rows={filteredRows} />
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isParsing && setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-10 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-6">엑셀 원본 데이터 업로드</h3>
            <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-3xl cursor-pointer transition-all">
              <Upload className="w-10 h-10 mb-4 text-slate-300" />
              <p className="text-sm font-bold text-slate-600 text-center px-6 leading-relaxed">
                {excelFile ? excelFile.name : '파일을 드래그하거나 클릭하여 선택하세요'}
                {!excelFile && <span className="block text-xs text-slate-400 mt-2 font-medium">(.xlsx, .xls 지원)</span>}
              </p>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex justify-end space-x-3 mt-10">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-400">취소</button>
              <button onClick={parseExcel} disabled={!excelFile || isParsing} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2">
                {isParsing && <Loader2 size={16} className="animate-spin" />}
                <span>{isParsing ? '데이터 분석 중...' : '데이터 분석 시작'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<InternalApp />);
}
