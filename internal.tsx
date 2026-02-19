
import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  BarChart3, TrendingUp, MousePointer2, Target, Calendar, Download, 
  Plus, X, FileSpreadsheet, Upload, Loader2, Edit3, Check, Layers, Archive, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { MetricCard } from './components/MetricCard';
import { PerformanceChart, CtrChart } from './components/Charts';
import { DataTable } from './components/DataTable';
import { InsightSection } from './components/InsightSection';
import { INITIAL_REPORT_DATA } from './constants';
import { ReportData, AdRow } from './types';

const InternalApp: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData>(INITIAL_REPORT_DATA);
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [aiInsightText, setAiInsightText] = useState<string>(''); // Export 시 보존할 분석 텍스트
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(reportData.summary.name);
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

  // JSON 데이터 패키지 내보내기 (JSZip 사용)
  const handleExportJSON = async () => {
    const JSZip = (window as any).JSZip;
    if (!JSZip) {
      alert("JSZip 라이브러리가 로드되지 않았습니다.");
      return;
    }

    const zip = new JSZip();
    const clientFolder = zip.folder(reportData.summary.advertiser.replace(/\s+/g, '_').toLowerCase());

    // 1. index.json 생성
    const indexData = {
      summary: reportData.summary,
      months: availableMonths,
      aiInsight: aiInsightText, // AI 분석 결과 고정 포함
      banners: bannerImages // 이미지도 포함 가능 (용량 주의)
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
    link.download = `Report_Package_${reportData.summary.advertiser}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 기존 엑셀 분석 로직 (normalize, extractNumber 등은 그대로 유지)
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
      for (let i = 0; i < Math.min(aoa.length, 30); i++) {
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
        summary: { ...prev.summary, totalImpressions: mappedRows.reduce((s, r) => s + r.impressions, 0) },
        rows: mappedRows
      }));
      setIsModalOpen(false);
    } catch (e: any) { alert(e.message); } finally { setIsParsing(false); }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/95 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center h-20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">R</div>
            <h1 className="font-black text-slate-900">Internal Manager</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center space-x-2">
              <Upload size={16} /> <span>데이터 분석</span>
            </button>
            <button onClick={handleExportJSON} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center space-x-2 shadow-lg hover:scale-105 transition-transform">
              <Archive size={16} /> <span>거래처 JSON 내보내기</span>
            </button>
          </div>
        </div>
      </header>

      <main ref={reportRef} className="max-w-7xl mx-auto px-4 mt-12 space-y-12">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <span className="text-indigo-600 font-black text-xs uppercase tracking-widest">{reportData.summary.advertiser}</span>
            <h2 className="text-4xl font-black text-slate-900">{reportData.summary.name}</h2>
          </div>
          <div id="month-filter-ui" className="flex items-center p-1 bg-slate-100 rounded-2xl">
            <button onClick={() => setSelectedMonth('all')} className={`px-4 py-1.5 rounded-xl text-xs font-bold ${selectedMonth === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>전체</button>
            {availableMonths.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)} className={`px-4 py-1.5 rounded-xl text-xs font-bold ${selectedMonth === m ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{parseInt(m)}월</button>
            ))}
          </div>
        </div>

        <div id="ai-insight-container">
          <InsightSection data={reportData} onInsightGenerated={setAiInsightText} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <MetricCard label="Impressions" value={filteredRows.reduce((s, r) => s + r.impressions, 0).toLocaleString()} subValue="노출량" colorClass="bg-indigo-600" icon={<TrendingUp />} />
          <MetricCard label="Clicks" value={filteredRows.reduce((s, r) => s + r.clicks, 0).toLocaleString()} subValue="클릭량" colorClass="bg-purple-600" icon={<MousePointer2 />} />
          <MetricCard label="Efficiency" value={`${filteredRows.length > 0 ? (filteredRows.reduce((s, r) => s + r.clicks, 0) / filteredRows.reduce((s, r) => s + r.impressions, 0) * 100).toFixed(2) : 0}%`} subValue="클릭율" colorClass="bg-emerald-600" icon={<Target />} />
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100"><PerformanceChart data={filteredRows} /></div>
          <div className="bg-white p-8 rounded-3xl border border-slate-100"><CtrChart data={filteredRows} /></div>
        </div>

        <DataTable rows={filteredRows} />
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full">
            <h3 className="text-xl font-black mb-6">엑셀 파일 업로드</h3>
            <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-indigo-50">
              <Upload className="text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">{excelFile ? excelFile.name : '파일을 선택하세요'}</p>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex justify-end mt-8 space-x-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold">취소</button>
              <button onClick={parseExcel} disabled={!excelFile || isParsing} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">
                {isParsing ? '분석 중...' : '분석 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<InternalApp />);
