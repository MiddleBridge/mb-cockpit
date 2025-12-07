import { NextRequest, NextResponse } from 'next/server'
import * as timelineDb from '../../../lib/db/timeline'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const organisationId = searchParams.get('organisationId')
    const contactId = searchParams.get('contactId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 100

    if (!organisationId && !contactId) {
      return NextResponse.json(
        { error: 'Missing organisationId or contactId parameter' },
        { status: 400 }
      )
    }

    let items
    if (organisationId) {
      items = await timelineDb.getTimelineItemsForOrganisation(organisationId, limit)
    } else if (contactId) {
      items = await timelineDb.getTimelineItemsForContact(contactId, limit)
    } else {
      items = []
    }

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Error fetching timeline items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timeline items', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      organisationId,
      contactId,
      projectId,
      type,
      title,
      body: itemBody,
      direction,
      status,
      externalSource,
      externalId,
      happenedAt,
    } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: type and title' },
        { status: 400 }
      )
    }

    if (!['note', 'task', 'email', 'file', 'meeting'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be one of: note, task, email, file, meeting' },
        { status: 400 }
      )
    }

    const item = await timelineDb.createTimelineItem({
      organisationId,
      contactId,
      projectId,
      type,
      title,
      body: itemBody,
      direction,
      status,
      externalSource,
      externalId,
      happenedAt,
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Failed to create timeline item' },
        { status: 500 }
      )
    }

    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    console.error('Error creating timeline item:', error)
    return NextResponse.json(
      { error: 'Failed to create timeline item', details: error.message },
      { status: 500 }
    )
  }
}

