
export interface AdRow {
  no: number;
  product: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CampaignSummary {
  name: string;
  advertiser: string;
  period: string;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
}

export interface ReportData {
  summary: CampaignSummary;
  rows: AdRow[];
}
