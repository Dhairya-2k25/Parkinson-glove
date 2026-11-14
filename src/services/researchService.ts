/**
 * NeuroGlove Research Data Services
 *
 * Connects to the Express backend for PADS research data.
 * These services operate on PUBLIC_RESEARCH data only.
 * They are separate from the demo mock services.
 *
 * Data sources:
 * - PUBLIC_RESEARCH: PADS dataset via Express backend
 * - DEMO: existing mock services (unchanged)
 * - LIVE_HARDWARE: not implemented in this phase
 */

import { researchApi } from '@/lib/apiClient';
import type {
  ResearchDataset,
  ResearchSubject,
  ResearchRecording,
  ResearchSensorReading,
  ResearchAnalytics,
  ResearchSession,
  PaginatedResult,
} from '@/lib/apiClient';

export type { ResearchDataset, ResearchSubject, ResearchRecording, ResearchSensorReading, ResearchAnalytics, ResearchSession, PaginatedResult };

export interface ResearchDashboardStats {
  recordingCount: number;
  participantCount: number;
  tasks: string[];
  recentSessions: ResearchSession[];
  datasetName: string | null;
  backendAvailable: boolean;
}

class ResearchService {
  private _backendAvailable: boolean | null = null;

  async isBackendAvailable(): Promise<boolean> {
    if (this._backendAvailable !== null) return this._backendAvailable;
    this._backendAvailable = await researchApi.getHealth();
    return this._backendAvailable;
  }

  /** Reset backend availability cache (useful after reconnect) */
  resetCache() {
    this._backendAvailable = null;
  }

  async getDashboardStats(): Promise<ResearchDashboardStats> {
    const available = await this.isBackendAvailable();
    if (!available) {
      return {
        recordingCount: 0,
        participantCount: 0,
        tasks: [],
        recentSessions: [],
        datasetName: null,
        backendAvailable: false,
      };
    }

    try {
      const [datasets, subjects, recordings, tasks, sessions] = await Promise.all([
        researchApi.getDatasets(),
        researchApi.getSubjects({ limit: 1 }),
        researchApi.getRecordings({ limit: 1 }),
        researchApi.getTasks(),
        researchApi.getSessions({ limit: 5 }),
      ]);

      return {
        recordingCount: recordings.pagination?.total || 0,
        participantCount: subjects.pagination?.total || 0,
        tasks,
        recentSessions: sessions.data,
        datasetName: datasets[0]?.dataset_name || null,
        backendAvailable: true,
      };
    } catch (err) {
      console.error('[ResearchService] getDashboardStats error:', err);
      return {
        recordingCount: 0,
        participantCount: 0,
        tasks: [],
        recentSessions: [],
        datasetName: null,
        backendAvailable: false,
      };
    }
  }

  async getRecordings(params?: { page?: number; limit?: number; subjectId?: string; task?: string }): Promise<PaginatedResult<ResearchRecording>> {
    return researchApi.getRecordings(params);
  }

  async getRecording(id: string): Promise<ResearchRecording | null> {
    return researchApi.getRecording(id);
  }

  async getRecordingSamples(id: string, params?: { page?: number; limit?: number }): Promise<PaginatedResult<ResearchSensorReading>> {
    return researchApi.getRecordingSamples(id, params);
  }

  async getAnalytics(recordingId: string): Promise<ResearchAnalytics | null> {
    return researchApi.getAnalytics(recordingId);
  }

  async getSubjects(params?: { page?: number; limit?: number }): Promise<PaginatedResult<ResearchSubject>> {
    return researchApi.getSubjects(params);
  }

  async getSessions(params?: { page?: number; limit?: number }): Promise<PaginatedResult<ResearchSession>> {
    return researchApi.getSessions(params);
  }

  async getTasks(): Promise<string[]> {
    return researchApi.getTasks();
  }
}

export const researchService = new ResearchService();
