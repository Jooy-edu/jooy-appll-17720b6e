export interface RegionData {
  id: string;
  document_id: string;
  user_id: string;
  page: number;
  pageNumber?: number; // For backward compatibility
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  name: string;
  description: string[] | string;
  created_at: string;
}

export interface GuidanceItem {
  title: string;
  description: string[];
  audioName: string;
}

export interface AutoModePageData {
  page_number: number;
  page_description: string;
  guidance: GuidanceItem[];
  parent_guidance?: GuidanceItem[];
}

export interface RegionsModeMetadata {
  mode?: "regions";
  documentName: string;
  documentId: string;
  regions: RegionData[];
  drmProtectedPages: number[] | boolean;
}

export interface AutoModeMetadata {
  mode: "auto";
  documentName: string;
  documentId: string;
  drmProtectedPages: number[] | boolean;
  data: AutoModePageData[];
}

export type WorksheetMetadata = RegionsModeMetadata | AutoModeMetadata;