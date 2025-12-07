import { NextRequest, NextResponse } from 'next/server'
import * as timelineDb from '../../../../lib/db/timeline'
import { uploadFile } from '../../../../lib/storage'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const organisationId = formData.get('organisationId') as string | null
    const contactId = formData.get('contactId') as string | null
    const projectId = formData.get('projectId') as string | null
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Missing file' },
        { status: 400 }
      )
    }

    if (!organisationId && !contactId) {
      return NextResponse.json(
        { error: 'Missing organisationId or contactId' },
        { status: 400 }
      )
    }

    // Upload file to Supabase storage
    const uploadResult = await uploadFile(file, 'timeline-files')

    if (uploadResult.error || !uploadResult.url) {
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create timeline item of type 'file'
    const timelineItem = await timelineDb.createTimelineItem({
      organisationId: organisationId || undefined,
      contactId: contactId || undefined,
      projectId: projectId || undefined,
      type: 'file',
      title: file.name,
      body: null,
    })

    if (!timelineItem) {
      return NextResponse.json(
        { error: 'Failed to create timeline item' },
        { status: 500 }
      )
    }

    // Add attachment
    const attachment = await timelineDb.addAttachmentToTimelineItem({
      timelineItemId: timelineItem.id,
      fileName: file.name,
      fileUrl: uploadResult.url,
      mimeType: file.type || undefined,
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'Failed to create attachment' },
        { status: 500 }
      )
    }

    // Return timeline item with attachment
    return NextResponse.json({
      ...timelineItem,
      attachments: [attachment],
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error uploading file to timeline:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: error.message },
      { status: 500 }
    )
  }
}

