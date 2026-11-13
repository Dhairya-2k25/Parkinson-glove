import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, Download, Clock, AlertTriangle,
  ChevronUp, ChevronDown, Info, Calendar, X,
} from 'lucide-react';
import { sessionService, settingsService } from '@/services';
import {
  formatDate, formatDateTime, formatDuration, formatNumber,
  assessmentTypeLabel, sessionStatusLabel, downloadCSV, isValidDateRange,
} from '@/utils';
import type { SessionSummary, SessionFilter, AssessmentType } from '@/types';

const ITEMS_PER_PAGE = 8;

const SessionHistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const settings = settingsService.getSettings();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [assessmentType, setAssessmentType] = useState<AssessmentType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateError, setDateError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Partial<SessionFilter> = {
        searchQuery,
        assessmentType,
        dateFrom,
        dateTo,
        sortBy,
      };
      const data = await sessionService.getSessions('demo-patient-001', filter);
      setSessions(data);
      setCurrentPage(1);
    } catch {
      setError('Unable to load session history.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, assessmentType, dateFrom, dateTo, sortBy]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Date validation
  useEffect(() => {
    if (dateFrom && dateTo && !isValidDateRange(dateFrom, dateTo)) {
      setDateError('Start date must be before end date.');
    } else {
      setDateError(null);
    }
  }, [dateFrom, dateTo]);

  const clearFilters = () => {
    setSearchQuery('');
    setAssessmentType('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('date_desc');
  };

  const hasActiveFilters = searchQuery || assessmentType !== 'all' || dateFrom || dateTo;

  // Pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sessions.slice(start, start + ITEMS_PER_PAGE);
  }, [sessions, currentPage]);

  return (
    <div>
      {settings.dataMode === 'demo' && (
        <div className="demo-banner" role="status">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Demonstration Mode</strong> — Sessions shown are simulated demonstration data.
          </span>
        </div>
      )}

      {/* Filters Card */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            {/* Search */}
            <div className="lg:col-span-2">
              <label htmlFor="session-search" className="form-label">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  id="session-search"
                  type="search"
                  className="form-input pl-10"
                  placeholder="Search by ID, type, or status…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Assessment Type */}
            <div>
              <label htmlFor="assessment-type" className="form-label">Type</label>
              <select
                id="assessment-type"
                className="form-input form-select"
                value={assessmentType}
                onChange={e => setAssessmentType(e.target.value as AssessmentType | 'all')}
              >
                <option value="all">All Types</option>
                <option value="tremor_assessment">Tremor Assessment</option>
                <option value="grip_assessment">Grip Assessment</option>
                <option value="finger_tap">Finger Tap Test</option>
                <option value="full_assessment">Full Assessment</option>
                <option value="rehabilitation">Rehabilitation</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="date-from" className="form-label">From</label>
              <input
                id="date-from"
                type="date"
                className={`form-input ${dateError ? 'form-input-error' : ''}`}
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                aria-invalid={!!dateError}
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="date-to" className="form-label">To</label>
              <input
                id="date-to"
                type="date"
                className={`form-input ${dateError ? 'form-input-error' : ''}`}
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                aria-invalid={!!dateError}
              />
            </div>
          </div>

          {dateError && (
            <p className="form-error mt-2" role="alert">{dateError}</p>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSortBy(s => s === 'date_desc' ? 'date_asc' : 'date_desc')}
                aria-label={`Sort by date ${sortBy === 'date_desc' ? 'ascending' : 'descending'}`}
              >
                {sortBy === 'date_desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                {sortBy === 'date_desc' ? 'Newest first' : 'Oldest first'}
              </button>

              {hasActiveFilters && (
                <button className="btn btn-sm btn-ghost text-danger-600" onClick={clearFilters}>
                  <X size={14} />
                  Clear filters
                </button>
              )}
            </div>

            <span className="text-sm text-text-tertiary">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="card">
          <div className="card-body space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <AlertTriangle className="empty-state-icon text-danger-500 mx-auto" />
              <p className="empty-state-title">Unable to load sessions</p>
              <p className="empty-state-description">{error}</p>
              <button className="btn btn-primary mt-4" onClick={fetchSessions}>Try again</button>
            </div>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <Calendar className="empty-state-icon mx-auto" />
              <p className="empty-state-title">
                {hasActiveFilters ? 'No matching sessions' : 'No sessions recorded'}
              </p>
              <p className="empty-state-description">
                {hasActiveFilters
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Assessment sessions will appear here after they are completed with the NeuroGlove device.'}
              </p>
              {hasActiveFilters && (
                <button className="btn btn-secondary mt-4" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="data-table" aria-label="Session history">
              <thead>
                <tr>
                  <th scope="col">Date & Time</th>
                  <th scope="col">Type</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Tremor</th>
                  <th scope="col">Grip</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {paginatedSessions.map(s => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-text-tertiary shrink-0" />
                        <div>
                          <div className="font-medium">{formatDate(s.date)}</div>
                          <div className="text-xs text-text-tertiary">{formatDateTime(s.date).split(', ')[1]}</div>
                        </div>
                      </div>
                    </td>
                    <td>{assessmentTypeLabel(s.assessmentType)}</td>
                    <td>{formatDuration(s.duration)}</td>
                    <td>
                      {s.tremorAmplitude != null ? (
                        <span>{formatNumber(s.tremorAmplitude)} mm</span>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                    <td>
                      {s.gripStrength != null ? (
                        <span>{formatNumber(s.gripStrength, 0)}</span>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                    <td>
                      <SessionStatusBadge status={s.status} />
                    </td>
                    <td>
                      <Link
                        to={`/sessions/${s.id}`}
                        className="btn btn-sm btn-secondary"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-text-tertiary">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function SessionStatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'badge-success'
    : status === 'in_progress' ? 'badge-info'
    : status === 'incomplete' ? 'badge-warning'
    : 'badge-neutral';
  return (
    <span className={`badge ${cls}`} role="status">
      {sessionStatusLabel(status)}
    </span>
  );
}

export default SessionHistoryPage;
