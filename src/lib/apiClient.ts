/**
 * NeuroGlove API Client
 * Communicates with the Express backend.
 * Falls back gracefully if backend is unavailable.
 */

const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

// In production on Vercel, if VITE_API_URL is not provided, use relative '' so requests go to the same Vercel origin (/api/...)
const API_BASE = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
  ? import.meta.env.VITE_API_URL
  : (isProduction ? '' : 'http://localhost:3001');

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<ApiResponse<T>> {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const target = this.baseUrl ? `${this.baseUrl}${path}` : path;
    const url = new URL(target, baseOrigin);

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const target = this.baseUrl ? `${this.baseUrl}${path}` : path;
    const url = new URL(target, baseOrigin);

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || `HTTP ${response.status}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_BASE);

// ---- Research API helpers ----

export interface ResearchDataset {
  id: string;
  dataset_name: string;
  source_url: string;
  version: string;
  citation: string;
  licence: string;
  description: string;
  sampling_frequency: number | null;
  created_at: string;
}

export interface ResearchSubject {
  id: string;
  dataset_id: string;
  external_subject_id: string;
  participant_code: string;
  created_at: string;
}

export interface ResearchRecording {
  id: string;
  dataset_id: string;
  subject_id: string;
  external_recording_id: string;
  observation_id: string;
  side: string;
  sensor_location: string;
  task: string;
  sampling_rate: number;
  duration_seconds: number | null;
  accelerometer_unit: string;
  gyroscope_unit: string;
  created_at: string;
  research_subjects?: { participant_code: string; external_subject_id: string };
}

export interface ResearchSensorReading {
  id: number;
  recording_id: string;
  sample_index: number;
  timestamp_offset: number | null;
  accelerometer_x: number | null;
  accelerometer_y: number | null;
  accelerometer_z: number | null;
  gyroscope_x: number | null;
  gyroscope_y: number | null;
  gyroscope_z: number | null;
}

export interface ResearchAnalytics {
  id: string;
  recording_id: string;
  rms: number | null;
  dominant_frequency: number | null;
  tremor_related_frequency: number | null;
  movement_intensity: number | null;
  signal_magnitude: number | null;
  frequency_features: Record<string, unknown> | null;
  filtering_method: string;
  algorithm_version: string;
  calculated_at: string;
}

export interface ResearchSession {
  id: string;
  subject_id: string;
  recording_id: string;
  task: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  data_source: string;
  created_at: string;
  research_subjects?: { participant_code: string };
  research_recordings?: { task: string; sensor_location: string; sampling_rate: number };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const researchApi = {
  async getDatasets(): Promise<ResearchDataset[]> {
    const res = await apiClient.get<ResearchDataset[]>('/api/research/datasets');
    return res.data || [];
  },

  async getSubjects(params?: { page?: number; limit?: number; datasetId?: string }): Promise<PaginatedResult<ResearchSubject>> {
    const res = await apiClient.get<ResearchSubject[]>('/api/research/subjects', params as Record<string, string | number | boolean>);
    return { data: res.data || [], pagination: res.pagination! };
  },

  async getRecordings(params?: { page?: number; limit?: number; subjectId?: string; task?: string }): Promise<PaginatedResult<ResearchRecording>> {
    const res = await apiClient.get<ResearchRecording[]>('/api/research/recordings', params as Record<string, string | number | boolean>);
    return { data: res.data || [], pagination: res.pagination! };
  },

  async getRecording(id: string): Promise<ResearchRecording | null> {
    const res = await apiClient.get<ResearchRecording>(`/api/research/recordings/${id}`);
    return res.data || null;
  },

  async getRecordingSamples(id: string, params?: { page?: number; limit?: number }): Promise<PaginatedResult<ResearchSensorReading>> {
    const res = await apiClient.get<ResearchSensorReading[]>(`/api/research/recordings/${id}/samples`, params as Record<string, string | number | boolean>);
    return { data: res.data || [], pagination: res.pagination! };
  },

  async getAnalytics(recordingId: string): Promise<ResearchAnalytics | null> {
    const res = await apiClient.get<ResearchAnalytics>(`/api/research/analytics/${recordingId}`);
    return res.data || null;
  },

  async getTasks(): Promise<string[]> {
    const res = await apiClient.get<string[]>('/api/research/tasks');
    return res.data || [];
  },

  async getSessions(params?: { page?: number; limit?: number; subjectId?: string }): Promise<PaginatedResult<ResearchSession>> {
    const res = await apiClient.get<ResearchSession[]>('/api/research/sessions', params as Record<string, string | number | boolean>);
    return { data: res.data || [], pagination: res.pagination! };
  },

  async getSession(id: string): Promise<ResearchSession | null> {
    const res = await apiClient.get<ResearchSession>(`/api/research/sessions/${id}`);
    return res.data || null;
  },

  async getHealth(): Promise<boolean> {
    try {
      const res = await apiClient.get<{ message: string }>('/api/health');
      return res.success;
    } catch {
      return false;
    }
  },
};
