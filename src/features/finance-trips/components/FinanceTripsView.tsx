'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganisations } from '@/app/hooks/useSharedLists';
import * as tripsDb from '../db/trips';
import * as tripItemsDb from '../db/trip-items';
import * as tripEvidenceDb from '../db/trip-evidence';
import type { FinanceTrip, FinanceTripWithStats } from '../db/trips';
import TripDetailView from './TripDetailView';

export default function FinanceTripsView() {
  const router = useRouter();
  const { organisations, loading: orgsLoading } = useOrganisations();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [trips, setTrips] = useState<FinanceTripWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripStartDate, setNewTripStartDate] = useState('');
  const [newTripEndDate, setNewTripEndDate] = useState('');

  useEffect(() => {
    if (organisations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organisations[0].id);
    }
  }, [organisations]);

  useEffect(() => {
    if (selectedOrgId) {
      loadTrips();
    }
  }, [selectedOrgId]);

  const loadTrips = async () => {
    if (!selectedOrgId) return;
    
    setLoading(true);
    try {
      const tripsData = await tripsDb.getTrips(selectedOrgId);
      
      // Calculate stats for each trip
      const tripsWithStats = await Promise.all(
        tripsData.map(async (trip) => {
          const items = await tripItemsDb.getTripItems(trip.id);
          const allEvidence = await tripEvidenceDb.getTripEvidenceByTrip(trip.id);
          
          // Calculate reimbursable totals grouped by currency
          const reimbursableTotals: Record<string, number> = {};
          let missingEvidenceCount = 0;
          
          items.forEach(item => {
            const isReimbursable = !item.paid_by_company_card && !item.exclude_from_reimbursement;
            if (isReimbursable) {
              const currency = item.currency || 'PLN';
              reimbursableTotals[currency] = (reimbursableTotals[currency] || 0) + Math.abs(item.amount);
            }
            
            // Check if item has evidence
            const itemEvidence = allEvidence.filter(e => e.trip_item_id === item.id);
            if (itemEvidence.length === 0) {
              missingEvidenceCount++;
            }
          });
          
          return {
            ...trip,
            items_count: items.length,
            reimbursable_totals: reimbursableTotals,
            missing_evidence_count: missingEvidenceCount,
          };
        })
      );
      
      setTrips(tripsWithStats);
    } catch (error) {
      console.error('Error loading trips:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert DD.MM.YYYY to YYYY-MM-DD (ISO format for DB)
  const parseEuDate = (euDate: string): string | null => {
    if (!euDate || !euDate.trim()) return null;
    const parts = euDate.trim().split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) return null;
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return isoDate;
    } catch {
      return null;
    }
  };

  const handleCreateTrip = async () => {
    if (!selectedOrgId || !newTripTitle.trim()) return;

    const trip = await tripsDb.createTrip({
      org_id: selectedOrgId,
      title: newTripTitle.trim(),
      start_date: parseEuDate(newTripStartDate),
      end_date: parseEuDate(newTripEndDate),
      status: 'draft',
    });

    if (trip) {
      setShowCreateModal(false);
      setNewTripTitle('');
      setNewTripStartDate('');
      setNewTripEndDate('');
      setSelectedTripId(trip.id);
      await loadTrips();
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency || 'PLN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // If trip is selected, show detail view
  if (selectedTripId) {
    return (
      <TripDetailView
        tripId={selectedTripId}
        orgId={selectedOrgId || ''}
        onBack={() => {
          setSelectedTripId(null);
          loadTrips();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Trips</h2>
        <div className="flex items-center gap-4">
          {organisations.length > 0 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value || null)}
              className="text-sm bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            >
              <option value="">All organisations</option>
              {organisations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            New Trip
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Trip</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={newTripTitle}
                  onChange={(e) => setNewTripTitle(e.target.value)}
                  placeholder="Trip title"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newTripStartDate}
                  onChange={(e) => setNewTripStartDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={newTripEndDate}
                  onChange={(e) => setNewTripEndDate(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTripTitle('');
                    setNewTripStartDate('');
                    setNewTripEndDate('');
                  }}
                  className="px-4 py-2 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTrip}
                  disabled={!newTripTitle.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trips List */}
      {loading ? (
        <div className="text-center py-8 text-neutral-400">Loading trips...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12 bg-neutral-800/50 border border-neutral-700 rounded-lg">
          <p className="text-neutral-400 mb-4">No trips yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Create first trip
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => (
            <div
              key={trip.id}
              onClick={() => setSelectedTripId(trip.id)}
              className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 cursor-pointer hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-medium text-white">{trip.title}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      trip.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                      trip.status === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {trip.status}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-400 mb-2">
                    {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-400">
                      {trip.items_count || 0} items
                    </span>
                    {trip.missing_evidence_count && trip.missing_evidence_count > 0 && (
                      <span className="text-red-400">
                        Missing evidence: {trip.missing_evidence_count}
                      </span>
                    )}
                    {trip.reimbursable_totals && Object.keys(trip.reimbursable_totals).length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">To reimburse:</span>
                        {Object.entries(trip.reimbursable_totals).map(([currency, total]) => (
                          <span key={currency} className="text-blue-400 font-medium">
                            {formatCurrency(total, currency)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

