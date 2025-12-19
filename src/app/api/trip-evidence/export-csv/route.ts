import { NextRequest, NextResponse } from 'next/server';
import * as tripsDb from '@/features/finance-trips/db/trips';
import * as tripItemsDb from '@/features/finance-trips/db/trip-items';
import * as tripEvidenceDb from '@/features/finance-trips/db/trip-evidence';

/**
 * Export trip as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tripId = searchParams.get('tripId');

    if (!tripId) {
      return NextResponse.json(
        { error: 'tripId parameter is required' },
        { status: 400 }
      );
    }

    const trip = await tripsDb.getTripById(tripId);
    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    const items = await tripItemsDb.getTripItems(tripId);
    const allEvidence = await tripEvidenceDb.getTripEvidenceByTrip(tripId);

    // Create evidence count map
    const evidenceCountMap = new Map<string, number>();
    allEvidence.forEach(ev => {
      if (ev.trip_item_id) {
        evidenceCountMap.set(ev.trip_item_id, (evidenceCountMap.get(ev.trip_item_id) || 0) + 1);
      }
    });

    // Generate CSV
    const headers = [
      'date',
      'vendor',
      'description',
      'category',
      'amount',
      'currency',
      'paid_by_company_card',
      'exclude_from_reimbursement',
      'reimbursable',
      'reimbursement_amount',
      'evidence_count',
    ];

    const rows = items.map(item => {
      const isReimbursable = !item.paid_by_company_card && !item.exclude_from_reimbursement;
      const reimbursementAmount = isReimbursable ? Math.abs(item.amount) : 0;
      const evidenceCount = evidenceCountMap.get(item.id) || 0;

      return [
        item.item_date || '',
        item.vendor || '',
        item.description || '',
        item.category || '',
        item.amount.toString(),
        item.currency || 'PLN',
        item.paid_by_company_card ? 'true' : 'false',
        item.exclude_from_reimbursement ? 'true' : 'false',
        isReimbursable ? 'true' : 'false',
        reimbursementAmount.toString(),
        evidenceCount.toString(),
      ];
    });

    // Escape CSV values (handle commas and quotes)
    const escapeCsvValue = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsvValue).join(',')),
    ];

    const csv = csvLines.join('\n');

    // Return CSV as response
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="trip-${trip.title}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting trip CSV:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export CSV' },
      { status: 500 }
    );
  }
}

