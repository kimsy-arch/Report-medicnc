
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MousePointer2, 
  Target, 
  Calendar, 
  Download, 
  Image as ImageIcon,
  Plus,
  Trash2,
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Filter,
  Edit3,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers
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

const App: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData>(INITIAL_REPORT_DATA);
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(reportData.summary.name);
  
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const reportRef = useRef<HTMLDivElement>(null);

  // 월 데이터 추출
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    reportData.rows.forEach(row => {
      const match = row.date.match(/\d{4}[\.\-](\d{2})/);
      if (match) {
        months.add(match[1]);
      } else {
        // "2026.02.06" 형태가 아닐 경우의 fallback
        const altMatch = row.date.match(/(\d{2})\./);
        if (altMatch) months.add(altMatch[1]);
      }
    });
    return Array.from(months).sort((a, b) => parseInt(a) - parseInt(b));
  }, [reportData.rows]);

  // 선택된 월에 따른 필터링 데이터
  const filteredRows = useMemo(() => {
    if (selectedMonth === 'all') return reportData.rows;
    return reportData.rows.filter(row => {
      const match = row.date.match(/\d{4}[\.\-](\d{2})/) || row.date.match(/(\d{2})\./);
      return match && match[1] === selectedMonth;
    });
  }, [reportData.rows, selectedMonth]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setBannerImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const removeBannerImage = (index: number) => {
    setBannerImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    console.log("PDF 생성 프로세스 시작 (AI 진단 리포트 제외)...");
    setIsExporting(true);

    try {
      const element = reportRef.current;
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
        windowWidth: 1280,
        onclone: (clonedDoc) => {
          // 1. 네비게이션 헤더 숨기기
          const header = clonedDoc.querySelector('header');
          if (header) (header as HTMLElement).style.display = 'none';

          // 2. AI 인사이트 섹션 "완전 제거" (사용자 요청 사항)
          const aiInsight = clonedDoc.getElementById('ai-insight-container');
          if (aiInsight) {
             aiInsight.remove();
             console.log("PDF에서 AI 진단 섹션이 성공적으로 제외되었습니다.");
          }

          // 3. 필터 UI 숨기기
          const filterUI = clonedDoc.getElementById('month-filter-ui');
          if (filterUI) filterUI.remove();

          // 4. 기타 UI 요소 숨기기
          clonedDoc.querySelectorAll('.print-hide-btn').forEach(btn => {
            (btn as HTMLElement).style.display = 'none';
          });
        }
      });

      const imgData = canvas.toDataURL('image/png', 0.98);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const safeName = reportData.summary.advertiser.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
      pdf.save(`Ad_Report_${safeName}_${dateStr}.pdf`);
      
    } catch (error) {
      console.error("PDF 생성 실패:", error);
      alert("PDF 파일 생성 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const normalize = (val: any) => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/\s+/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').toUpperCase();
  };
  
  const extractNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).split('(')[0].replace(/,/g, '').replace('%', '').trim();
    const match = cleanStr.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const parseExcel = async () => {
    if (!excelFile) return;
    setIsParsing(true);
    console.log("엑셀 분석 시작:", excelFile.name);

    try {
      const arrayBuffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as any[][];

      if (aoa.length === 0) throw new Error("엑셀 파일에 데이터가 없습니다.");

      const impKeywords = ['노출', 'IMPRESSION', 'IMP', 'VIEW'];
      const clickKeywords = ['클릭', 'CLICK'];
      const productKeywords = ['상품', 'PRODUCT', '광고', '소재', '캠페인'];
      const dateKeywords = ['날짜', 'DATE', '일자', '시작'];

      let headerIdx = -1;
      for (let i = 0; i < Math.min(aoa.length, 50); i++) {
        const rowStr = aoa[i].map(c => normalize(c)).join('|');
        if (impKeywords.some(k => rowStr.includes(k)) && clickKeywords.some(k => rowStr.includes(k))) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        throw new Error("데이터 테이블의 헤더(노출, 클릭 등)를 찾을 수 없습니다.");
      }

      const headerRow = aoa[headerIdx].map(h => normalize(h));
      const findColIdx = (keywords: string[]) => {
        return headerRow.findIndex(h => keywords.some(k => h.includes(k)));
      };

      const colMapping = {
        product: findColIdx(productKeywords),
        date: findColIdx(dateKeywords),
        imp: findColIdx(impKeywords),
        click: findColIdx(clickKeywords)
      };

      if (colMapping.imp === -1 || colMapping.click === -1) {
        throw new Error("필수 컬럼을 찾을 수 없습니다.");
      }

      const findMeta = (keys: string[]) => {
        for (let r = 0; r < headerIdx; r++) {
          for (let c = 0; c < (aoa[r]?.length || 0); c++) {
            const cellVal = normalize(aoa[r][c]);
            if (keys.some(k => cellVal.includes(k))) {
              return String(aoa[r][c+1] || aoa[r][c+2] || '').trim();
            }
          }
        }
        return '';
      };

      const advertiser = findMeta(['광고주', 'ADVERTISER', 'CLIENT']) || reportData.summary.advertiser;
      const campaignName = findMeta(['캠페인', 'CAMPAIGN', 'REPORT']) || "New Campaign Report";
      const period = findMeta(['기간', 'PERIOD', 'DATE']) || "-";

      const mappedRows: AdRow[] = aoa.slice(headerIdx + 1)
        .filter(row => {
          const impVal = extractNumber(row[colMapping.imp]);
          return !isNaN(impVal) && impVal > 0;
        })
        .map((row, idx) => {
          const imp = extractNumber(row[colMapping.imp]);
          const click = extractNumber(row[colMapping.click]);
          return {
            no: idx + 1,
            product: colMapping.product !== -1 ? String(row[colMapping.product] || '기본배너').trim() : '기본배너',
            date: colMapping.date !== -1 ? String(row[colMapping.date] || '-').trim() : '-',
            impressions: imp,
            clicks: click,
            ctr: imp > 0 ? Number(((click / imp) * 100).toFixed(2)) : 0
          };
        });

      if (mappedRows.length === 0) throw new Error("분석할 수 있는 데이터가 없습니다.");

      setReportData({
        summary: {
          name: campaignName,
          advertiser: advertiser,
          period: period !== "-" ? period : (mappedRows.length > 0 ? `${mappedRows[0].date} ~ ${mappedRows[mappedRows.length-1].date}` : '-'),
          totalImpressions: mappedRows.reduce((sum, r) => sum + r.impressions, 0),
          totalClicks: mappedRows.reduce((sum, r) => sum + r.clicks, 0),
          avgCtr: Number(((mappedRows.reduce((sum, r) => sum + r.clicks, 0) / mappedRows.reduce((sum, r) => sum + r.impressions, 0)) * 100).toFixed(2))
        },
        rows: mappedRows
      });

      setTempTitle(campaignName);
      setSelectedMonth('all'); // 데이터 로드 시 필터 초기화
      setIsModalOpen(false);
      setExcelFile(null);

    } catch (err: any) {
      alert(`분석 오류: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleTitleSave = () => {
    setReportData(prev => ({
      ...prev,
      summary: { ...prev.summary, name: tempTitle }
    }));
    setIsEditingTitle(false);
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <BarChart3 size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 leading-none">Report Master</h1>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Premium Intelligence</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm shadow-md active:scale-95"
              >
                <FileSpreadsheet size={16} />
                <span>데이터 업로드</span>
              </button>
              <button 
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm shadow-sm active:scale-95 ${
                  isExporting 
                  ? 'bg-slate-100 text-slate-400 cursor-wait' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{isExporting ? 'PDF 생성 중...' : 'PDF 다운로드'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main ref={reportRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4 w-full">
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">Performance Analytics</span>
              <span className="text-slate-400 text-sm font-bold uppercase tracking-tight">{reportData.summary.advertiser}</span>
            </div>
            
            <div className="group relative">
              {isEditingTitle ? (
                <div className="flex items-center space-x-3">
                  <input 
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                    autoFocus
                    className="text-4xl font-black text-slate-900 bg-white border-b-2 border-indigo-600 outline-none py-1 px-2 rounded-t-lg"
                  />
                  <button onClick={handleTitleSave} className="p-2 bg-indigo-600 text-white rounded-lg shadow-md"><Check size={20} /></button>
                </div>
              ) : (
                <div className="flex items-center group">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setIsEditingTitle(true)}>
                    {reportData.summary.name}
                  </h2>
                  <Edit3 size={18} className="ml-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity print-hide-btn" />
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex items-center space-x-2 text-slate-500">
                <Calendar size={16} className="text-indigo-500" />
                <span className="text-sm font-bold text-slate-600">{reportData.summary.period}</span>
              </div>
              
              {/* 월별 필터 UI - PDF 출력 시 onclone 로직으로 제거됨 */}
              <div id="month-filter-ui" className="flex items-center p-1 bg-slate-100/80 rounded-2xl w-fit">
                <button 
                  onClick={() => setSelectedMonth('all')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${selectedMonth === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  전체
                </button>
                {availableMonths.map(month => (
                  <button 
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${selectedMonth === month ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {parseInt(month)}월
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Section (Hidden in PDF via ID) */}
        <div id="ai-insight-container" className="rounded-3xl overflow-hidden shadow-lg border border-indigo-100">
          <InsightSection data={reportData} />
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <MetricCard 
            label="Impressions" 
            value={filteredRows.reduce((sum, r) => sum + r.impressions, 0).toLocaleString()} 
            subValue={selectedMonth === 'all' ? "누적 노출량" : `${parseInt(selectedMonth)}월 노출량`} 
            colorClass="bg-indigo-600" 
            icon={<TrendingUp size={24} />} 
          />
          <MetricCard 
            label="Clicks" 
            value={filteredRows.reduce((sum, r) => sum + r.clicks, 0).toLocaleString()} 
            subValue={selectedMonth === 'all' ? "누적 클릭량" : `${parseInt(selectedMonth)}월 클릭량`} 
            colorClass="bg-purple-600" 
            icon={<MousePointer2 size={24} />} 
          />
          <MetricCard 
            label="Efficiency" 
            value={`${filteredRows.length > 0 ? Number(((filteredRows.reduce((sum, r) => sum + r.clicks, 0) / filteredRows.reduce((sum, r) => sum + r.impressions, 0)) * 100).toFixed(2)) : 0}%`} 
            subValue={selectedMonth === 'all' ? "평균 클릭율" : `${parseInt(selectedMonth)}월 클릭율`} 
            colorClass="bg-emerald-600" 
            icon={<Target size={24} />} 
          />
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
           <div className="flex items-center space-x-2 px-2">
              <Layers size={20} className="text-indigo-600" />
              <h4 className="text-xl font-black text-slate-800">성과 추이 분석</h4>
              {selectedMonth !== 'all' && <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{parseInt(selectedMonth)}월 데이터</span>}
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <h5 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">노출 변동 추이</h5>
                <PerformanceChart data={filteredRows} />
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <h5 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">클릭 효율 (CTR)</h5>
                <CtrChart data={filteredRows} />
              </div>
           </div>
        </div>

        {/* Gallery Section */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
           <div className="flex items-center justify-between mb-10">
              <h4 className="text-xl font-black text-slate-800">Creative Gallery</h4>
              <label className="cursor-pointer flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all font-bold text-xs border border-slate-200 print-hide-btn">
                <Plus size={14} />
                <span>소재 추가</span>
                <input type="file" multiple className="hidden" onChange={handleImageUpload} accept="image/*" />
              </label>
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
              {bannerImages.length > 0 ? (
                bannerImages.map((src, idx) => (
                  <div key={idx} className="group relative aspect-video rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <img src={src} className="w-full h-full object-cover" />
                    <button onClick={() => removeBannerImage(idx)} className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm print-hide-btn">
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 text-slate-400">
                  <ImageIcon size={32} className="mb-3 opacity-30" />
                  <p className="text-[11px] font-bold uppercase tracking-widest">업로드된 소재가 없습니다</p>
                </div>
              )}
           </div>
        </div>

        {/* Data Table Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-xl font-black text-slate-800">데이터 상세 로그</h4>
          </div>
          <DataTable rows={filteredRows} />
        </div>
      </main>

      <footer className="mt-20 py-10 text-center border-t border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-widest">
         Premium Ad Intelligence Report © 2026
      </footer>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isParsing && setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-900 mb-6">엑셀 데이터 업로드</h3>
            <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${excelFile ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300'}`}>
               <Upload className={`w-8 h-8 mb-3 ${excelFile ? 'text-indigo-500' : 'text-slate-300'}`} />
               <p className="text-sm text-slate-600 font-bold px-4 text-center">{excelFile ? excelFile.name : '분석할 엑셀 파일을 선택하세요'}</p>
               <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex justify-end space-x-3 mt-8">
               <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-400">취소</button>
               <button 
                onClick={parseExcel} 
                disabled={!excelFile || isParsing}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center space-x-2"
               >
                 {isParsing && <Loader2 size={16} className="animate-spin" />}
                 <span>{isParsing ? '분석 중...' : '분석 시작'}</span>
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
