import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User, Calendar, Save, AlertTriangle, Info, ArrowUpRight,
  ArrowDownRight, Minus, CheckCircle,
} from 'lucide-react';
import { patientService, sessionService, settingsService } from '@/services';
import {
  formatDate, formatNumber, computeBaselineComparison,
  assessmentTypeLabel,
} from '@/utils';
import type { PatientProfile, BaselineMeasurement, SessionSummary, BaselineComparison } from '@/types';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100, 'Name too long'),
  notes: z.string().max(500, 'Notes must be under 500 characters'),
  dominantHand: z.enum(['left', 'right']),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const PatientProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [baseline, setBaseline] = useState<BaselineMeasurement | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'baseline'>('profile');
  const settings = settingsService.getSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, b, s] = await Promise.all([
        patientService.getProfile('demo-patient-001'),
        patientService.getBaseline('demo-patient-001'),
        sessionService.getSessions('demo-patient-001'),
      ]);
      setProfile(p);
      setBaseline(b);
      setSessions(s);
      reset({
        displayName: p.displayName,
        notes: p.notes,
        dominantHand: p.preferences.dominantHand,
      });
    } catch {
      setError('Unable to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await patientService.updateProfile('demo-patient-001', {
        displayName: data.displayName,
        notes: data.notes,
        preferences: {
          ...profile!.preferences,
          dominantHand: data.dominantHand,
        },
      });
      setProfile(updated);
      reset({
        displayName: updated.displayName,
        notes: updated.notes,
        dominantHand: updated.preferences.dominantHand,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  // Baseline comparison
  const latestCompleted = sessions.find(
    s => s.status === 'completed' && s.tremorAmplitude != null
  );

  const comparisons: BaselineComparison[] = baseline && latestCompleted ? [
    computeBaselineComparison(
      'Tremor Amplitude', 'mm',
      baseline.tremorAmplitude, latestCompleted.tremorAmplitude
    ),
    computeBaselineComparison(
      'Tremor Frequency', 'Hz',
      baseline.tremorFrequency, latestCompleted.tremorFrequency
    ),
    computeBaselineComparison(
      'Grip Strength', 'raw ADC',
      baseline.gripStrength, latestCompleted.gripStrength
    ),
  ] : [];

  if (loading) {
    return (
      <div>
        {settings.dataMode === 'demo' && <DemoBanner />}
        <div className="card">
          <div className="card-body">
            <div className="space-y-4">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <AlertTriangle className="empty-state-icon text-danger-500 mx-auto" />
            <p className="empty-state-title">Unable to load profile</p>
            <p className="empty-state-description">{error}</p>
            <button className="btn btn-primary mt-4" onClick={fetchData}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {settings.dataMode === 'demo' && <DemoBanner />}

      {/* Tabs */}
      <div className="tabs mb-6">
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
          role="tab"
          aria-selected={activeTab === 'profile'}
        >
          Profile Information
        </button>
        <button
          className={`tab ${activeTab === 'baseline' ? 'active' : ''}`}
          onClick={() => setActiveTab('baseline')}
          role="tab"
          aria-selected={activeTab === 'baseline'}
        >
          Baseline Comparison
        </button>
      </div>

      {activeTab === 'profile' && profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Form */}
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <User size={18} />
                Profile Information
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="form-group">
                  <label htmlFor="displayName" className="form-label">Display Name</label>
                  <input
                    id="displayName"
                    type="text"
                    className={`form-input ${errors.displayName ? 'form-input-error' : ''}`}
                    {...register('displayName')}
                    aria-invalid={!!errors.displayName}
                    aria-describedby={errors.displayName ? 'displayName-error' : undefined}
                  />
                  {errors.displayName && (
                    <p className="form-error" id="displayName-error" role="alert">
                      {errors.displayName.message}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="dominantHand" className="form-label">Dominant Hand</label>
                  <select
                    id="dominantHand"
                    className="form-input form-select"
                    {...register('dominantHand')}
                  >
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="notes" className="form-label">Notes</label>
                  <textarea
                    id="notes"
                    className={`form-input ${errors.notes ? 'form-input-error' : ''}`}
                    rows={4}
                    {...register('notes')}
                    aria-invalid={!!errors.notes}
                    aria-describedby={errors.notes ? 'notes-error' : undefined}
                    placeholder="Optional notes about monitoring preferences…"
                  />
                  {errors.notes && (
                    <p className="form-error" id="notes-error" role="alert">
                      {errors.notes.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="submit"
                    className="btn btn-teal"
                    disabled={saving || !isDirty}
                  >
                    <Save size={16} />
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {saveSuccess && (
                    <span className="text-sm text-success-600 flex items-center gap-1" role="status">
                      <CheckCircle size={16} />
                      Changes saved successfully
                    </span>
                  )}
                </div>

                {error && profile && (
                  <div className="mt-3 p-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 text-sm" role="alert">
                    {error}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Profile Summary */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Monitoring Summary</h3>
              </div>
              <div className="card-body space-y-3">
                <ProfileRow label="Patient ID" value={profile.id} />
                <ProfileRow label="Monitoring Start" value={formatDate(profile.monitoringStartDate)} />
                <ProfileRow
                  label="Total Sessions"
                  value={sessions.length.toString()}
                />
                <ProfileRow
                  label="Completed Sessions"
                  value={sessions.filter(s => s.status === 'completed').length.toString()}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <p className="text-xs text-text-tertiary">
                  <strong>Privacy Note:</strong> This is a frontend prototype.
                  Profile data is stored in browser memory only and is not
                  persisted or transmitted. No real patient data should be entered.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'baseline' && (
        <div className="space-y-6">
          {!baseline ? (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <Calendar className="empty-state-icon mx-auto" />
                  <p className="empty-state-title">No baseline recorded</p>
                  <p className="empty-state-description">
                    A baseline assessment is needed to compare measurements. This should be
                    recorded during an initial session with the NeuroGlove device.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Baseline info */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Baseline Measurement</h3>
                  <span className="text-sm text-text-tertiary">
                    Recorded: {formatDate(baseline.recordedDate)}
                  </span>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <BaselineMetric label="Tremor Amplitude" value={baseline.tremorAmplitude} unit="mm" />
                    <BaselineMetric label="Tremor Frequency" value={baseline.tremorFrequency} unit="Hz" />
                    <BaselineMetric label="Grip Strength" value={baseline.gripStrength} unit="raw" />
                    <BaselineMetric label="Flex Range 1" value={baseline.flexRange1} unit="raw" />
                  </div>
                  <p className="text-sm text-text-secondary">
                    <strong>Conditions:</strong> {baseline.assessmentConditions || '—'}
                  </p>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Comparison with Most Recent Assessment</h3>
                </div>
                {comparisons.length === 0 || !latestCompleted ? (
                  <div className="card-body">
                    <div className="empty-state">
                      <Info className="empty-state-icon mx-auto" />
                      <p className="empty-state-title">No comparison available</p>
                      <p className="empty-state-description">
                        Complete an assessment session to compare with the baseline.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="card-body">
                    <p className="text-sm text-text-secondary mb-4">
                      Comparing baseline ({formatDate(baseline.recordedDate)}) with most recent
                      assessment ({formatDate(latestCompleted.date)} —{' '}
                      {assessmentTypeLabel(latestCompleted.assessmentType)}).
                    </p>
                    <div className="table-container">
                      <table className="data-table" aria-label="Baseline comparison">
                        <thead>
                          <tr>
                            <th scope="col">Metric</th>
                            <th scope="col">Baseline</th>
                            <th scope="col">Current</th>
                            <th scope="col">Change</th>
                            <th scope="col">Direction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisons.map(c => (
                            <tr key={c.metric}>
                              <td className="font-medium">{c.metric}</td>
                              <td>
                                {c.baselineValue != null
                                  ? `${formatNumber(c.baselineValue)} ${c.unit}`
                                  : '—'}
                              </td>
                              <td>
                                {c.currentValue != null
                                  ? `${formatNumber(c.currentValue)} ${c.unit}`
                                  : '—'}
                              </td>
                              <td>
                                {c.absoluteDifference != null ? (
                                  <span>
                                    {c.absoluteDifference > 0 ? '+' : ''}
                                    {formatNumber(c.absoluteDifference)}{' '}
                                    {c.percentageChange != null && (
                                      <span className="text-text-tertiary">
                                        ({c.percentageChange > 0 ? '+' : ''}
                                        {formatNumber(c.percentageChange)}%)
                                      </span>
                                    )}
                                  </span>
                                ) : '—'}
                              </td>
                              <td>
                                <DirectionBadge direction={c.direction} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-text-tertiary mt-4" role="note">
                      Changes are presented as numerical observations only. An increase or decrease
                      does not automatically indicate clinical improvement or deterioration.
                      Consult a medical professional for clinical interpretation.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Sub-components ----

function DemoBanner() {
  return (
    <div className="demo-banner" role="status">
      <Info size={16} aria-hidden="true" />
      <span>
        <strong>Demonstration Mode</strong> — This profile contains simulated data. Do not enter real patient information.
      </span>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

function BaselineMetric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="p-3 rounded-lg bg-surface-tertiary">
      <p className="text-xs font-medium text-text-secondary mb-1">{label}</p>
      <p className="text-lg font-bold text-text-primary">
        {value != null && Number.isFinite(value) ? (
          <>
            {formatNumber(value, unit === 'raw' ? 0 : 1)}
            <span className="text-xs font-normal text-text-tertiary ml-1">{unit}</span>
          </>
        ) : '—'}
      </p>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: BaselineComparison['direction'] }) {
  switch (direction) {
    case 'increased':
      return (
        <span className="badge badge-neutral flex items-center gap-1">
          <ArrowUpRight size={12} />
          Increased
        </span>
      );
    case 'decreased':
      return (
        <span className="badge badge-neutral flex items-center gap-1">
          <ArrowDownRight size={12} />
          Decreased
        </span>
      );
    case 'unchanged':
      return (
        <span className="badge badge-neutral flex items-center gap-1">
          <Minus size={12} />
          Unchanged
        </span>
      );
    default:
      return <span className="badge badge-neutral">Unavailable</span>;
  }
}

export default PatientProfilePage;
